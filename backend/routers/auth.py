from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from models.database import get_db
from models.db import User, ApiKey
from services.auth import hash_password, verify_password, create_token, get_current_user, generate_api_key
from services.credits import award_signup_bonus

router = APIRouter(prefix="/auth", tags=["auth"])


VALID_ROLES = ("contributor", "researcher")


class RegisterIn(BaseModel):
    email:    EmailStr
    username: str
    password: str
    role:     str   # contributor | researcher

class LoginIn(BaseModel):
    email:    EmailStr
    password: str

class RoleIn(BaseModel):
    role: str

class ApiKeyIn(BaseModel):
    name: str


@router.post("/register")
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if body.role not in VALID_ROLES:
        raise HTTPException(400, "role must be contributor or researcher")
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(409, "Email already registered")
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(409, "Username already taken")

    user = User(
        email=body.email,
        username=body.username,
        hashed_pw=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    award_signup_bonus(user, db)

    return {"message": "Account created", "user_id": user.id, "role": user.role,
            "token": create_token(user.id, user.role)}


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_pw):
        raise HTTPException(401, "Invalid credentials")
    return {"token": create_token(user.id, user.role),
            "user": {"id": user.id, "username": user.username, "role": user.role,
                     "credits": user.credits, "earnings": user.earnings}}


@router.patch("/role")
def switch_role(
    body:         RoleIn,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    if body.role not in VALID_ROLES:
        raise HTTPException(400, "role must be contributor or researcher")
    if body.role == current_user.role:
        raise HTTPException(400, "Already using that role")
    current_user.role = body.role
    db.commit()
    db.refresh(current_user)
    return {
        "token": create_token(current_user.id, current_user.role),
        "user":  {
            "id":       current_user.id,
            "username": current_user.username,
            "role":     current_user.role,
            "credits":  current_user.credits,
            "earnings": current_user.earnings,
        },
    }


@router.post("/api-keys", status_code=201)
def create_api_key(
    body:         ApiKeyIn,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """
    Generate a new API key for the authenticated user.
    The raw key is returned once — it is never stored and cannot be recovered.
    """
    if not body.name.strip():
        raise HTTPException(400, "Key name cannot be blank")
    raw_key, key_hash, key_prefix = generate_api_key()
    api_key = ApiKey(
        user_id    = current_user.id,
        key_hash   = key_hash,
        key_prefix = key_prefix,
        name       = body.name.strip(),
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    return {
        "id":         api_key.id,
        "name":       api_key.name,
        "key_prefix": api_key.key_prefix,
        "key":        raw_key,           # shown once — client must save it
        "created_at": api_key.created_at.isoformat(),
    }


@router.get("/api-keys")
def list_api_keys(
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """List all active API keys for the authenticated user (no raw key values)."""
    keys = (
        db.query(ApiKey)
        .filter(ApiKey.user_id == current_user.id, ApiKey.is_active == True)
        .order_by(ApiKey.created_at.desc())
        .all()
    )
    return [
        {
            "id":           k.id,
            "name":         k.name,
            "key_prefix":   k.key_prefix,
            "created_at":   k.created_at.isoformat(),
            "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
        }
        for k in keys
    ]
