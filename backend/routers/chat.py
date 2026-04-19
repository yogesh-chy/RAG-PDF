import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db, SessionLocal
from security import get_current_user
from embeddings import get_query_embedding, stream_gemini_answer
from config import TOP_K_CHUNKS
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

        try:
            for token in stream_gemini_answer(context, request.question):
                full_response += token
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

            # Send sources after the answer
            yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

            # Send session ID (so frontend knows which session was created/used)
            yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"

            # Persist assistant message (create a fresh session for this)
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
