# DeGenome

**Privacy-preserving genomic data infrastructure.**

Contributors share genomic data. Researchers query derived features via API. Raw sequences are never exposed.

---

## Architecture summary

```
Browser (contributor)
  ├── Loads genomic file locally
  ├── Server extracts features (PoC — move to WASM in production)
  ├── Laplace DP noise applied (ε-differential privacy)
  ├── AES-256-GCM encrypts raw file (Web Crypto API)
  └── Only feature vector + encrypted blob sent to server

Backend (FastAPI)
  ├── Stores DP-noised feature vectors in DB
  ├── Pins encrypted blob to IPFS via Pinata
  ├── Pins tamper-resistant metadata JSON to IPFS
  └── Serves /features and /batch endpoints (never raw data)

Researcher
  ├── Requests access → contributor approves
  ├── Queries /get_features or /get_batch_data
  ├── Spends credits → contributor earns credits
  └── Receives sparse or aligned feature vectors only
```

---

## Supported file formats (v1)

| Format | Extension | Features extracted |
|--------|-----------|--------------------|
| FASTA  | `.fasta`, `.fa` | Nucleotide counts, GC content, Shannon entropy, k-mer frequencies (k=2, k=3) |
| VCF    | `.vcf` | Variant counts, SNP/indel ratio, Ts/Tv ratio, zygosity, allele frequency stats, per-chromosome counts |

---

## Local setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- A [Pinata](https://pinata.cloud) account (free tier works)

---

### Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — add your Pinata keys and a strong JWT_SECRET

# Generate RSA keypair (run once only)
python scripts/gen_keys.py

# Start the API server
uvicorn main:app --reload --port 8000
```

The API will be live at `http://localhost:8000`.  
Interactive docs at `http://localhost:8000/docs`.

---

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# VITE_API_URL=http://localhost:8000 (default, no change needed for local dev)

# Start dev server
npm run dev
```

Frontend runs at `http://localhost:5173`.

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `PINATA_API_KEY` | Pinata API key |
| `PINATA_SECRET_API_KEY` | Pinata secret key |
| `JWT_SECRET` | Random string, min 32 chars — used to sign JWTs |
| `DATABASE_URL` | SQLite default: `sqlite:///./degenome.db`. Use PostgreSQL URL for production. |
| `ENVIRONMENT` | `development` or `production` |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL |

**Never commit `.env` files. Never commit `backend/keys/`.**

---

## API reference

All endpoints except `/auth/*` require `Authorization: Bearer <token>`.

| Method | Endpoint | Auth | Cost | Description |
|--------|----------|------|------|-------------|
| POST | `/auth/register` | No | — | Create account |
| POST | `/auth/login` | No | — | Get JWT token |
| POST | `/datasets/upload` | Yes | — | Upload + extract features |
| GET | `/datasets/` | Yes | — | List all datasets |
| GET | `/datasets/my` | Yes | — | Your datasets |
| GET | `/datasets/public_key` | No | — | RSA public key for client encryption |
| GET | `/data/info` | Yes | free | Dataset metadata |
| GET | `/data/schema` | Yes | free | Full feature schema |
| GET | `/data/features` | Yes | 1 CR | Sparse or full feature vector |
| GET | `/data/batch` | Yes | 2 CR | Batch feature vectors |
| POST | `/access/request` | Yes | — | Request dataset access |
| POST | `/access/decide` | Yes | — | Approve or reject request |
| GET | `/access/incoming` | Yes | — | Requests on your datasets |
| GET | `/access/outgoing` | Yes | — | Your access requests |
| GET | `/credits/balance` | Yes | — | Credit and earnings balance |
| GET | `/credits/history` | Yes | — | Transaction history |
| GET | `/credits/query_logs` | Yes | — | API call log |

---

## Credit system

| Event | Effect |
|-------|--------|
| New account | +10 credits |
| `/data/features` call | -1 CR (researcher), +1 CR (contributor) |
| `/data/batch` call | -2 CR (researcher), +2 CR (contributor) |
| `/data/schema` or `/data/info` | Free |

---

## Deployment

### Backend → Render

1. Push `backend/` to a GitHub repo
2. Create a new **Web Service** on [render.com](https://render.com)
3. Set build command: `pip install -r requirements.txt && python scripts/gen_keys.py`
4. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables: `PINATA_API_KEY`, `PINATA_SECRET_API_KEY`, `JWT_SECRET`, `DATABASE_URL`
6. For production, provision a **PostgreSQL** database on Render and set `DATABASE_URL` to its connection string

### Frontend → Vercel

1. Push `frontend/` to a GitHub repo
2. Import project on [vercel.com](https://vercel.com)
3. Set environment variable: `VITE_API_URL=https://your-render-app.onrender.com`
4. Deploy — Vercel auto-detects Vite

---

## Privacy design notes

**What the server never sees:**
- Raw genomic sequences
- Plaintext AES keys

**What the server stores:**
- DP-noised feature vectors (Laplace mechanism, ε=1.0 default)
- AES-256 encrypted raw data CID (pointer to IPFS)
- RSA-wrapped AES key

**Known v1 limitations:**
- Feature extraction happens server-side (PoC). Production should move this to client-side WebAssembly so raw data never crosses the network.
- Server holds the RSA private key. Full zero-trust requires threshold key management, which is a roadmap item.
- K-mer features use k=2 and k=3 only. Higher-k k-mers have elevated reconstruction risk and are excluded.

---

## Project structure

```
degenome/
├── backend/
│   ├── main.py                    # FastAPI app
│   ├── requirements.txt
│   ├── render.yaml
│   ├── models/
│   │   ├── db.py                  # SQLAlchemy models
│   │   └── database.py            # Engine, session, init
│   ├── routers/
│   │   ├── auth.py
│   │   ├── datasets.py
│   │   ├── data.py                # Feature access endpoints
│   │   ├── access.py
│   │   └── credits.py
│   ├── services/
│   │   ├── auth.py                # JWT, bcrypt
│   │   ├── crypto.py              # RSA key operations
│   │   ├── ipfs.py                # Pinata integration
│   │   └── credits.py             # Credit logic
│   ├── processing/
│   │   ├── feature_extraction.py  # FASTA + VCF pipelines
│   │   └── privacy.py             # Differential privacy (Laplace)
│   ├── scripts/
│   │   └── gen_keys.py            # RSA keypair generation
│   └── keys/                      # Generated — never committed
│       ├── private.pem
│       └── public.pem
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── vercel.json
    └── src/
        ├── main.jsx
        ├── App.jsx                # Router + protected routes
        ├── index.css
        ├── services/
        │   └── api.js             # Axios client
        ├── store/
        │   └── authStore.js       # Zustand auth state
        ├── utils/
        │   └── crypto.js          # Web Crypto API (AES + RSA)
        ├── components/
        │   ├── Navbar.jsx
        │   ├── DatasetCard.jsx
        │   └── FeatureViewer.jsx  # Sparse/full feature display
        └── pages/
            ├── Landing.jsx
            ├── Auth.jsx           # Login + Register
            ├── Dashboard.jsx
            ├── Upload.jsx
            ├── Explorer.jsx
            ├── AccessRequests.jsx
            └── DataAPI.jsx
```

---

## Roadmap

- Client-side feature extraction via WebAssembly (eliminates last raw data exposure)
- Threshold RSA key management (true zero-trust)
- Filecoin integration replacing Pinata
- Federated learning support (PySyft / Flower)
- Consent management (per-dataset usage policies)
- Expanded format support: FASTQ, BED, BAM
- Formal epsilon tuning interface per dataset
