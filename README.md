# DeGenome

**A Decentralized, Privacy-Preserving Infrastructure for Secure Genomic Data Sharing and Controlled Computation**

DeGenome is a full-stack platform that enables genomic data contributors to share their data safely with researchers — without raw sequences ever leaving the contributor's device. Privacy guarantees are enforced by architecture, not policy.

---

## The Problem

Genomic data holds enormous scientific value. It can identify disease risk before symptoms appear, guide drug development at the molecular level, accelerate synthetic biology, and enable precision medicine at population scale. Sequencing costs have dropped by a factor of one million since 2001 and data generation is growing faster than ever.

Yet access remains severely restricted. Hospitals hold patient sequences behind regulatory walls. Biotech companies treat genomic databases as proprietary assets. Research institutions silo data behind access committees. The barrier is not technical — it is the absence of a system that makes sharing safe, fair, and worth doing for the people who hold the data.

---

## How It Works

DeGenome separates two concerns that were previously coupled: **sharing access to genomic insights** and **exposing raw genomic sequences**. Contributors can participate in the former without ever doing the latter.

[See Degenome v1 - proof of concept here](https://degenome.vercel.app/)

### Privacy Pipeline

```
Contributor's Browser
│
├── 1. File selected (FASTA or VCF) — stays in browser memory
│
├── 2. JS Feature Extraction — pure JavaScript, zero server involvement
│       FASTA: nucleotide counts, GC content, Shannon entropy, k-mers (k=2, k=3), sequence length
│       VCF:   SNP/indel counts, Ts/Tv ratio, het/hom ratio, allele freq stats, per-chromosome counts
│
├── 3. Differential Privacy — Laplace noise applied in browser
│       Formal epsilon-DP guarantee. Default ε = 1.0
│       Raw features never transmitted — only noised vectors leave the device
│
├── 4. AES-256-GCM Encryption — raw file encrypted client-side
│       Key never transmitted. No server-side key infrastructure exists.
│
└── 5. Direct Storj Upload — browser PUT to presigned URL
        Server generates the URL but never handles file content
        Encrypted data distributed across thousands of independent global nodes

Server receives:  differentially private feature vectors, dataset metadata, Storj object key reference
Server never sees: raw genomic sequences, AES encryption keys, any data capable of reconstructing the sequence
```

### Research Access

Researchers browse available datasets by feature schema, request access with a stated purpose, and receive approval from the contributor. Approved researchers query feature vectors via REST API or persistent API keys, integrating directly into Python ML pipelines. Credits flow automatically from researcher to contributor per query.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11, FastAPI, SQLAlchemy, bcrypt, JWT, API Keys |
| Frontend | React 18, Vite, Tailwind CSS, Zustand, Web Crypto API |
| Privacy | Laplace Differential Privacy (client-side JS) |
| Encryption | AES-256-GCM (Web Crypto API, client-side) |
| Storage | Storj (S3-compatible, decentralized, erasure coded) |
| Metadata | IPFS via Pinata (tamper-resistant provenance records) |
| Deployment | Render (backend), Vercel (frontend) |

---

## Features

### Core Privacy Architecture
- **Client-side feature extraction** — JavaScript pipeline runs entirely in the browser. Supports FASTA (nucleotide counts, GC content, AT content, Shannon entropy, sequence length, k=2 and k=3 k-mer frequencies, N ratio) and VCF (SNP count, indel count, Ts/Tv ratio, het/hom ratio, allele frequency statistics, per-chromosome variant counts). Dynamic schema-aware — generates a dataset-specific feature schema from actual file content.
- **Client-side differential privacy** — Laplace noise calibrated per feature type using a sensitivity map. Type-appropriate clipping: ratio and k-mer values clipped to [0,1], count values clipped to ≥ 0. Configurable epsilon per dataset.
- **Client-side AES-256-GCM encryption** — Web Crypto API. The AES key is generated and held in the browser. Never transmitted. The server cannot decrypt files even under compulsion.
- **Direct Storj upload** — Presigned PUT URLs allow the browser to upload encrypted files directly to Storj. The server generates the URL and stores the object key reference but never touches file content.
- **Decentralized storage** — Storj distributes encrypted file chunks across thousands of independent nodes globally with erasure coding. A compromised node holds only an encrypted fragment that is individually meaningless.
- **IPFS metadata pinning** — Dataset metadata JSON is pinned to IPFS via Pinata, creating a tamper-resistant and independently verifiable provenance record for every dataset.

### Platform Features
- **Role-based access** — Users register as contributor or researcher. Role switching is available post-signup without logging out.
- **Contributor workflow** — Upload FASTA or VCF files, set epsilon privacy budget, approve or reject researcher access requests with time-limited permissions, earn credits per query.
- **Researcher workflow** — Browse datasets by feature schema, send access requests with stated purpose, query approved datasets via structured JSON query API or natural language interface, spend credits per call.
- **Structured query system** — POST /data/query accepts feature_type (SNP/kmer/nucleotide), chromosome, position range, and arbitrary filters. Returns matching feature data from the dataset's privacy-protected vector.
- **API key authentication** — Generate named persistent API keys for programmatic access. Auth middleware accepts either JWT Bearer tokens or API keys, enabling direct integration into Python ML pipelines without browser-based authentication.
- **Credit system** — Researchers spend 1 credit per query. Credits transfer automatically to the dataset owner. Signup bonus provided on account creation.
- **Query logging** — All feature queries are logged with timestamp, researcher identity, and dataset reference.

---

## Project Structure

```
degenome/
├── backend/
│   ├── main.py                     # FastAPI app entry point
│   ├── requirements.txt
│   ├── render.yaml                 # Render deployment config
│   ├── .env.example                # Environment variable template
│   ├── models/
│   │   ├── db.py                   # SQLAlchemy models (User, Dataset, AccessRequest, ApiKey)
│   │   └── database.py             # DB session and engine
│   ├── routers/
│   │   ├── auth.py                 # Register, login, role switch, API key management
│   │   ├── datasets.py             # Presign upload URL, register dataset, list datasets
│   │   ├── data.py                 # Feature queries, batch data, dataset info
│   │   └── access.py               # Access request creation, approval, listing
│   └── services/
│       ├── auth.py                 # JWT creation, password hashing, auth middleware
│       ├── credits.py              # Credit deduction and transfer logic
│       ├── ipfs.py                 # IPFS metadata pinning via Pinata
│       └── storj.py                # Storj presigned URL generation via boto3
│
└── frontend/
    └── src/
        ├── pages/
        │   ├── Upload.jsx          # 4-step upload: select → extracting → uploading → done
        │   ├── Dashboard.jsx       # User stats, dataset list, API key management
        │   ├── Explorer.jsx        # Browse all available datasets
        │   ├── DataAPI.jsx         # Query builder and feature access
        │   ├── AccessRequests.jsx  # Incoming and outgoing access requests
        │   ├── Auth.jsx            # Login and registration
        │   └── Landing.jsx
        ├── components/
        │   ├── Navbar.jsx          # Navigation with role switcher
        │   ├── QueryBuilder.jsx    # Visual query builder for researchers
        │   ├── FeatureViewer.jsx   # Feature vector display
        │   └── DatasetCard.jsx
        ├── utils/
        │   ├── featureExtraction.js  # Client-side FASTA/VCF feature extraction (36/36 tests)
        │   └── privacy.js            # Client-side Laplace differential privacy (40/40 tests)
        ├── services/
        │   └── api.js              # Axios API client
        └── store/
            └── authStore.js        # Zustand auth state
```

---

## API Reference

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | /auth/register | Create account (role: contributor or researcher) |
| POST | /auth/login | Login and receive JWT |
| PATCH | /auth/role | Switch role without logging out |
| POST | /auth/api-keys | Generate a named API key |
| GET | /auth/api-keys | List existing API keys |

### Datasets

| Method | Endpoint | Description |
|---|---|---|
| GET | /datasets/presign | Get presigned Storj upload URL |
| POST | /datasets/register | Register dataset after direct Storj upload |
| GET | /datasets/ | List all available datasets |
| GET | /datasets/my | List current user's datasets |

### Data Access

| Method | Endpoint | Description |
|---|---|---|
| GET | /data/features | Get feature vector for approved dataset |
| POST | /data/query | Structured query on feature vector |
| GET | /data/info | Dataset metadata and schema |
| POST | /data/batch | Batch feature retrieval |

### Access Control

| Method | Endpoint | Description |
|---|---|---|
| POST | /access/request | Request access to a dataset (researcher only) |
| PATCH | /access/{id}/approve | Approve an access request (contributor only) |
| PATCH | /access/{id}/reject | Reject an access request (contributor only) |
| GET | /access/my | List all access requests for current user |

---

## Security Model

Traditional platforms protect data with access controls and legal agreements. If the server is compromised, raw data is exposed. DeGenome removes this attack surface entirely by ensuring the server never holds data worth stealing.

- The privacy guarantee is a mathematical proof, not a policy. Epsilon-differential privacy formally bounds the amount of information an adversary can extract from any released feature value, regardless of how many queries they make.
- The encryption guarantee does not depend on the server. AES-256-GCM keys are generated in the browser and never transmitted. A complete server compromise reveals nothing about raw genomic content.
- The storage guarantee does not depend on a single operator. Storj's erasure coding distributes encrypted chunks across thousands of independent nodes. No single node or single company can reconstruct or delete the data.

---

## Roadmap

- **On-chain token economy** — Smart contract treasury governs contributor rewards backed by real platform revenue. Token value tied to actual data usage.
- **Blockchain wallet identity** — Contributors identified by wallet addresses instead of platform accounts, providing pseudonymous identity by default.
- **Federated learning support** — Researchers train ML models on contributor data without data ever leaving contributor devices.
- **Expanded format support** — FASTQ, BED, BAM, plus per-dataset consent management allowing contributors to restrict by research purpose or field.


*DeGenome - Proof of Concept, v1.0*
---
