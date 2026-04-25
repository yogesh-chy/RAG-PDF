import os
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db, SessionLocal
from security import get_current_user
from embeddings import extract_pages, chunk_pages, get_embedding
from config import DATABASE_URL
import lancedb

db_lancedb = lancedb.connect("./lancedb_data")

router = APIRouter(prefix="/documents", tags=["Documents"])


# ─── Background PDF Processing ────────────────────────────────────────────────

def _process_pdf(doc_id: int, pdf_bytes: bytes) -> None:
    """
    Background task: extract text → chunk → embed → store in DB.
    Creates its own DB session since it runs outside the request lifecycle.
    """
    db = SessionLocal()
    try:
        doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
        if not doc:
            return

        print(f"[DEBUG] Starting background processing for PDF: {doc.filename} (ID: {doc_id})")

        # Step 1: Extract pages
        pages, page_count = extract_pages(pdf_bytes)
        doc.page_count = page_count
        db.commit()

        # Step 2: Chunk the text
        chunks = chunk_pages(pages)

        # Step 3: Embed each chunk and persist
        data = []
        for chunk in chunks:
            embedding = get_embedding(chunk["content"], task_type="retrieval_document")
            db_chunk = models.DocumentChunk(
                doc_id=doc_id,
                user_id=doc.user_id,
                chunk_index=chunk["chunk_index"],
                page_number=chunk["page_number"],
                content=chunk["content"],
            )
            db.add(db_chunk)
            db.flush()  # So we get the db_chunk.id
            data.append({"vector": embedding, "doc_id": doc_id, "user_id": doc.user_id, "chunk_id": db_chunk.id})

        if data:
            print(f"[DEBUG] Storing {len(data)} chunks in LanceDB for doc {doc_id}")
            if "pdf_chunks" in db_lancedb.table_names():
                tbl = db_lancedb.open_table("pdf_chunks")
                tbl.add(data)
            else:
                db_lancedb.create_table("pdf_chunks", data=data)

        db.commit()

        # Step 4: Mark document as ready
        print(f"[SUCCESS] PDF {doc_id} processed successfully.")
        doc.status = "ready"
        db.commit()

    except Exception as exc:
        db.rollback()
        failed_doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
        if failed_doc:
            failed_doc.status = "failed"
            db.commit()
        print(f"[ERROR] PDF processing failed for doc {doc_id}: {exc}")
    finally:
        db.close()


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=schemas.DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Accept a PDF upload, create a document record, and kick off background processing."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    pdf_bytes = await file.read()
    if len(pdf_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    
    MAX_SIZE = 100 * 1024 * 1024
    if len(pdf_bytes) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 100MB.")

    # Create document record (status = processing)
    doc = models.Document(
        user_id=current_user.id,
        filename=file.filename,
        file_size=len(pdf_bytes),
        status="processing",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Kick off background embedding
    background_tasks.add_task(_process_pdf, doc.id, pdf_bytes)

    return doc


@router.post("/extract")
async def extract_document_text(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
):
    """Extract text from a PDF or Word document and return it as a string. Used for humanization."""
    filename = file.filename.lower() if file.filename else ""
    
    if not (filename.endswith(".pdf") or filename.endswith(".docx")):
        raise HTTPException(status_code=400, detail="Only PDF and Word (.docx) files are supported")

    file_bytes = await file.read()
    try:
        if filename.endswith(".pdf"):
            from embeddings import extract_pages
            pages, _ = extract_pages(file_bytes)
            full_text = "\n\n".join(text for _, text in pages)
        else:
            from embeddings import extract_docx
            full_text = extract_docx(file_bytes)
        
        if not full_text.strip():
            raise HTTPException(
                status_code=400, 
                detail="No text could be extracted from this document. It might be empty or image-only."
            )
            
        return {"text": full_text}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@router.get("/", response_model=List[schemas.DocumentResponse])
def list_documents(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all documents belonging to the current user."""
    return (
        db.query(models.Document)
        .filter(models.Document.user_id == current_user.id)
        .order_by(models.Document.created_at.desc())
        .all()
    )


@router.get("/{doc_id}", response_model=schemas.DocumentResponse)
def get_document(
    doc_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = db.query(models.Document).filter(
        models.Document.id == doc_id,
        models.Document.user_id == current_user.id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    doc_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a document and all its chunks/sessions (cascade)."""
    doc = db.query(models.Document).filter(
        models.Document.id == doc_id,
        models.Document.user_id == current_user.id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete from postgres (cascades to chunks/sessions)
    db.delete(doc)
    db.commit()

    # Delete related vectors from LanceDB
    try:
        if "pdf_chunks" in db_lancedb.table_names():
            tbl = db_lancedb.open_table("pdf_chunks")
            tbl.delete(f"doc_id = {doc_id}")
    except Exception as exc:
        print(f"[Warning] Failed to delete vectors from LanceDB for doc_id {doc_id}: {exc}")

