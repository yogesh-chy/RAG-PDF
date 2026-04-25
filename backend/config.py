import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.getenv(
    "DATABASE_URL", "postgresql+psycopg://postgres:password@localhost:5432/ragpdf"
)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
SECRET_KEY: str = os.getenv("SECRET_KEY", "change-this-secret-key")
ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
)

# CORS
ALLOWED_ORIGINS: list = os.getenv(
    "ALLOWED_ORIGINS", 
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"
).split(",")

# SMTP Config
SMTP_HOST: str = os.getenv("EMAIL_HOST", "smtp.gmail.com")
SMTP_PORT: int = int(os.getenv("EMAIL_PORT", "587"))
SMTP_USER: str = os.getenv("EMAIL_HOST_USER", "")
SMTP_PASS: str = os.getenv("EMAIL_HOST_PASSWORD", "")
SMTP_FROM: str = os.getenv("DEFAULT_FROM_EMAIL", "NexusAI <noreply@nexusai.com>")

# Embedding config
EMBEDDING_MODEL = "models/gemini-embedding-001"
EMBEDDING_DIMENSIONS = 768

# Chat models
CHAT_MODEL = "models/gemini-1.5-flash"
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# Chunking strategy
CHUNK_SIZE = 500       # words per chunk
CHUNK_OVERLAP = 50     # word overlap between consecutive chunks
TOP_K_CHUNKS = 5       # how many chunks to retrieve per query
