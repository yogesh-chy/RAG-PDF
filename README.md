# ⚡ NexusAI

An all-in-one AI productivity suite — chat with PDF documents using advanced RAG, humanize AI-generated text, and more. Powered by **Google Gemini**, **Groq**, **FastAPI**, and **LanceDB**.

---

## 🌟 Features

- **Chat with PDFs**: Upload documents and ask questions — powered by semantic vector search via LanceDB.
- **AI Text Humanizer**: Rewrite AI-generated text to sound natural and bypass detection.
- **RAG Pipeline**: Semantic search using LanceDB for high-performance vector retrieval.
- **AI Chat**: Conversational memory and near-instant streaming answers powered by **Groq (Llama 3)**.
- **User Auth**: Secure JWT-based authentication and document ownership.
- **Premium UI**: Modern, dark-themed frontend built with Next.js.

---

## 🛠️ Tech Stack

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/)
- **Vector DB**: [LanceDB](https://lancedb.com/) (Embedded, No-overhead vector storage)
- **Metadata DB**: [PostgreSQL](https://www.postgresql.org/) (User accounts & Chat history)
- **AI Models**: 
  - **Embeddings**: Google Gemini (`models/gemini-embedding-001`)
  - **Chat Generation**: [Groq](https://groq.com/) (`llama-3.3-70b-versatile`)
- **Parsing**: [PyMuPDF](https://pymupdf.readthedocs.io/)

### Frontend
- **Framework**: [Next.js](https://nextjs.org/)
- **Styling**: Tailwind CSS / Vanilla CSS

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.12 or 3.13
- Node.js & npm
- PostgreSQL running locally

### 2. Backend Setup
```bash
cd backend
python -m venv venv
# Windows
.\venv\Scripts\activate
# Linux/macOS
source venv/bin/activate

pip install -r requirements.txt
```

#### Environment Variables (`backend/.env`)
Create a `.env` file in the `backend` folder:
```env
DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/ragpdf
GOOGLE_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
SECRET_KEY=your_jwt_secret
```

#### Run Backend
```bash
fastapi dev main.py
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 📁 Project Structure

```text
├── backend/            # FastAPI source code
│   ├── routers/        # API endpoints (Auth, Chat, Docs)
│   ├── models.py       # SQL Alchemy models
│   ├── embeddings.py   # AI & Parsing logic
│   └── lancedb_data/   # Local vector storage (Ignored)
├── frontend/           # Next.js source code
└── .gitignore          # Root safety ignore rules
```

---

## 🛡️ Security Note
Sensitive files like `.env`, `venv/`, and `lancedb_data/` are included in `.gitignore` to prevent credential leakage. Always keep your Google API Key private.

---

## 📄 License
MIT
