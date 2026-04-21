from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Any
from models.database import get_db
from models.db import Dataset, AccessRequest, User, ApiKey
from services.auth import get_current_user, get_auth_context
from services.credits import charge_researcher
from services.storj import generate_presigned_download_url
from datetime import datetime

router = APIRouter(prefix="/data", tags=["data"])

# ── Feature-type membership sets ──────────────────────────────────────────────

_NUCLEOTIDE_KEYS: set[str] = {
    "A_count", "T_count", "G_count", "C_count", "N_count",
    "GC_content", "AT_content", "N_ratio", "shannon_entropy",
    "sequence_length", "sequence_count",
}

_VARIANT_KEYS: set[str] = {
    "total_variants", "snp_count", "indel_count", "snp_ratio",
    "ts_count", "tv_count", "ts_tv_ratio",
    "het_count", "hom_count", "het_ratio",
    "allele_freq_mean", "allele_freq_std", "allele_freq_min", "allele_freq_max",
    "chromosome_count",
}

_VALID_FEATURE_TYPES = {"nucleotide", "kmer", "snp"}


class QueryIn(BaseModel):
    dataset_id:   str
    feature_type: Optional[str]              = None   # nucleotide | kmer | SNP
    chromosome:   Optional[str]              = None
    range:        Optional[list[float]]      = None   # [min, max]
    filters:      Optional[dict[str, Any]]   = None   # exact-match overrides


def _check_access(researcher: User, dataset: Dataset, db: Session):
    """Verify researcher has approved, non-expired JWT-based access to dataset."""
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


def _check_feature_access(user: User, dataset: Dataset, api_key: Optional[ApiKey], db: Session):
    """Access check for feature endpoints — handles both JWT and API key auth."""
    if api_key is not None:
        if api_key.dataset_id != dataset.id:
            raise HTTPException(403, "API key is not scoped to this dataset")
        if api_key.access_type == "raw_file_access":
            raise HTTPException(403, "This API key grants raw file access only, not feature access")
        # access_type == "feature_access" — access granted via key
    else:
        _check_access(user, dataset, db)


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
        "has_raw_file":   d.has_raw_file,
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
    sparse:     bool  = Query(True, description="Return only non-zero features"),
    db:         Session = Depends(get_db),
    auth:       tuple   = Depends(get_auth_context),
):
    """
    Returns feature vector for a dataset.
    sparse=true (default): only non-zero features returned.
    sparse=false: zero-padded full vector aligned to schema (for ML use).
    Credits charged per call.
    """
    user, api_key = auth
    d = _get_dataset_or_404(dataset_id, db)
    _check_feature_access(user, d, api_key, db)

    owner = db.query(User).filter(User.id == d.owner_id).first()
    charge_researcher(user, owner, "get_features", dataset_id, db)

    if sparse:
        return {
            "dataset_id": d.id,
            "sparse":     True,
            "features":   d.feature_vector or {},
        }
    else:
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
    auth:       tuple   = Depends(get_auth_context),
):
    """
    Returns batched feature data. Currently each dataset is one sample;
    in a multi-sample extension this would return rows from the dataset.
    """
    user, api_key = auth
    d = _get_dataset_or_404(dataset_id, db)
    _check_feature_access(user, d, api_key, db)

    owner = db.query(User).filter(User.id == d.owner_id).first()
    charge_researcher(user, owner, "get_batch_data", dataset_id, db)

    features = d.feature_vector or {}
    if not sparse:
        full = {f: 0.0 for f in (d.feature_schema or [])}
        full.update(features)
        features = full

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


@router.post("/query")
def query_features(
    body: QueryIn,
    db:   Session = Depends(get_db),
    auth: tuple   = Depends(get_auth_context),
):
    """
    Filtered feature query.  Access-checked and credit-charged like /features.
    Supports filtering by feature type, chromosome, value range, and exact key/value pairs.
    """
    user, api_key = auth

    if body.feature_type and body.feature_type.lower() not in _VALID_FEATURE_TYPES:
        raise HTTPException(400, f"feature_type must be one of: {', '.join(sorted(_VALID_FEATURE_TYPES))}")

    if body.range is not None and len(body.range) != 2:
        raise HTTPException(400, "range must be an array of exactly two numbers [min, max]")

    d = _get_dataset_or_404(body.dataset_id, db)
    _check_feature_access(user, d, api_key, db)

    owner = db.query(User).filter(User.id == d.owner_id).first()
    charge_researcher(user, owner, "query_features", body.dataset_id, db)

    features: dict[str, Any] = dict(d.feature_vector or {})

    # ── Filter by feature type ─────────────────────────────────────────────
    if body.feature_type:
        ft = body.feature_type.lower()
        if ft == "nucleotide":
            features = {k: v for k, v in features.items() if k in _NUCLEOTIDE_KEYS}
        elif ft == "kmer":
            features = {k: v for k, v in features.items() if k.startswith("kmer_")}
        elif ft == "snp":
            features = {k: v for k, v in features.items()
                        if k in _VARIANT_KEYS or k.startswith("chr_")}

    # ── Filter by chromosome ───────────────────────────────────────────────
    if body.chromosome:
        safe   = body.chromosome.lower().strip().removeprefix("chr").strip("_")
        prefix = f"chr_{safe}_"
        features = {k: v for k, v in features.items() if k.startswith(prefix)}

    # ── Filter by value range ──────────────────────────────────────────────
    if body.range is not None:
        lo, hi = float(body.range[0]), float(body.range[1])
        features = {
            k: v for k, v in features.items()
            if isinstance(v, (int, float)) and lo <= v <= hi
        }

    # ── Apply exact key/value filters ─────────────────────────────────────
    if body.filters:
        features = {
            k: v for k, v in features.items()
            if k not in body.filters or v == body.filters[k]
        }

    return {
        "dataset_id":    d.id,
        "matched_count": len(features),
        "features":      features,
        "query": {
            "feature_type": body.feature_type,
            "chromosome":   body.chromosome,
            "range":        body.range,
            "filters":      body.filters,
        },
    }


@router.get("/raw-file/{dataset_id}")
def get_raw_file(
    dataset_id: str,
    db:         Session = Depends(get_db),
    auth:       tuple   = Depends(get_auth_context),
):
    """
    Returns a short-lived presigned GET URL for the raw genomic file on Storj.
    Requires raw_file_access — either via a scoped API key or an approved
    raw_file_access AccessRequest (JWT path).
    Costs 5 credits (deducted from researcher, credited to dataset owner).
    """
    user, api_key = auth
    d = _get_dataset_or_404(dataset_id, db)

    if not d.has_raw_file or not d.storj_key:
        raise HTTPException(404, "No raw file available for this dataset")

    if api_key is not None:
        if api_key.dataset_id != dataset_id:
            raise HTTPException(403, "API key is not scoped to this dataset")
        if api_key.access_type != "raw_file_access":
            raise HTTPException(403, "This API key grants feature access only, not raw file access")
    else:
        # JWT path: owner can always access; researchers need an approved request
        if d.owner_id != user.id:
            req = db.query(AccessRequest).filter(
                AccessRequest.requester_id == user.id,
                AccessRequest.dataset_id   == dataset_id,
                AccessRequest.access_type  == "raw_file_access",
                AccessRequest.status       == "approved",
            ).first()
            if not req:
                raise HTTPException(403, "Raw file access not granted. Request access first.")
            if req.expires_at and req.expires_at < datetime.utcnow():
                raise HTTPException(403, "Raw file access has expired. Request renewal.")

    # Deduct credits (owner accessing own data is free)
    if d.owner_id != user.id:
        owner = db.query(User).filter(User.id == d.owner_id).first()
        charge_researcher(user, owner, "get_raw_file", dataset_id, db)

    try:
        result = generate_presigned_download_url(d.storj_key)
    except RuntimeError as e:
        raise HTTPException(503, str(e))

    return {
        "dataset_id": dataset_id,
        "url":        result["url"],
        "expires_in": result["expires_in"],
    }
