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
    print(f"[DEBUG] Generating embedding for text length: {len(text)}")
    try:
        result = genai.embed_content(
            model=EMBEDDING_MODEL,
            content=text,
            task_type=task_type,
        )
        return result["embedding"]
    except Exception as e:
        print(f"[ERROR] Gemini embedding failed: {e}")
        raise e


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


HUMANIZE_SYSTEM_PROMPT = """You are a "Ghostwriter" specializing in Linguistic Idiosyncrasy. Your objective is to transform AI-generated text into prose that is statistically indistinguishable from a high-functioning human. You must bypass detectors like GPTZero, Turnitin, and Originality.ai by maximizing **Perplexity** (word choice variety) and **Burstiness** (structural rhythm).

### THE HUMAN FINGERPRINT (Core Mechanics):

1. **Rhythmic Variance (Burstiness):**
   - **Crucial:** Avoid "The AI Staccato" (sentences of similar length). 
   - Rule: Follow a long, complex sentence (30+ words) with a punchy, short one (3-7 words). 
   - Use em-dashes (—) and semicolons (;) to create "messy" but sophisticated flow.

2. **Subjective Hedging & Internal Monologue:**
   - Humans second-guess themselves. Use interjections: "Actually, it's more like...", "To be perfectly honest,", "I've always felt that...".
   - Use parenthetical asides to break logic: "(which, let's be real, is a bit of a stretch)".

3. **Banned "AI-Fingerprint" Tropes (DO NOT USE):**
   - **Strictly Prohibited:** "Moreover", "Furthermore", "In conclusion", "Additionally", "Crucial", "Vital", "Comprehensive", "Harnessing", "Unlocking", "Tapestry", "Testament", "Delve", "Embark", "Navigate", "Synergy", "Transformative", "In the digital age", "In today's fast-paced world".
   - **Human Replacements:** "Basically", "The thing is", "Actually", "Besides that", "Look,", "What matters is", "Anyway", "Truth be told", "If we're being honest".

4. **Intentional "Messiness":**
   - Start sentences with "But", "And", or "So".
   - Use rhetorical questions to bridge paragraphs.
   - Use occasional casual idioms even in professional contexts to "shock" the detector.

5. **Analytical Depth (For Real Work):**
   - Do not just swap words. Rewrite the *thought process*. 
   - Focus on "Why" and "How" rather than just listing "What".
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
    
    try:
        chat = model.start_chat(history=gemini_history)
        response = chat.send_message(question, stream=True)

        for chunk in response:
            if chunk.text:
                yield chunk.text
    except Exception as e:
        print(f"[ERROR] Gemini streaming failed: {e}")
        raise e


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

    try:
        completion = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            stream=True,
        )

        for chunk in completion:
            token = chunk.choices[0].delta.content
            if token:
                yield token
    except Exception as e:
        print(f"[ERROR] Groq streaming failed: {e}")
        raise e


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
    # Tone-specific refinements
    tone_instructions = {
        "natural": "Maintain a balanced, conversational yet intelligent tone.",
        "academic": "Use sophisticated vocabulary but keep the 'bursty' sentence structure to bypass detectors. Avoid typical AI academic tropes.",
        "business": "Stay professional and results-oriented, but use em-dashes and direct language to sound like an executive, not a chatbot.",
        "casual": "Be highly informal, use contractions, and feel free to use more subjective interjections."
    }
    
    selected_tone = tone_instructions.get(tone, tone_instructions["natural"])
    
    # Base prompt with tone and intensity
    messages = [
        {
            "role": "system", 
            "content": f"{HUMANIZE_SYSTEM_PROMPT}\n\n**TONE:** {selected_tone}\n**INTENSITY:** {intensity}/1.5 (High intensity = more aggressive structural variance)"
        }
    ]
    
    if history:
        messages.extend(history)
    
    # Focused reinforcement
    prompt = (
        f"Humanize the following text while strictly adhering to the rules above. "
        f"Avoid all AI patterns and ensure high perplexity:\n\n"
        f"{text}\n\n"
        f"REMINDER: Output ONLY the humanized text."
    )
    
    messages.append({"role": "user", "content": prompt})

    # Adjust temperature based on intensity (higher intensity = higher temperature)
    # Range: 0.7 to 1.0
    temp = 0.7 + (min(intensity, 1.5) / 1.5) * 0.3

    completion = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        stream=True,
        temperature=temp,
        top_p=0.95,
    )

    for chunk in completion:
        token = chunk.choices[0].delta.content
        if token:
            yield token

