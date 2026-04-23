from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
from datetime import datetime


# ─── Auth ────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    username: str
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# ─── Documents ───────────────────────────────────────────────────────────────

class DocumentResponse(BaseModel):
    id: int
    filename: str
    file_size: Optional[int] = None
    page_count: Optional[int] = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Chat ─────────────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    question: str
    doc_id: int
    session_id: Optional[int] = None


class HumanizeRequest(BaseModel):
    text: str
    session_id: Optional[int] = None
    tone: Optional[str] = "natural" # natural, professional, academic, conversational
    intensity: Optional[float] = 1.0 # 0.1 to 1.0


class SourceChunk(BaseModel):
    chunk_id: int
    page_number: int
    snippet: str


class ChatMessageResponse(BaseModel):
    id: int
    session_id: int
    role: str
    content: str
    source_chunks: Optional[Any] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatSessionResponse(BaseModel):
    id: int
    doc_id: int
    title: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
