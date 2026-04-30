from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from models.database import get_db
from models.db import AccessRequest, Dataset, User, ApiKey
from services.auth import get_current_user, generate_api_key
from datetime import datetime, timedelta

router = APIRouter(prefix="/access", tags=["access"])


class RequestIn(BaseModel):
    dataset_id:  str
    purpose:     str
    access_type: str = "feature_access"   # feature_access | raw_file_access

class DecisionIn(BaseModel):
    request_id: str
    decision:   str   # approved | rejected
    days_valid: int = 30


@router.post("/request")
def request_access(
    body: RequestIn,
    db:   Session = Depends(get_db),
    user = Depends(get_current_user),
):
    if body.access_type not in ("feature_access", "raw_file_access"):
        raise HTTPException(400, "access_type must be feature_access or raw_file_access")

    dataset = db.query(Dataset).filter(Dataset.id == body.dataset_id).first()
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    if user.role != "researcher":
        raise HTTPException(403, "Only researchers can request access")
    if dataset.owner_id == user.id:
        raise HTTPException(400, "You own this dataset")
    if body.access_type == "raw_file_access" and not dataset.has_raw_file:
        raise HTTPException(400, "This dataset has no raw file available")

    existing = db.query(AccessRequest).filter(
        AccessRequest.requester_id == user.id,
        AccessRequest.dataset_id   == body.dataset_id,
        AccessRequest.access_type  == body.access_type,
        AccessRequest.status       == "pending",
    ).first()
    if existing:
        raise HTTPException(409, "Access request already pending")

    req = AccessRequest(
        requester_id=user.id,
        dataset_id=body.dataset_id,
        purpose=body.purpose,
        access_type=body.access_type,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return {"request_id": req.id, "status": req.status, "access_type": req.access_type}


@router.post("/decide")
def decide_request(
    body: DecisionIn,
    db:   Session = Depends(get_db),
    user = Depends(get_current_user),
):
    req = db.query(AccessRequest).filter(AccessRequest.id == body.request_id).first()
    if not req:
        raise HTTPException(404, "Request not found")

    dataset = db.query(Dataset).filter(Dataset.id == req.dataset_id).first()
    if dataset.owner_id != user.id:
        raise HTTPException(403, "Only the dataset owner can decide")
    if body.decision not in ("approved", "rejected"):
        raise HTTPException(400, "decision must be approved or rejected")

    req.status     = body.decision
    req.updated_at = datetime.utcnow()

    api_key_response = None
    if body.decision == "approved":
        req.expires_at = datetime.utcnow() + timedelta(days=body.days_valid)

        # Auto-generate a scoped API key for the requester
        raw_key, key_hash, key_prefix = generate_api_key()
        api_key = ApiKey(
            user_id     = req.requester_id,
            dataset_id  = req.dataset_id,
            access_type = req.access_type,
            key_hash    = key_hash,
            key_prefix  = key_prefix,
            name        = f"{dataset.title} - {req.access_type}",
        )
        db.add(api_key)
        db.flush()                          # populate api_key.id before commit
        req.approved_key_id = api_key.id
        req.pending_key     = raw_key
        api_key_response = {"key_prefix": key_prefix}

    db.commit()

    result = {
        "request_id": req.id,
        "status":     req.status,
        "expires_at": req.expires_at.isoformat() if req.expires_at else None,
    }
    if api_key_response:
        result.update(api_key_response)
    return result


@router.get("/incoming")
def incoming_requests(
    db:   Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """Requests made to the current user's datasets."""
    my_dataset_ids = [d.id for d in db.query(Dataset).filter(Dataset.owner_id == user.id).all()]
    reqs = db.query(AccessRequest).filter(AccessRequest.dataset_id.in_(my_dataset_ids)).all()
    return [_fmt(r, db) for r in reqs]


@router.get("/outgoing")
def outgoing_requests(
    db:   Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """Requests the current user has made."""
    reqs = db.query(AccessRequest).filter(AccessRequest.requester_id == user.id).all()
    return [_fmt(r, db) for r in reqs]


def _fmt(r: AccessRequest, db: Session) -> dict:
    dataset   = db.query(Dataset).filter(Dataset.id == r.dataset_id).first()
    requester = db.query(User).filter(User.id == r.requester_id).first()
    return {
        "request_id":    r.id,
        "dataset_id":    r.dataset_id,
        "dataset_title": dataset.title if dataset else "Unknown",
        "requester":     requester.username if requester else "Unknown",
        "owner_id":      dataset.owner_id if dataset else None,
        "requester_id":  r.requester_id,
        "purpose":       r.purpose,
        "access_type":   r.access_type,
        "status":        r.status,
        "expires_at":    r.expires_at.isoformat() if r.expires_at else None,
        "created_at":    r.created_at.isoformat(),
    }

@router.post("/{request_id}/reissue-key")
def reissue_key(
    request_id: str,
    db:   Session = Depends(get_db),
    user = Depends(get_current_user),
):
    access_request = db.query(AccessRequest).filter(AccessRequest.id == request_id).first()
    if not access_request:
        raise HTTPException(404, "Access request not found")
    if access_request.requester_id != user.id:
        raise HTTPException(403, "You can only reissue keys for your own approved requests")
    if access_request.status != "approved":
        raise HTTPException(400, "Access must be approved before a key can be reissued")

    dataset = db.query(Dataset).filter(Dataset.id == access_request.dataset_id).first()

    existing_key = db.query(ApiKey).filter(
        ApiKey.user_id     == user.id,
        ApiKey.dataset_id  == access_request.dataset_id,
        ApiKey.access_type == access_request.access_type,
        ApiKey.is_active   == True,
    ).first()
    if existing_key:
        existing_key.is_active = False

    raw_key, key_hash, key_prefix = generate_api_key()
    api_key = ApiKey(
        user_id     = user.id,
        dataset_id  = access_request.dataset_id,
        access_type = access_request.access_type,
        key_hash    = key_hash,
        key_prefix  = key_prefix,
        name        = f"{dataset.title} - {access_request.access_type}",
    )
    db.add(api_key)
    db.flush()

    access_request.pending_key     = raw_key
    access_request.approved_key_id = api_key.id
    db.commit()

    return {
        "message":     "New key issued successfully",
        "key":         raw_key,
        "key_prefix":  key_prefix,
        "dataset_id":  access_request.dataset_id,
        "access_type": access_request.access_type,
    }


@router.get("/{request_id}/claim-key")
def claim_key(
    request_id: str,
    db:   Session = Depends(get_db),
    user = Depends(get_current_user),
):
    req = db.query(AccessRequest).filter(AccessRequest.id == request_id).first()
    if not req:
        raise HTTPException(404, "Request not found")
    if req.requester_id != user.id:
        raise HTTPException(403, "Only the requester can claim the key")
    
    dataset = db.query(Dataset).filter(Dataset.id == req.dataset_id).first()
    title = dataset.title if dataset else "Unknown"

    if req.pending_key is not None:
        key = req.pending_key
        req.pending_key = None
        db.commit()
        return {
            "key": key,
            "dataset_id": req.dataset_id,
            "access_type": req.access_type,
            "dataset_title": title
        }
    
    return {"key": None, "message": "Key already claimed or not available"}
