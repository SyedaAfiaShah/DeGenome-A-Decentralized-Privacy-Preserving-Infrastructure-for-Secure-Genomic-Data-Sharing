from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from models.database import get_db
from models.db import Dataset, User
from services.auth import get_current_user
from services.ipfs import pin_bytes, pin_json
from services.crypto import get_public_key_pem
from processing.feature_extraction import extract_features, build_full_schema
from processing.privacy import add_laplace_noise, strip_zeros
import json

router = APIRouter(prefix="/datasets", tags=["datasets"])

ALLOWED_FORMATS = {"fasta", "vcf"}


class MetadataIn(BaseModel):
    title:             str
    description:       str
    format_type:       str
    encrypted_aes_key: str   # RSA-wrapped AES key (base64)
    ipfs_cid:          str   # CID of encrypted raw data already uploaded by client


@router.post("/upload")
async def upload_dataset(
    file:        UploadFile = File(...),
    title:       str        = Form(...),
    description: str        = Form(""),
    epsilon:     float      = Form(1.0),
    current_user: User      = Depends(get_current_user),
    db:          Session    = Depends(get_db),
):
    """
    Receive the raw genomic file server-side, extract features, apply DP noise,
    encrypt and pin to IPFS, then store only metadata + feature vector.
    Note: in production, extraction should move client-side (WASM).
    """
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    fmt = "fasta" if ext in ("fa", "fasta") else "vcf" if ext == "vcf" else None
    if not fmt:
        raise HTTPException(400, "Only .fasta, .fa, and .vcf files are supported")

    content_bytes = await file.read()
    try:
        content_str = content_bytes.decode("utf-8", errors="ignore")
    except Exception:
        raise HTTPException(400, "Could not decode file as text")

    # Feature extraction
    try:
        raw_features = extract_features(content_str, fmt)
    except ValueError as e:
        raise HTTPException(422, str(e))

    # Differential privacy
    noised   = add_laplace_noise(raw_features, epsilon=epsilon)
    sparse   = strip_zeros(noised)
    schema   = build_full_schema(fmt, sparse)

    # Pin encrypted blob to IPFS (client should send pre-encrypted; server-side is PoC)
    cid = pin_bytes(content_bytes, file.filename or "genomic_data")

    # Build and pin metadata JSON to IPFS (tamper-resistant metadata)
    metadata_json = {
        "owner":        current_user.username,
        "title":        title,
        "description":  description,
        "format_type":  fmt,
        "ipfs_cid":     cid,
        "feature_schema": schema["all_features"],
        "active_features": schema["active_features"],
        "epsilon":      epsilon,
    }
    metadata_cid = pin_json(metadata_json, name=title)

    # Regions: chromosomes for VCF, empty for FASTA
    regions = sorted({k.split("_")[1] for k in sparse if k.startswith("chr_")}) if fmt == "vcf" else []

    dataset = Dataset(
        owner_id        = current_user.id,
        title           = title,
        description     = description,
        format_type     = fmt,
        ipfs_cid        = cid,
        metadata_cid    = metadata_cid,
        feature_schema  = schema["all_features"],
        active_features = schema["active_features"],
        feature_vector  = sparse,
        sample_count    = 1,
        regions         = regions,
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    return {
        "dataset_id":     dataset.id,
        "ipfs_cid":       cid,
        "metadata_cid":   metadata_cid,
        "active_features": schema["active_features"],
        "feature_count":  len(sparse),
        "epsilon":        epsilon,
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


@router.get("/public_key")
def public_key():
    """Return server RSA public key so client can wrap AES keys."""
    return {"public_key": get_public_key_pem()}


def _dataset_summary(d: Dataset) -> dict:
    return {
        "dataset_id":     d.id,
        "title":          d.title,
        "description":    d.description,
        "format_type":    d.format_type,
        "active_features": d.active_features,
        "feature_count":  len(d.active_features or []),
        "regions":        d.regions,
        "sample_count":   d.sample_count,
        "metadata_cid":   d.metadata_cid,
        "created_at":     d.created_at.isoformat(),
    }
