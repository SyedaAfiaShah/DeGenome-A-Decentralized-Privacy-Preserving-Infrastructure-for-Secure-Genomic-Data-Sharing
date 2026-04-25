from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime
import uuid

Base = declarative_base()

def gen_id():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    id           = Column(String, primary_key=True, default=gen_id)
    email        = Column(String, unique=True, nullable=False, index=True)
    username     = Column(String, unique=True, nullable=False)
    hashed_pw    = Column(String, nullable=False)
    role         = Column(String, nullable=False)  # contributor | researcher
    credits      = Column(Float, default=10.0)
    earnings     = Column(Float, default=0.0)
    created_at   = Column(DateTime, default=datetime.utcnow)

    datasets         = relationship("Dataset", back_populates="owner")
    access_requests  = relationship("AccessRequest", back_populates="requester", foreign_keys="AccessRequest.requester_id")
    query_logs       = relationship("QueryLog", back_populates="user")
    api_keys         = relationship("ApiKey", back_populates="user")


class Dataset(Base):
    __tablename__ = "datasets"
    id               = Column(String, primary_key=True, default=gen_id)
    owner_id         = Column(String, ForeignKey("users.id"), nullable=False)
    title            = Column(String, nullable=False)
    description      = Column(Text)
    format_type      = Column(String, nullable=False)       # fasta | vcf
    storj_key        = Column(String)                       # Storj object key for raw file
    metadata_cid     = Column(String)                       # metadata JSON CID on IPFS
    feature_schema   = Column(JSON)                         # list of all possible feature names
    active_features  = Column(JSON)                         # list of non-zero feature names
    feature_vector   = Column(JSON)                         # DP-noised feature values (sparse)
    sample_count     = Column(Integer, default=1)
    regions          = Column(JSON, default=list)           # chromosomes / regions present
    is_active        = Column(Boolean, default=True)
    has_raw_file     = Column(Boolean, default=False)       # did contributor upload raw file to Storj?
    created_at       = Column(DateTime, default=datetime.utcnow)

    owner            = relationship("User", back_populates="datasets")
    access_requests  = relationship("AccessRequest", back_populates="dataset")
    api_keys         = relationship("ApiKey", back_populates="dataset")


class AccessRequest(Base):
    __tablename__ = "access_requests"
    id               = Column(String, primary_key=True, default=gen_id)
    requester_id     = Column(String, ForeignKey("users.id"), nullable=False)
    dataset_id       = Column(String, ForeignKey("datasets.id"), nullable=False)
    status           = Column(String, default="pending")        # pending | approved | rejected
    access_type      = Column(String, default="feature_access") # feature_access | raw_file_access
    purpose          = Column(Text)
    approved_key_id  = Column(String, ForeignKey("api_keys.id", use_alter=True), nullable=True)
    pending_key      = Column(String, nullable=True)
    expires_at       = Column(DateTime, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    requester     = relationship("User", back_populates="access_requests", foreign_keys=[requester_id])
    dataset       = relationship("Dataset", back_populates="access_requests")


class QueryLog(Base):
    __tablename__ = "query_logs"
    id          = Column(String, primary_key=True, default=gen_id)
    user_id     = Column(String, ForeignKey("users.id"), nullable=False)
    dataset_id  = Column(String, nullable=False)
    endpoint    = Column(String, nullable=False)
    credits_used= Column(Float, default=0.0)
    timestamp   = Column(DateTime, default=datetime.utcnow)

    user        = relationship("User", back_populates="query_logs")


class ApiKey(Base):
    __tablename__ = "api_keys"
    id           = Column(String, primary_key=True, default=gen_id)
    user_id      = Column(String, ForeignKey("users.id"), nullable=False)
    dataset_id   = Column(String, ForeignKey("datasets.id"), nullable=False)
    access_type  = Column(String, nullable=False)               # feature_access | raw_file_access
    key_hash     = Column(String, nullable=False, index=True)   # SHA-256 of raw key
    key_prefix   = Column(String, nullable=False)               # first 11 chars for display
    name         = Column(String, nullable=False)
    created_at   = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)
    is_active    = Column(Boolean, default=True)

    user         = relationship("User", back_populates="api_keys")
    dataset      = relationship("Dataset", back_populates="api_keys")


class CreditTransaction(Base):
    __tablename__ = "credit_transactions"
    id          = Column(String, primary_key=True, default=gen_id)
    user_id     = Column(String, ForeignKey("users.id"), nullable=False)
    amount      = Column(Float, nullable=False)             # positive = credit, negative = debit
    reason      = Column(String, nullable=False)
    related_id  = Column(String, nullable=True)             # dataset_id or query_log_id
    created_at  = Column(DateTime, default=datetime.utcnow)
