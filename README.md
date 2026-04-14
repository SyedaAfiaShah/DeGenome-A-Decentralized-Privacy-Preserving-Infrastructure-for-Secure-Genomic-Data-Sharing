# DeGenome
### Decentralized Privacy-Preserving Infrastructure for Secure Genomic Data Sharing and Controlled Computation

---

## What is this?

Genomic data is one of the most valuable resources in modern science. It holds answers to questions about disease, drug response, inheritance, and human biology that researchers are only beginning to understand.

But despite its enormous potential, this data is almost impossible to access.

The reason is not technical. It is personal. Genomic data reveals deeply private information about health risks, ancestry, and family relationships. People and institutions are understandably reluctant to share it. Hospitals sit on millions of clinical genomic sequences. Biotech companies hold proprietary datasets. Agricultural firms have genomic databases covering every crop variety they have ever developed. None of it reaches the research community, because the current systems give data holders every reason to lock it away and no safe way to share it.

DeGenome is built to change that.

[See live demo](https://degenome.vercel.app/)

---

## The core idea

DeGenome allows contributors to share genomic data and researchers to use it for scientific analysis, without raw sequences ever being exposed to anyone.

Instead of sharing raw files, the system transforms genomic data into statistical feature vectors at the source. These features are scientifically useful but cannot be reverse-engineered back into the original sequence. Only these derived features ever leave the contributor's environment. The raw data never moves.

This is not a policy guarantee. It is an architectural one.

---

## Why decentralized?

Centralized cloud providers (AWS, Google, Azure) place your data under third-party custody. The platform operator makes decisions about who can access it, under what legal conditions, and for what purposes. Recent years have shown what this means in practice: AI companies training models on user data without meaningful consent, cloud providers entering government and military contracts their users had no say in.

For genomic data, this level of trust in a third party is not acceptable.

DeGenome stores encrypted data on IPFS, a decentralized storage network where no single entity controls the data. The roadmap moves this to Filecoin, a fully decentralized storage layer with no single operator that can be pressured, subpoenaed, or compromised. Self-custody enforced by cryptography, not by a contract.

---

## Who is this for?

DeGenome is not a human genomics platform. It is infrastructure for any genomic dataset from any organism.

The system works identically for human clinical data, agricultural crop genomes, microbial sequences, animal genetics, and environmental samples. FASTA and VCF are universal standards across biology. Any field that runs on sequence data and currently faces data access barriers is a target use case.

Fields that stand to benefit directly:

- Clinical genomics: patient-derived sequences tied to disease outcomes, currently locked in hospital systems behind regulatory walls
- Synthetic biology: engineers working on metabolic pathways need multi-species reference genomes scattered across inaccessible private databases
- Agricultural genomics: crop and livestock companies hold proprietary genomic data they will not share because of commercial sensitivity
- Conservation biology: rare species genomic data collected over decades, with no safe path to the research community
- Microbial research: environmental and pathogen genomic data held in fragmented institutional repositories

The long-term vision is a privacy-preserving equivalent of NCBI, covering the genomic data that existing public repositories cannot host because it is too sensitive, too proprietary, or too regulated.

---

## How it works

```
Contributor (Browser)
  ├── Genomic file loaded locally — never leaves the device raw
  ├── Feature extraction pipeline runs in browser
  ├── Differential privacy noise applied (Laplace, e=1.0)
  ├── AES-256-GCM encrypts raw file (Web Crypto API)
  └── Only feature vector + encrypted blob sent to server

Backend (FastAPI)
  ├── Stores differentially private feature vectors in DB
  ├── Pins encrypted blob to IPFS via Pinata
  ├── Pins tamper-resistant metadata JSON to IPFS
  └── Serves feature API endpoints (never raw data)

Researcher
  ├── Browses datasets by feature schema
  ├── Requests access — contributor approves or rejects
  ├── Queries /get_features or /get_batch_data
  ├── Spends credits per API call
  └── Receives sparse or aligned feature vectors only
```

---

## Privacy design

**What the server never sees:**
- Raw genomic sequences
- Plaintext AES keys
- Any data that could reconstruct the original sequence

**What the server stores:**
- Differentially private feature vectors (Laplace mechanism, e=1.0 default)
- AES-256 encrypted raw data CID (a pointer to IPFS storage, not the data itself)
- RSA-wrapped AES key (encrypted, unusable without the private key)
- Dataset metadata and feature schemas

**Differential privacy:** Adding calibrated mathematical noise to feature values before storage provides a formal, provable bound on how much information any feature can leak about the original sequence. This is the same standard used by Apple, Google, and the US Census Bureau for protecting aggregate statistical data.

**Known v1 limitations:**
- Feature extraction currently runs server-side (PoC). Production roadmap moves this fully client-side via WebAssembly so raw data never crosses the network at all
- Server holds the RSA private key. Full zero-trust requires threshold key management (roadmap item)
- Storage uses Pinata (centralized IPFS pinning). Filecoin migration is the next infrastructure step

---

## Incentive model

Contributors earn credits every time a researcher queries their dataset. Researchers spend credits per API call. New accounts receive a signup bonus to get started.

The roadmap moves this on-chain with a smart contract token economy, inspired by DAO incentive structures. Token value is backed by platform revenue. Contributors can exchange tokens for real value as the platform grows. On-chain identity means contributors are identified by wallet addresses rather than personal information, providing pseudonymity by default for people sharing sensitive biological data.

| Event | Effect |
|-------|--------|
| New account | +10 credits |
| /data/features call | -1 CR (researcher), +1 CR (contributor) |
| /data/batch call | -2 CR (researcher), +2 CR (contributor) |
| /data/schema or /data/info | Free |

---

## Supported formats (v1)

| Format | Extension | Features extracted |
|--------|-----------|--------------------|
| FASTA | `.fasta`, `.fa` | Nucleotide counts, GC content, Shannon entropy, k-mer frequencies (k=2, k=3) |
| VCF | `.vcf` | Variant counts, SNP/indel ratio, Ts/Tv ratio, zygosity, allele frequency stats, per-chromosome counts |

---

## Local setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- A [Pinata](https://pinata.cloud) account (free tier works)

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Add your Pinata keys and JWT_SECRET to .env
python scripts/gen_keys.py
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
# VITE_API_URL=http://localhost:8000
npm run dev
```

---

## API reference

All endpoints except `/auth/*` require `Authorization: Bearer <token>`.

| Method | Endpoint | Cost | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | free | Create account |
| POST | `/auth/login` | free | Get JWT token |
| POST | `/datasets/upload` | free | Upload and extract features |
| GET | `/datasets/` | free | List all datasets |
| GET | `/data/info` | free | Dataset metadata |
| GET | `/data/schema` | free | Full feature schema |
| GET | `/data/features` | 1 CR | Sparse or full feature vector |
| GET | `/data/batch` | 2 CR | Batch feature vectors |
| POST | `/access/request` | free | Request dataset access |
| POST | `/access/decide` | free | Approve or reject a request |
| GET | `/credits/balance` | free | Credit and earnings balance |

---

## Tech stack

**Backend:** Python, FastAPI, SQLAlchemy, SQLite/PostgreSQL, bcrypt, python-jose

**Frontend:** React, Vite, Tailwind CSS, Zustand, Axios, Web Crypto API

**Storage:** IPFS via Pinata (Filecoin on roadmap)

**Privacy:** AES-256-GCM, RSA-2048, Laplace differential privacy (e-DP)

**Deployment:** Render (backend), Vercel (frontend)

---

## Roadmap

- Client-side feature extraction via WebAssembly
- Filecoin integration replacing Pinata
- On-chain token economy with smart contract treasury
- Threshold RSA key management for true zero-trust
- Federated learning support (model training without data leaving contributor devices)
- Consent management layer (per-dataset usage policies)
- Expanded format support: FASTQ, BED, BAM
- Blockchain-based contributor identity (wallet address pseudonymity)
