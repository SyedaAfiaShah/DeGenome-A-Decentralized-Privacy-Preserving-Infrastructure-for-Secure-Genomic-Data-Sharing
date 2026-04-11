import requests, json, os
from dotenv import load_dotenv

load_dotenv()

PINATA_API_KEY    = os.getenv("PINATA_API_KEY", "")
PINATA_SECRET_KEY = os.getenv("PINATA_SECRET_API_KEY", "")
PINATA_BASE       = "https://api.pinata.cloud"


def _headers():
    return {
        "pinata_api_key":        PINATA_API_KEY,
        "pinata_secret_api_key": PINATA_SECRET_KEY,
    }


def pin_bytes(data: bytes, filename: str) -> str:
    """Pin raw bytes to IPFS via Pinata. Returns CID."""
    url  = f"{PINATA_BASE}/pinning/pinFileToIPFS"
    resp = requests.post(url, files={"file": (filename, data)}, headers=_headers())
    resp.raise_for_status()
    return resp.json()["IpfsHash"]


def pin_json(data: dict, name: str = "metadata") -> str:
    """Pin a JSON object to IPFS via Pinata. Returns CID."""
    url  = f"{PINATA_BASE}/pinning/pinJSONToIPFS"
    body = {"pinataContent": data, "pinataMetadata": {"name": name}}
    resp = requests.post(url, json=body, headers=_headers())
    resp.raise_for_status()
    return resp.json()["IpfsHash"]


def fetch_json(cid: str) -> dict:
    """Retrieve JSON from IPFS gateway."""
    url  = f"https://gateway.pinata.cloud/ipfs/{cid}"
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.json()
