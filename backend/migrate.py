import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)

migrations = [
    # datasets table
    "ALTER TABLE datasets ADD COLUMN IF NOT EXISTS has_raw_file BOOLEAN DEFAULT FALSE",

    # access_requests table
    "ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS access_type VARCHAR DEFAULT 'feature_access'",
    "ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS approved_key_id VARCHAR",

    # api_keys table
    "ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS dataset_id VARCHAR",
    "ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS access_type VARCHAR",
]

with engine.connect() as conn:
    for sql in migrations:
        try:
            conn.execute(text(sql))
            print(f"OK: {sql[:60]}...")
        except Exception as e:
            print(f"SKIP/ERROR: {e}")
    conn.commit()
    print("Migration complete.")
