from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Any, Optional
from models.database import get_db
from models.db import Dataset, User, ApiKey
from services.auth import get_current_user
from services.credits import award_dataset_registration
from services.ipfs import pin_json
from services.storj import generate_presigned_upload_url
import json

router = APIRouter(prefix="/datasets", tags=["datasets"])

ALLOWED_FORMATS = {"fasta", "vcf"}


class DatasetUpdateIn(BaseModel):
    title:       Optional[str] = None
    description: Optional[str] = None


class RegisterIn(BaseModel):
    title:           str
    description:     str
    format_type:     str
    object_key:      Optional[str] = None   # Storj object key; None for features-only upload
    epsilon:         float
    feature_vector:  dict[str, float]
    feature_schema:  list[str]
    active_features: list[str]
    regions:         list[str]


@router.get("/presign")
def presign_upload(
    filename:    str = Query(..., description="Original filename (e.g. sample.vcf)"),
    format_type: str = Query(..., description="File format: fasta or vcf"),
    current_user: User = Depends(get_current_user),
):
    """
    Return a short-lived presigned PUT URL so the browser can upload a raw
    genomic file directly to Storj.  The server never touches the file content.
    """
    fmt = format_type.lower()
    if fmt not in ALLOWED_FORMATS:
        raise HTTPException(400, f"format_type must be one of: {', '.join(ALLOWED_FORMATS)}")

    try:
        result = generate_presigned_upload_url(filename, fmt)
    except RuntimeError as e:
        raise HTTPException(503, str(e))

    return result


@router.post("/register")
def register_dataset(
    body: RegisterIn,
    current_user: User = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """
    Called after the browser has uploaded the raw file to Storj.
    Accepts client-side feature extraction results, pins metadata to IPFS,
    and persists the dataset row.  The server never sees the raw genomic data.
    """
    fmt = body.format_type.lower()
    if fmt not in ALLOWED_FORMATS:
        raise HTTPException(400, f"format_type must be one of: {', '.join(ALLOWED_FORMATS)}")
    if current_user.role != "contributor":
        raise HTTPException(403, "Only contributors can register datasets")

    metadata_json = {
        "owner":           current_user.username,
        "title":           body.title,
        "description":     body.description,
        "format_type":     fmt,
        "object_key":      body.object_key,
        "feature_schema":  body.feature_schema,
        "active_features": body.active_features,
        "epsilon":         body.epsilon,
        "regions":         body.regions,
    }

    try:
        metadata_cid = pin_json(metadata_json, name=body.title)
    except Exception as e:
        raise HTTPException(502, f"IPFS pin failed: {e}")

    has_raw_file = bool(body.object_key)

    dataset = Dataset(
        owner_id        = current_user.id,
        title           = body.title,
        description     = body.description,
        format_type     = fmt,
        storj_key       = body.object_key,
        metadata_cid    = metadata_cid,
        feature_schema  = body.feature_schema,
        active_features = body.active_features,
        feature_vector  = body.feature_vector,
        sample_count    = 1,
        regions         = body.regions,
        has_raw_file    = has_raw_file,
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    award_dataset_registration(dataset, db)

    return {
        "dataset_id":      dataset.id,
        "metadata_cid":    metadata_cid,
        "active_features": body.active_features,
        "feature_count":   len(body.active_features),
        "has_raw_file":    has_raw_file,
        "epsilon":         body.epsilon,
    }


@router.get("/")
def list_datasets(
    format_type: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Dataset).filter(Dataset.is_active == True)
    if format_type:
        q = q.filter(Dataset.format_type == format_type)
    datasets = q.all()
    return [_dataset_summary(d) for d in datasets]


@router.get("/my")
def my_datasets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    datasets = db.query(Dataset).filter(Dataset.owner_id == current_user.id).all()
    return [_dataset_summary(d) for d in datasets]


@router.delete("/{dataset_id}")
def delete_dataset(
    dataset_id:   str,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    if dataset.owner_id != current_user.id:
        raise HTTPException(403, "Not your dataset")
    dataset.is_active = False
    db.query(ApiKey).filter(ApiKey.dataset_id == dataset_id).update({"is_active": False})
    db.commit()
    return {"message": "Dataset deleted"}


@router.patch("/{dataset_id}")
def update_dataset(
    dataset_id:   str,
    body:         DatasetUpdateIn,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    if dataset.owner_id != current_user.id:
        raise HTTPException(403, "Not your dataset")
    if body.title is not None and body.title != "":
        dataset.title = body.title
    if body.description is not None:
        dataset.description = body.description
    db.commit()
    db.refresh(dataset)
    return {
        "id":          dataset.id,
        "title":       dataset.title,
        "description": dataset.description,
        "format_type": dataset.format_type,
        "has_raw_file": dataset.has_raw_file,
        "is_active":   dataset.is_active,
        "created_at":  dataset.created_at.isoformat(),
    }


def _dataset_summary(d: Dataset) -> dict:
    return {
        "dataset_id":      d.id,
        "title":           d.title,
        "description":     d.description,
        "format_type":     d.format_type,
        "active_features": d.active_features,
        "feature_count":   len(d.active_features or []),
        "regions":         d.regions,
        "sample_count":    d.sample_count,
        "metadata_cid":    d.metadata_cid,
        "created_at":      d.created_at.isoformat(),
    }
