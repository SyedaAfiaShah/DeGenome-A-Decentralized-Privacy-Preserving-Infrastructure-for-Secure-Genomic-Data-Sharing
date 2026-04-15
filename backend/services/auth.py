import bcrypt
import hashlib
import secrets
from jose import JWTError, jwt
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from models.database import get_db
from models.db import User, ApiKey
import os
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET    = os.getenv("JWT_SECRET", "change-this-in-production")
ALGORITHM     = "HS256"
ACCESS_EXPIRE = 60 * 24  # 24 hours in minutes

bearer  = HTTPBearer()


def hash_password(plain: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(plain.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_EXPIRE)
    return jwt.encode({"sub": user_id, "role": role, "exp": expire}, JWT_SECRET, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


# ── API key helpers ────────────────────────────────────────────────────────────

def generate_api_key() -> tuple[str, str, str]:
    """Return (raw_key, key_hash, key_prefix).
    raw_key  — shown to the user once, never stored.
    key_hash — SHA-256 hex digest stored in DB for constant-time lookup.
    key_prefix — first 11 chars ('dg_' + 8 hex) shown in key listings.
    """
    raw    = "dg_" + secrets.token_hex(24)
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    return raw, hashed, raw[:11]

def hash_api_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


# ── Unified auth dependency ────────────────────────────────────────────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db)
) -> User:
    token = credentials.credentials

    if token.startswith("dg_"):
        # API key path — look up by SHA-256 hash
        key_hash = hash_api_key(token)
        api_key  = db.query(ApiKey).filter(
            ApiKey.key_hash  == key_hash,
            ApiKey.is_active == True,
        ).first()
        if not api_key:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid or revoked API key")
        api_key.last_used_at = datetime.utcnow()
        db.commit()
        user = db.query(User).filter(User.id == api_key.user_id).first()
    else:
        # JWT path
        payload = decode_token(token)
        user    = db.query(User).filter(User.id == payload["sub"]).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def require_role(role: str):
    def checker(user: User = Depends(get_current_user)):
        if user.role != role:
            raise HTTPException(status_code=403, detail=f"This action requires role: {role}")
        return user
    return checker
