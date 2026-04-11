from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models.database import init_db
from routers import auth, datasets, data, access, credits
import os

app = FastAPI(
    title="DeGenome API",
    description="Privacy-preserving genomic data infrastructure",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # restrict to frontend domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(datasets.router)
app.include_router(data.router)
app.include_router(access.router)
app.include_router(credits.router)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/")
def root():
    return {"name": "DeGenome API", "version": "1.0.0", "status": "running"}


@app.get("/health")
def health():
    return {"status": "ok"}
