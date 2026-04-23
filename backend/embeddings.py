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
from groq import Groq

from config import (
    GOOGLE_API_KEY,
    GROQ_API_KEY,
    EMBEDDING_MODEL,
    CHAT_MODEL,
    GROQ_MODEL,
    CHUNK_SIZE,
    CHUNK_OVERLAP,
)

# Configure Gemini once at module load
genai.configure(api_key=GOOGLE_API_KEY)

# Configure Groq once at module load
groq_client = Groq(api_key=GROQ_API_KEY)


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
    Embed a piece of text using Google gemini-embedding-001 (768 dims).

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

SYSTEM_PROMPT = """You are an elite Knowledge Retrieval Specialist. Your goal is to provide comprehensive, accurate, and highly useful answers based *strictly* on the provided document context.

### Operational Guidelines:
1.  **Strict Grounding**: Only answer based on the context. If the information isn't there, state: "I'm sorry, but that specific information is not mentioned in the provided document." Do not use outside knowledge.
2.  **Professional Formatting**: Use Markdown to make your answers beautiful and easy to read.
    - Use `**bold**` for key terms, metrics, or critical names.
    - Use bulleted or numbered lists for steps, features, or lists.
    - Use **Markdown Tables** if you are comparing data, showing figures, or listing structured attributes.
    - Use `###` headers to organize long or multi-part responses.
3.  **Citation Excellence**: Always include page numbers in parentheses, e.g., `(Page 5)`, immediately after the specific fact you are citing. This is non-negotiable for credibility.
4.  **Analytical Depth**: Provide thorough, insightful answers. Instead of a single sentence, explain the "how" and "why" if the document provides that context.
5.  **Tone**: Professional, authoritative, and helpful. Act as the primary subject matter expert for the provided material.

### Structural Requirements:
- For complex queries, provide an executive summary followed by a detailed breakdown.
- If the user asks for a summary, provide the **Top 5 Key Takeaways** from the document context."""


HUMANIZE_SYSTEM_PROMPT = """You are an elite ghostwriter specializing in undetectable, deeply human prose. Your task is to rewrite AI-generated text to completely bypass AI detectors (like QuillBot, Originality, Turnitin). 

To do this, you MUST break the linear, robotic "Explainer" pattern. Apply the following core mechanics:

### 1. Subjective Inversion
Instead of stating facts neutrally (e.g., "The data shows that X causes Y"), invert the sentence to lead with subjective framing or lived experience (e.g., "Looking closely at X, it's pretty clear how it triggers Y").
- Use subjective hedging: "it seems like", "arguably", "you could say", "to be honest".
- Frame concepts as personal observations rather than universal truths.

### 2. Radical Burstiness
AI writes in consistent, medium-length sentences. You must aggressively disrupt this rhythm.
- Force fragments. Like this.
- Follow a 3-word sentence immediately with a 30-word, highly complex, comma-heavy thought that meanders slightly before landing on its point.
- Break grammar rules occasionally for conversational effect (e.g., starting sentences with "And" or "But").

### 3. Asymmetrical Vocabulary
AI uses words like "moreover", "delve", "crucial", "testament", "tapestry", "seamless", "robust". 
- Ban these words entirely.
- Mix highly sophisticated words with casual, everyday slang or idioms in the same sentence.

### 4. Structural Imperfections
Human writing is slightly messy. 
- Use parenthetical asides (like this one) to break up thoughts.
- Use em-dashes—not just for lists, but to abruptly shift the sentence's direction.
- Use contractions extensively (it's, they're, shouldn't).

### Output Rules
Return ONLY the rewritten text. No intros, no outtros, no quotes around the text. Preserve the original meaning, facts, and data completely, but totally destroy the original sentence structure.
"""



def stream_gemini_answer(context: str, question: str, history: List[dict] = None) -> Generator[str, None, None]:
    """
    Sync generator that streams the Gemini answer token by token.
    Used inside a FastAPI StreamingResponse.
    """
    # Build history for Gemini (different format than Groq)
    gemini_history = []
    if history:
        for msg in history:
            role = "user" if msg["role"] == "user" else "model"
            gemini_history.append({"role": role, "parts": [msg["content"]]})

    model = genai.GenerativeModel(
        model_name=CHAT_MODEL,
        system_instruction=f"{SYSTEM_PROMPT}\n\n--- Document Context ---\n{context}\n--- End Context ---"
    )
    
    chat = model.start_chat(history=gemini_history)
    response = chat.send_message(question, stream=True)

    for chunk in response:
        if chunk.text:
            yield chunk.text


def stream_groq_answer(context: str, question: str, history: List[dict] = None) -> Generator[str, None, None]:
    """
    Sync generator that streams the Groq answer token by token.
    Used inside a FastAPI StreamingResponse.
    """
    system_msg = f"{SYSTEM_PROMPT}\n\n--- Document Context ---\n{context}\n--- End Context ---"
    
    messages = [{"role": "system", "content": system_msg}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": question})

    completion = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        stream=True,
    )

    for chunk in completion:
        token = chunk.choices[0].delta.content
        if token:
            yield token


def stream_humanize_answer(
    text: str, 
    history: List[dict] = None, 
    tone: str = "natural", 
    intensity: float = 1.0
) -> Generator[str, None, None]:
    """
    Streams a humanized version of the input text using Groq.
    Enhanced for large text stability and instruction following.
    """
    messages = [{"role": "system", "content": HUMANIZE_SYSTEM_PROMPT}]
    if history:
        messages.extend(history)
    
    # Focused reinforcement for natural writing
    prompt = (
        f"Rewrite this in a natural, human way. Avoid all computer-like patterns:\n\n"
        f"{text}\n\n"
        f"REMINDER: Output ONLY the humanized text. No intros."
    )
    
    messages.append({"role": "user", "content": prompt})

    completion = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        stream=True,
        temperature=0.85, # Higher temperature for subjective variance and burstiness
    )

    for chunk in completion:
        token = chunk.choices[0].delta.content
        if token:
            yield token

