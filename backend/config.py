import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.getenv(
    "DATABASE_URL", "postgresql+psycopg://postgres:password@localhost:5432/ragpdf"
)
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
SECRET_KEY: str = os.getenv("SECRET_KEY", "change-this-secret-key")
ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
)

# Embedding config — text-embedding-004 produces 768-dim vectors
EMBEDDING_MODEL = "models/text-embedding-004"
EMBEDDING_DIMENSIONS = 768

# Chat model
CHAT_MODEL = "gemini-2.0-flash"

# Chunking strategy
CHUNK_SIZE = 500       # words per chunk
CHUNK_OVERLAP = 50     # word overlap between consecutive chunks
TOP_K_CHUNKS = 5       # how many chunks to retrieve per query
