from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from models.database import get_db
from models.db import User, ApiKey, Dataset
from services.auth import hash_password, verify_password, create_token, get_current_user
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


@router.get("/my-keys")
def list_my_keys(
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """List all active API keys for the authenticated user, including dataset info."""
    keys = (
        db.query(ApiKey)
        .filter(ApiKey.user_id == current_user.id, ApiKey.is_active == True)
        .order_by(ApiKey.created_at.desc())
        .all()
    )
    return [
        {
            "id":            k.id,
            "name":          k.name,
            "key_prefix":    k.key_prefix,
            "dataset_id":    k.dataset_id,
            "dataset_title": k.dataset.title if k.dataset else None,
            "access_type":   k.access_type,
            "created_at":    k.created_at.isoformat(),
            "last_used_at":  k.last_used_at.isoformat() if k.last_used_at else None,
        }
        for k in keys
    ]


@router.delete("/api-keys/{key_id}")
def revoke_api_key(
    key_id:       str,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """
    Revoke an API key. Only the dataset OWNER (contributor) may revoke keys
    scoped to their dataset — not the key holder themselves.
    """
    api_key = db.query(ApiKey).filter(ApiKey.id == key_id, ApiKey.is_active == True).first()
    if not api_key:
        raise HTTPException(404, "API key not found or already revoked")

    dataset = db.query(Dataset).filter(Dataset.id == api_key.dataset_id).first()
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    if dataset.owner_id != current_user.id:
        raise HTTPException(403, "Only the dataset owner can revoke this key")

    api_key.is_active = False
    db.commit()
    return {"message": "Key revoked"}
