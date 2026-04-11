from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from models.database import get_db
from models.db import User, CreditTransaction, QueryLog
from services.auth import get_current_user

router = APIRouter(prefix="/credits", tags=["credits"])


@router.get("/balance")
def get_balance(user: User = Depends(get_current_user)):
    return {
        "user_id":  user.id,
        "username": user.username,
        "credits":  round(user.credits, 2),
        "earnings": round(user.earnings, 2),
    }


@router.get("/history")
def get_history(
    limit: int = 20,
    db:    Session = Depends(get_db),
    user:  User    = Depends(get_current_user),
):
    txns = (
        db.query(CreditTransaction)
        .filter(CreditTransaction.user_id == user.id)
        .order_by(CreditTransaction.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "amount":     round(t.amount, 2),
            "reason":     t.reason,
            "related_id": t.related_id,
            "timestamp":  t.created_at.isoformat(),
        }
        for t in txns
    ]


@router.get("/query_logs")
def get_query_logs(
    limit: int = 20,
    db:    Session = Depends(get_db),
    user:  User    = Depends(get_current_user),
):
    logs = (
        db.query(QueryLog)
        .filter(QueryLog.user_id == user.id)
        .order_by(QueryLog.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "dataset_id":   l.dataset_id,
            "endpoint":     l.endpoint,
            "credits_used": l.credits_used,
            "timestamp":    l.timestamp.isoformat(),
        }
        for l in logs
    ]
