"""
embeddings.py
─────────────
Handles all AI operations:
  - PDF text extraction (PyMuPDF)
  - Token-aware chunking with overlap
  - Google Gemini embeddings (text-embedding-004, 768 dims)
  - Streaming chat answers (gemini-2.0-flash)
"""

from typing import List, Tuple, Generator
import fitz  # PyMuPDF
import google.generativeai as genai

from config import (
    GOOGLE_API_KEY,
    EMBEDDING_MODEL,
    CHAT_MODEL,
    CHUNK_SIZE,
    CHUNK_OVERLAP,
)

# Configure Gemini once at module load
genai.configure(api_key=GOOGLE_API_KEY)


# ─── PDF Parsing ──────────────────────────────────────────────────────────────

def extract_pages(pdf_bytes: bytes) -> Tuple[List[Tuple[int, str]], int]:
    """
    Extract text from each page of a PDF.

    Returns:
        pages     — list of (page_number, text) for non-empty pages
        page_count — total number of pages in the PDF
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages: List[Tuple[int, str]] = []
    for page_num, page in enumerate(doc, start=1):
        text = page.get_text().strip()
        if text:
            pages.append((page_num, text))
    return pages, len(doc)


# ─── Chunking ─────────────────────────────────────────────────────────────────

def chunk_pages(
    pages: List[Tuple[int, str]],
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> List[dict]:
    """
    Split page text into overlapping word-based chunks.

    Each chunk dict contains:
        chunk_index — global position across the document
        page_number — source PDF page
        content     — raw text of the chunk
    """
    chunks: List[dict] = []
    chunk_index = 0

    for page_num, text in pages:
        words = text.split()
        i = 0
        while i < len(words):
            chunk_words = words[i : i + chunk_size]
            content = " ".join(chunk_words).strip()
            if content:
                chunks.append(
                    {
                        "chunk_index": chunk_index,
                        "page_number": page_num,
                        "content": content,
                    }
                )
                chunk_index += 1
            i += chunk_size - overlap

    return chunks


# ─── Embeddings ───────────────────────────────────────────────────────────────

def get_embedding(text: str, task_type: str = "retrieval_document") -> List[float]:
    """
    Embed a piece of text using Google text-embedding-004 (768 dims).

    task_type:
        "retrieval_document" — for PDF chunks stored in the DB
        "retrieval_query"    — for user questions at query time
    """
    result = genai.embed_content(
        model=EMBEDDING_MODEL,
        content=text,
        task_type=task_type,
    )
    return result["embedding"]


def get_query_embedding(text: str) -> List[float]:
    """Convenience wrapper for query-time embeddings."""
    return get_embedding(text, task_type="retrieval_query")


# ─── Streaming Chat ───────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a helpful AI assistant specializing in answering questions about PDF documents.

Rules:
1. Answer ONLY based on the provided context from the document.
2. If the answer is not in the context, say: "I couldn't find that information in this document."
3. Always cite page numbers when referencing specific information, e.g. (Page 3).
4. Be concise, accurate, and helpful.
5. Format your response with clear paragraphs when the answer is long."""


def stream_gemini_answer(context: str, question: str) -> Generator[str, None, None]:
    """
    Sync generator that streams the Gemini answer token by token.
    Used inside a FastAPI StreamingResponse.
    """
    prompt = f"""{SYSTEM_PROMPT}

--- Document Context ---
{context}
--- End Context ---

Question: {question}

Answer:"""

    model = genai.GenerativeModel(CHAT_MODEL)
    response = model.generate_content(prompt, stream=True)

    for chunk in response:
        if chunk.text:
            yield chunk.text
