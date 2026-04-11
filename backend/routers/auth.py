from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from models.database import get_db
from models.db import User
from services.auth import hash_password, verify_password, create_token
from services.credits import award_signup_bonus

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterIn(BaseModel):
    email:    EmailStr
    username: str
    password: str
    role:     str   # contributor | researcher

class LoginIn(BaseModel):
    email:    EmailStr
    password: str


@router.post("/register")
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if body.role not in ("contributor", "researcher"):
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
