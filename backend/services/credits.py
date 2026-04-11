from sqlalchemy.orm import Session
from models.db import User, CreditTransaction, QueryLog
from datetime import datetime


COSTS = {
    "get_features":    1.0,
    "get_batch_data":  2.0,
    "get_dataset_info": 0.0,
    "get_feature_schema": 0.0,
}

SIGNUP_BONUS = 10.0


def award_signup_bonus(user: User, db: Session):
    user.credits += SIGNUP_BONUS
    db.add(CreditTransaction(
        user_id=user.id, amount=SIGNUP_BONUS,
        reason="signup_bonus"
    ))
    db.commit()


def charge_researcher(
    researcher: User,
    dataset_owner: User,
    endpoint: str,
    dataset_id: str,
    db: Session
) -> float:
    cost = COSTS.get(endpoint, 1.0)
    if cost == 0:
        return 0.0

    if researcher.credits < cost:
        from fastapi import HTTPException
        raise HTTPException(status_code=402, detail="Insufficient credits")

    researcher.credits    -= cost
    dataset_owner.credits += cost
    dataset_owner.earnings += cost

    db.add(CreditTransaction(user_id=researcher.id,      amount=-cost,  reason=f"api_call:{endpoint}", related_id=dataset_id))
    db.add(CreditTransaction(user_id=dataset_owner.id,   amount=cost,   reason=f"data_used:{endpoint}", related_id=dataset_id))
    db.add(QueryLog(user_id=researcher.id, dataset_id=dataset_id, endpoint=endpoint, credits_used=cost))

    db.commit()
    return cost
