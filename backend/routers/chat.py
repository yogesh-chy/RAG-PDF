import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db, SessionLocal
from security import get_current_user
from embeddings import get_query_embedding, stream_groq_answer, stream_humanize_answer
from config import TOP_K_CHUNKS
import re
import statistics
import lancedb

db_lancedb = lancedb.connect("./lancedb_data")

router = APIRouter(prefix="/chat", tags=["Chat"])


# ─── RAG Streaming Endpoint ───────────────────────────────────────────────────

@router.post("/ask")
def ask_question(
    request: schemas.AskRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    RAG pipeline:
      1. Verify document ownership
      2. Get/create chat session
      3. Save user message
      4. Embed the question
      5. Cosine similarity search in pgvector (top-k chunks)
      6. Build context + stream Gemini answer (SSE)
      7. Save assistant message with sources
    """
    # ── 1. Verify document ────────────────────────────────────────────────
    doc = db.query(models.Document).filter(
        models.Document.id == request.doc_id,
        models.Document.user_id == current_user.id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.status == "processing":
        raise HTTPException(status_code=400, detail="Document is still being processed. Please wait.")
    if doc.status == "failed":
        raise HTTPException(status_code=400, detail="Document processing failed. Please re-upload.")

    # ── 2. Get or create session ──────────────────────────────────────────
    if request.session_id:
        session = db.query(models.ChatSession).filter(
            models.ChatSession.id == request.session_id,
            models.ChatSession.user_id == current_user.id,
        ).first()
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
    else:
        session = models.ChatSession(
            user_id=current_user.id,
            doc_id=request.doc_id,
            title=request.question[:60],
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    # ── 3. Save user message ──────────────────────────────────────────────
    user_msg = models.ChatMessage(
        session_id=session.id,
        role="user",
        content=request.question,
    )
    db.add(user_msg)
    db.commit()

    # ── 4. Embed the question ─────────────────────────────────────────────
    query_vector = get_query_embedding(request.question)

    # ── 5. Similarity search via LanceDB ─────────────────────────────────
    if "pdf_chunks" not in db_lancedb.table_names():
        raise HTTPException(status_code=404, detail="No content found in this document.")
    
    tbl = db_lancedb.open_table("pdf_chunks")
    results = tbl.search(query_vector).where(f"doc_id = {request.doc_id}").limit(TOP_K_CHUNKS).to_list()

    if not results:
        raise HTTPException(status_code=404, detail="No content found in this document.")

    chunk_ids = [res["chunk_id"] for res in results]

    # Fetch corresponding chunks from Postgres
    db_chunks = db.query(models.DocumentChunk).filter(
        models.DocumentChunk.id.in_(chunk_ids)
    ).all()
    
    # Re-order Postgres rows to match LanceDB ranking
    chunk_map = {chunk.id: chunk for chunk in db_chunks}
    rows = [chunk_map[cid] for cid in chunk_ids if cid in chunk_map]
    if not rows:
        raise HTTPException(status_code=404, detail="No content found in this document.")

    # ── 6. Build context and sources ──────────────────────────────────────
    context = "\n\n".join(
        f"[Page {row.page_number}]:\n{row.content}" for row in rows
    )
    sources = [
        {
            "chunk_id": row.id,
            "page_number": row.page_number,
            "snippet": row.content[:200] + ("..." if len(row.content) > 200 else ""),
        }
        for row in rows
    ]
    session_id = session.id

    # ── 7. Stream response ────────────────────────────────────────────────
    def generate():
        full_response = ""
        
        # Fetch session history for conversational memory
        history = []
        try:
            h_db = SessionLocal()
            past_messages = (
                h_db.query(models.ChatMessage)
                .filter(models.ChatMessage.session_id == session.id)
                .order_by(models.ChatMessage.created_at.desc())
                .offset(1) # Skip the user message we just added
                .limit(10) # Last 10 messages for context
                .all()
            )
            # Reverse to get chronological order
            for msg in reversed(past_messages):
                history.append({"role": msg.role, "content": msg.content})
            h_db.close()
        except Exception as e:
            print(f"[Warning] Failed to fetch chat history: {e}")

        try:
            # We use Groq by default for high-speed LLaMA 3 answers
            print(f"[DEBUG] Starting Groq stream for session {session_id}")
            for token in stream_groq_answer(context, request.question, history=history):
                full_response += token
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

            if not full_response:
                print("[WARNING] Empty response from stream_groq_answer")
                yield f"data: {json.dumps({'type': 'error', 'content': 'The AI returned an empty response. Please check your API keys or try again.'})}\n\n"
                return

            # Send sources after the answer
            yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

            # Send session ID
            yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"

            # Persist assistant message
            save_db = SessionLocal()
            try:
                asst_msg = models.ChatMessage(
                    session_id=session_id,
                    role="assistant",
                    content=full_response,
                    source_chunks=sources,
                )
                save_db.add(asst_msg)
                save_db.commit()
            finally:
                save_db.close()

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as exc:
            print(f"[ERROR] Chat streaming exception: {exc}")
            yield f"data: {json.dumps({'type': 'error', 'content': str(exc)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


def calculate_human_score(text: str) -> int:
    """
    Brutally honest human score calculation. 
    Prioritizes showing low scores for robotic text.
    """
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if s.strip()]
    if not sentences:
        return 10
    
    # 1. Burstiness (Human Signal) - Reward high variance in sentence length
    lengths = [len(s.split()) for s in sentences]
    if len(lengths) < 3: 
        variance = 0
    else:
        variance = statistics.variance(lengths)
    
    # 2. AI Marker Detection (Heavier Penalties)
    ai_markers = [
        'moreover', 'furthermore', 'additionally', 'in conclusion', 
        'consequently', 'therefore', 'notably', 'pivotal', 'delve',
        'testament', 'comprehensive', 'unlock', 'harness', 'robust',
        'navigate', 'synergy', 'transformative', 'digital age', 'fast-paced'
    ]
    marker_count = sum(1 for word in ai_markers if word in text.lower())
    
    # 3. Calculation
    # High variance (> 50) is very human. Low variance (< 10) is very AI.
    burstiness_score = min(50, (variance ** 0.5) * 6)
    
    base_score = 20
    score = int(base_score + burstiness_score - (marker_count * 12))
    
    # Final capping
    score = min(99, max(1, score))
    return score


@router.post("/humanize")
def humanize_text(
    request: schemas.HumanizeRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Humanize AI-generated text:
      1. Get/create chat session (no doc_id)
      2. Save user text
      3. Stream humanized answer
      4. Save assistant message
    """
    # ── 1. Get or create session ──────────────────────────────────────────
    if request.session_id:
        session = db.query(models.ChatSession).filter(
            models.ChatSession.id == request.session_id,
            models.ChatSession.user_id == current_user.id,
        ).first()
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
    else:
        session = models.ChatSession(
            user_id=current_user.id,
            doc_id=None,
            title=request.text[:60],
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    # ── 2. Save user message ──────────────────────────────────────────────
    user_msg = models.ChatMessage(
        session_id=session.id,
        role="user",
        content=request.text,
    )
    db.add(user_msg)
    db.commit()

    session_id = session.id

    # ── 3. Stream response ────────────────────────────────────────────────
    def generate():
        full_response = ""
        
        # Fetch session history for conversational memory
        history = []
        try:
            h_db = SessionLocal()
            past_messages = (
                h_db.query(models.ChatMessage)
                .filter(models.ChatMessage.session_id == session_id)
                .order_by(models.ChatMessage.created_at.desc())
                .offset(1) # Skip the text we just added
                .limit(10) # Last 10 messages for context
                .all()
            )
            for msg in reversed(past_messages):
                history.append({"role": msg.role, "content": msg.content})
            h_db.close()
        except Exception as e:
            print(f"[Warning] Failed to fetch chat history: {e}")

        try:
            for token in stream_humanize_answer(
                request.text, 
                history=history,
                tone=request.tone,
                intensity=request.intensity
            ):
                full_response += token
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

            # Send session ID
            yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"

            # Calculate and send score
            human_score = calculate_human_score(full_response)
            ai_score = 100 - human_score
            score_data = {"human_score": human_score, "ai_score": ai_score}
            yield f"data: {json.dumps({'type': 'score', 'data': score_data})}\n\n"

            # Persist assistant message with score in source_chunks
            save_db = SessionLocal()
            try:
                asst_msg = models.ChatMessage(
                    session_id=session_id,
                    role="assistant",
                    content=full_response,
                    source_chunks=[score_data], # Store score here
                )
                save_db.add(asst_msg)
                save_db.commit()
            finally:
                save_db.close()

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'content': str(exc)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ─── Session & History Endpoints ──────────────────────────────────────────────

@router.get("/sessions/{doc_id}", response_model=List[schemas.ChatSessionResponse])
def get_sessions(
    doc_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all chat sessions for a given document."""
    return (
        db.query(models.ChatSession)
        .filter(
            models.ChatSession.doc_id == doc_id,
            models.ChatSession.user_id == current_user.id,
        )
        .order_by(models.ChatSession.created_at.desc())
        .all()
    )


@router.get("/history/{session_id}", response_model=List[schemas.ChatMessageResponse])
def get_history(
    session_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all messages in a chat session."""
    session = db.query(models.ChatSession).filter(
        models.ChatSession.id == session_id,
        models.ChatSession.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.session_id == session_id)
        .order_by(models.ChatMessage.created_at.asc())
        .all()
    )


@router.get("/doc-history/{doc_id}", response_model=List[schemas.ChatMessageResponse])
def get_doc_history(
    doc_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all chat messages associated with a document (across all its sessions)."""
    # Join ChatMessage with ChatSession to filter by doc_id
    messages = (
        db.query(models.ChatMessage)
        .join(models.ChatSession)
        .filter(
            models.ChatSession.doc_id == doc_id,
            models.ChatSession.user_id == current_user.id
        )
        .order_by(models.ChatMessage.created_at.asc())
        .all()
    )
    return messages


@router.get("/humanize-history", response_model=List[schemas.ChatMessageResponse])
def get_humanize_history(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all chat messages associated with the AI humanizer (doc_id is null)."""
    messages = (
        db.query(models.ChatMessage)
        .join(models.ChatSession)
        .filter(
            models.ChatSession.doc_id.is_(None),
            models.ChatSession.user_id == current_user.id
        )
        .order_by(models.ChatMessage.created_at.asc())
        .all()
    )
    return messages


@router.delete("/humanize-history", status_code=status.HTTP_204_NO_CONTENT)
def delete_humanize_history(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete all humanize chat history (sessions where doc_id is None)."""
    db.query(models.ChatSession).filter(
        models.ChatSession.user_id == current_user.id,
        models.ChatSession.doc_id.is_(None)
    ).delete(synchronize_session=False)
    db.commit()
