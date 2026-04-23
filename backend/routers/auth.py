from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta

import models
import schemas
from database import get_db
from security import hash_password, verify_password, create_access_token, get_current_user
from config import ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY, ALGORITHM
from jose import jwt, JWTError
from email_utils import send_password_reset_email

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=schemas.Token, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserRegister, db: Session = Depends(get_db)):
    """Create a new user account and return a JWT."""
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(models.User).filter(models.User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    user = models.User(
        email=payload.email,
        username=payload.username,
        password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(
        user_id=user.id,
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    """Authenticate and return a JWT."""
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    token = create_access_token(
        user_id=user.id,
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return current_user


@router.post("/forgot-password")
def forgot_password(payload: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Generate a password reset token and return a link (simulated email)."""
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        # Avoid user enumeration by returning success anyway
        return {"message": "If that email exists, a reset link has been sent."}

    # Create a short-lived reset token (15 minutes)
    reset_token = create_access_token(
        user_id=user.id,
        expires_delta=timedelta(minutes=15)
    )

    # Create the reset link
    reset_link = f"http://localhost:3000/reset-password?token={reset_token}"

    # Send the actual email
    success = send_password_reset_email(user.email, reset_link)
    
    if not success:
        return {
            "message": "Password reset link generated, but email failed to send.",
            "debug_link": reset_link if not success else None # Keep debug link if email fails for testing
        }

    return {
        "message": "Password reset link sent to your email.",
    }


@router.post("/reset-password")
def reset_password(payload: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    """Verify reset token and update the user's password."""
    try:
        # Decode token to get user_id
        decoded_payload = jwt.decode(payload.token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: str = decoded_payload.get("sub")
        if user_id_str is None:
            raise HTTPException(status_code=400, detail="Invalid reset token")
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update password
    user.password = hash_password(payload.new_password)
    db.commit()

    return {"message": "Password has been successfully reset."}
