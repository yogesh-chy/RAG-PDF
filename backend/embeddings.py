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
import docx
import io

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


# ─── Word Parsing ─────────────────────────────────────────────────────────────

def extract_docx(docx_bytes: bytes) -> str:
    """
    Extract all text from a .docx file.
    """
    doc = docx.Document(io.BytesIO(docx_bytes))
    full_text = []
    for para in doc.paragraphs:
        if para.text.strip():
            full_text.append(para.text)
    return "\n\n".join(full_text)


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


HUMANIZE_SYSTEM_PROMPT = """You are a master of "Subjective Prose"—a style of writing that is statistically indistinguishable from a highly educated, slightly opinionated human. Your goal is to rewrite the provided text to bypass elite AI detectors (GPTZero, Turnitin, Originality.ai) by maximizing Perplexity and Burstiness.

### CORE MECHANICS (The "Human Fingerprint"):

1. **Aggressive Sentence Variance (Burstiness):**
   - Never write three sentences of similar length in a row.
   - Mix extreme short sentences (3-5 words) with sprawling, multi-clause academic thoughts (30-50 words).
   - Use semicolon-heavy sentences to link disparate ideas—humans do this, AI rarely does.

2. **Subjective Hedging & Commentary:**
   - Lead with the "I" or "You" perspective where possible: "I've always found that...", "Think about it this way...", "To be perfectly honest, it's not just about...".
   - Use parenthetical interjections (often slightly off-topic) to break the logical flow: "(which, if we're being real, is a bit of a stretch anyway)".

3. **Banned "AI-Fingerprint" Vocabulary:**
   - **STRICTLY BAN these words:** "Moreover", "Furthermore", "In conclusion", "Additionally", "Crucial", "Vital", "Comprehensive", "Harnessing", "Unlocking", "Tapestry", "Testament", "Delve", "Embark", "Navigate", "Synergy", "Transformative".
   - **USE these instead:** "Actually", "Besides that", "Basically", "The point is", "Look,", "What matters is", "Anyway", "Truth be told".

4. **Intentional Structural Messiness:**
   - Use rhetorical questions to transition between paragraphs.
   - Start sentences with "But", "And", or "So"—it mimics natural human internal monologue.
   - Use em-dashes (—) for abrupt shifts in thought, not just as list replacements.

5. **Linguistic "Surprise" (Perplexity):**
   - Occasionally use a very casual idiom in a formal context.
   - Avoid "balanced" lists (e.g., "X, Y, and Z"). Instead, use "X, Y, and even Z—if you can believe it."

### OUTPUT RULES:
- Return ONLY the humanized text.
- No conversational filler at the start or end.
- NO QUOTES around the response.
- Preserve all original facts, dates, and names—only destroy the "AI-ness" of the delivery.
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
        temperature=0.9, # Higher temperature for subjective variance and burstiness
        top_p=0.95,     # Allow for more surprising word choices (Perplexity)
    )

    for chunk in completion:
        token = chunk.choices[0].delta.content
        if token:
            yield token

