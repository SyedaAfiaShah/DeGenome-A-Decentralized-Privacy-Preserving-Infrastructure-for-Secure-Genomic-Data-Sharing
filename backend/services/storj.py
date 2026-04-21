"""
Storj S3-compatible presigned URL service.
Generates short-lived PUT URLs so the browser can upload raw genomic
files directly to Storj — the server never handles the file content.
"""
import os
import uuid
import boto3
from botocore.config import Config
from dotenv import load_dotenv

load_dotenv()

_ENDPOINT   = os.getenv("STORJ_ENDPOINT", "")
_ACCESS_KEY = os.getenv("STORJ_ACCESS_KEY", "")
_SECRET_KEY = os.getenv("STORJ_SECRET_KEY", "")
_BUCKET     = os.getenv("STORJ_BUCKET", "")

# Presigned URL lifetime (seconds)
_URL_EXPIRY = 15 * 60  # 15 minutes

# Content-type map for accepted genomic formats
_CONTENT_TYPES: dict[str, str] = {
    "fasta": "text/plain",
    "vcf":   "text/plain",
}


def _s3_client():
    """Build a boto3 S3 client pointed at the Storj gateway."""
    return boto3.client(
        "s3",
        endpoint_url=_ENDPOINT,
        aws_access_key_id=_ACCESS_KEY,
        aws_secret_access_key=_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",   # Storj ignores the region but boto3 requires one
    )


def generate_presigned_upload_url(filename: str, format_type: str) -> dict:
    """
    Generate a presigned S3 PUT URL for a direct browser-to-Storj upload.

    The object key is a UUID-prefixed path so collisions are impossible and
    the original filename is preserved as metadata only — never exposed in
    the storage key.

    Args:
        filename:    Original filename supplied by the user (used as metadata).
        format_type: One of 'fasta' or 'vcf'.

    Returns:
        {
            "url":        "<presigned PUT URL, valid 15 min>",
            "object_key": "<UUID-prefixed storage key>",
            "expires_in": 900,
        }

    Raises:
        ValueError:  if format_type is not recognised.
        RuntimeError: if Storj credentials are not configured.
    """
    fmt = format_type.lower()
    if fmt not in _CONTENT_TYPES:
        raise ValueError(
            f"Unsupported format_type '{format_type}'. Must be one of: "
            + ", ".join(_CONTENT_TYPES)
        )

    if not all([_ENDPOINT, _ACCESS_KEY, _SECRET_KEY, _BUCKET]):
        raise RuntimeError(
            "Storj credentials not configured. "
            "Set STORJ_ENDPOINT, STORJ_ACCESS_KEY, STORJ_SECRET_KEY, "
            "and STORJ_BUCKET in your environment."
        )

    object_key = f"uploads/{uuid.uuid4()}/{filename}"

    url = _s3_client().generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket":      _BUCKET,
            "Key":         object_key,
            "ContentType": _CONTENT_TYPES[fmt],
        },
        ExpiresIn=_URL_EXPIRY,
        HttpMethod="PUT",
    )

    return {
        "url":        url,
        "object_key": object_key,
        "expires_in": _URL_EXPIRY,
    }


def generate_presigned_download_url(object_key: str) -> dict:
    """
    Generate a presigned S3 GET URL for downloading a raw genomic file from Storj.

    Args:
        object_key: The Storj object key stored on the Dataset row (storj_key).

    Returns:
        {
            "url":        "<presigned GET URL, valid 15 min>",
            "object_key": "<object key>",
            "expires_in": 900,
        }

    Raises:
        RuntimeError: if Storj credentials are not configured.
    """
    if not all([_ENDPOINT, _ACCESS_KEY, _SECRET_KEY, _BUCKET]):
        raise RuntimeError(
            "Storj credentials not configured. "
            "Set STORJ_ENDPOINT, STORJ_ACCESS_KEY, STORJ_SECRET_KEY, "
            "and STORJ_BUCKET in your environment."
        )

    url = _s3_client().generate_presigned_url(
        ClientMethod="get_object",
        Params={
            "Bucket": _BUCKET,
            "Key":    object_key,
        },
        ExpiresIn=_URL_EXPIRY,
        HttpMethod="GET",
    )

    return {
        "url":        url,
        "object_key": object_key,
        "expires_in": _URL_EXPIRY,
    }
