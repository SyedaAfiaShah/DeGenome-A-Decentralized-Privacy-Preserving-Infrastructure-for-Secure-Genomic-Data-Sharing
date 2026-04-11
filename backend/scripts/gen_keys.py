"""
Run once before starting the server: python scripts/gen_keys.py
Generates RSA-2048 keypair for AES key wrapping.
"""
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
import os

KEY_DIR = os.path.join(os.path.dirname(__file__), "..", "keys")
os.makedirs(KEY_DIR, exist_ok=True)

priv_path = os.path.join(KEY_DIR, "private.pem")
pub_path  = os.path.join(KEY_DIR, "public.pem")

if os.path.exists(priv_path):
    print("Keys already exist. Delete keys/ directory to regenerate.")
else:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    with open(priv_path, "wb") as f:
        f.write(private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption()
        ))
    with open(pub_path, "wb") as f:
        f.write(private_key.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ))
    print(f"Keys generated:\n  {priv_path}\n  {pub_path}")
