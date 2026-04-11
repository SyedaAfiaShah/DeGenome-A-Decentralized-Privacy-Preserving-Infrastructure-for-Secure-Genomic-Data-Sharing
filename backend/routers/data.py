from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from models.database import get_db
from models.db import Dataset, AccessRequest, User
from services.auth import get_current_user
from services.credits import charge_researcher
from datetime import datetime

router = APIRouter(prefix="/data", tags=["data"])


def _check_access(researcher: User, dataset: Dataset, db: Session):
    """Verify researcher has approved, non-expired access to dataset."""
    if dataset.owner_id == researcher.id:
        return  # owner always has access
    req = db.query(AccessRequest).filter(
        AccessRequest.requester_id == researcher.id,
        AccessRequest.dataset_id   == dataset.id,
        AccessRequest.status       == "approved",
    ).first()
    if not req:
        raise HTTPException(403, "Access not granted. Request access first.")
    if req.expires_at and req.expires_at < datetime.utcnow():
        raise HTTPException(403, "Access has expired. Request renewal.")


def _get_dataset_or_404(dataset_id: str, db: Session) -> Dataset:
    d = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.is_active == True).first()
    if not d:
        raise HTTPException(404, "Dataset not found")
    return d


@router.get("/info")
def get_dataset_info(
    dataset_id: str,
    db:         Session = Depends(get_db),
    user:       User    = Depends(get_current_user),
):
    """Public dataset metadata — no credits charged, no access check."""
    d = _get_dataset_or_404(dataset_id, db)
    return {
        "dataset_id":     d.id,
        "title":          d.title,
        "description":    d.description,
        "format_type":    d.format_type,
        "sample_count":   d.sample_count,
        "regions":        d.regions,
        "feature_count":  len(d.active_features or []),
        "metadata_cid":   d.metadata_cid,
        "created_at":     d.created_at.isoformat(),
    }


@router.get("/schema")
def get_feature_schema(
    dataset_id: str,
    db:         Session = Depends(get_db),
    user:       User    = Depends(get_current_user),
):
    """
    Returns full feature schema — all possible features for this dataset,
    indicating which are active (non-zero) and which are absent.
    Free endpoint — needed for ML alignment.
    """
    d = _get_dataset_or_404(dataset_id, db)
    active_set = set(d.active_features or [])
    full_schema = [
        {"feature": f, "active": f in active_set}
        for f in (d.feature_schema or [])
    ]
    return {
        "dataset_id":       d.id,
        "format_type":      d.format_type,
        "total_features":   len(full_schema),
        "active_count":     len(active_set),
        "schema":           full_schema,
    }


@router.get("/features")
def get_features(
    dataset_id: str,
    sparse:     bool = Query(True, description="Return only non-zero features"),
    db:         Session = Depends(get_db),
    user:       User    = Depends(get_current_user),
):
    """
    Returns feature vector for a dataset.
    sparse=true (default): only non-zero features returned.
    sparse=false: zero-padded full vector aligned to schema (for ML use).
    Credits charged per call.
    """
    d = _get_dataset_or_404(dataset_id, db)
    _check_access(user, d, db)

    owner = db.query(User).filter(User.id == d.owner_id).first()
    charge_researcher(user, owner, "get_features", dataset_id, db)

    if sparse:
        return {
            "dataset_id": d.id,
            "sparse":     True,
            "features":   d.feature_vector or {},
        }
    else:
        # Zero-pad to full schema
        full = {f: 0.0 for f in (d.feature_schema or [])}
        full.update(d.feature_vector or {})
        return {
            "dataset_id": d.id,
            "sparse":     False,
            "features":   full,
        }


@router.get("/batch")
def get_batch_data(
    dataset_id: str,
    batch_size: int  = Query(10, ge=1, le=50),
    offset:     int  = Query(0, ge=0),
    sparse:     bool = Query(True),
    db:         Session = Depends(get_db),
    user:       User    = Depends(get_current_user),
):
    """
    Returns batched feature data. Currently each dataset is one sample;
    in a multi-sample extension this would return rows from the dataset.
    """
    d = _get_dataset_or_404(dataset_id, db)
    _check_access(user, d, db)

    owner = db.query(User).filter(User.id == d.owner_id).first()
    charge_researcher(user, owner, "get_batch_data", dataset_id, db)

    features = d.feature_vector or {}
    if not sparse:
        full = {f: 0.0 for f in (d.feature_schema or [])}
        full.update(features)
        features = full

    # Simulate batch: return [batch_size] copies with minor noise (realistic for PoC)
    import random
    batch = []
    for i in range(min(batch_size, d.sample_count)):
        sample = {k: round(v + random.gauss(0, 0.001), 6) if isinstance(v, float) else v
                  for k, v in features.items()}
        batch.append(sample)

    return {
        "dataset_id":  d.id,
        "batch_size":  len(batch),
        "offset":      offset,
        "total":       d.sample_count,
        "sparse":      sparse,
        "data":        batch,
    }
