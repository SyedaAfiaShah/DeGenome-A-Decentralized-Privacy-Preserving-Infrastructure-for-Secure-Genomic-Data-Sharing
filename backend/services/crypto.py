from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding
import base64, os

KEY_DIR = os.path.join(os.path.dirname(__file__), "..", "keys")

def _load_public_key():
    with open(os.path.join(KEY_DIR, "public.pem"), "rb") as f:
        return serialization.load_pem_public_key(f.read())

def _load_private_key():
    with open(os.path.join(KEY_DIR, "private.pem"), "rb") as f:
        return serialization.load_pem_private_key(f.read(), password=None)

def get_public_key_pem() -> str:
    with open(os.path.join(KEY_DIR, "public.pem"), "r") as f:
        return f.read()

def decrypt_aes_key(encrypted_key_b64: str) -> bytes:
    """Decrypt an RSA-wrapped AES key. Used only during feature extraction."""
    encrypted = base64.b64decode(encrypted_key_b64)
    return _load_private_key().decrypt(encrypted, padding.OAEP(
        mgf=padding.MGF1(algorithm=hashes.SHA256()),
        algorithm=hashes.SHA256(),
        label=None
    ))
