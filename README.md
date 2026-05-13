# RankForge — AI-Powered SEO Platform

> Paste a URL. Get trending keywords + an SEO blog post. Automatically.

Built with: **FastAPI · LangGraph · NVIDIA NIM · React/Vite · PostgreSQL · Redis · Qdrant**

---

## Quick Start (Windows)

### Prerequisites
- Python 3.11+ → https://python.org
- Node.js 18+ → https://nodejs.org
- Docker Desktop → https://docker.com/products/docker-desktop (must be running)
- Git → https://git-scm.com

### 1. Add your NVIDIA API Key

Open `backend/.env` (copy from `backend/.env.example` first) and set:

```
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=meta/llama-3.1-70b-instruct
```

Get your key at: https://build.nvidia.com → Sign in → Get API Key

### 2. Run

```bash
# Windows
start_windows.bat

# Mac / Linux
chmod +x start.sh && ./start.sh
```

That's it. Open http://localhost:5173 and register.

---

## Manual Setup (step by step)

### Step 1 — Start databases
```bash
cd docker
docker compose up -d
```

### Step 2 — Backend
```bash
cd backend
cp .env.example .env
# Edit .env — add NVIDIA_API_KEY

python -m venv venv

# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
playwright install chromium   # optional but improves scraping
uvicorn app.main:app --reload --port 8000
```

### Step 3 — Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Architecture

```
frontend (React/Vite :5173)
    │
    ▼ HTTP/SSE
backend (FastAPI :8000)
    │
    ├─ Auth service (JWT + bcrypt + HttpOnly cookies)
    ├─ Projects service (per-user CRUD)
    └─ Agent pipeline (LangGraph)
         ├─ Browser agent (Playwright → httpx fallback)
         ├─ Keyword agent (SerpAPI → LLM estimation fallback)
         ├─ Blog writer (NVIDIA NIM / Llama 3.1 70B)
         └─ State → PostgreSQL + Qdrant
```

## Agent Pipeline

```
URL Input
  │
  ▼
[1] Browser Agent      — scrapes title, meta, h1-h3, products, body
  │
  ▼
[2] Keyword Extractor  — LLM finds 25-30 candidate keywords
  │
  ▼
[3] SEO Data Fetcher   — SerpAPI (or LLM estimate) for volume/difficulty/CPC
  │
  ▼
[4] Blog Writer        — NVIDIA LLM generates 1200-word SEO blog post
  │
  ▼
[5] Save to DB         — PostgreSQL stores all results per user/project
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/auth/register | Register new user |
| POST | /api/v1/auth/login | Login, returns JWT + sets cookie |
| POST | /api/v1/auth/refresh | Refresh access token |
| POST | /api/v1/auth/logout | Logout + revoke token |
| GET  | /api/v1/auth/me | Get current user |
| GET  | /api/v1/projects/ | List user's projects |
| POST | /api/v1/projects/ | Create project |
| DELETE | /api/v1/projects/{id} | Delete project |
| GET  | /api/v1/projects/{id}/history | Get full history |
| POST | /api/v1/analyze/{id}/run | **Start analysis (SSE stream)** |
| GET  | /api/v1/analyze/{id}/runs | List past runs |

Full interactive docs: http://localhost:8000/docs

## Security Model

- Passwords hashed with **bcrypt** (cost 12)
- JWT access tokens expire in **15 minutes**
- Refresh tokens in **HttpOnly cookies** (7 days), hashed in DB
- All project/keyword/blog data is **user-scoped** at query level
- CORS restricted to localhost origins only

## Phase Roadmap

### ✅ Phase 1 — Core (done)
- Auth system (register, login, JWT, refresh tokens)
- Project CRUD (per-user)
- Browser scraper (Playwright + httpx fallback)
- Keyword extraction (LLM-powered)
- Blog generation (NVIDIA NIM LLM)
- PostgreSQL + Redis + Qdrant
- React dashboard with live SSE feed

### ✅ Phase 2 — Intelligence (done)
- LangGraph multi-agent StateGraph
- Keyword scoring (volume × opportunity × intent)
- SEO data enrichment (SerpAPI or LLM estimation)
- Real-time SSE progress streaming
- History tracking with run status

### ✅ Phase 3 — Dashboard & History (done)
- Full history view per project
- Keyword table with difficulty bars + intent badges
- Blog viewer with markdown rendering
- Project stats (analyzed count, last run)

### 🔜 Phase 4 — Scale (future)
- Celery async background jobs
- DataForSEO API integration
- PDF/CSV export
- Stripe billing tiers
- Team/org accounts

## Switching to HuggingFace (later)

In `backend/.env`:
```
NVIDIA_API_KEY=hf_xxxxxxx
NVIDIA_BASE_URL=https://api-inference.huggingface.co/v1
NVIDIA_MODEL=mistralai/Mixtral-8x7B-Instruct-v0.1
```

The LLM client uses the OpenAI-compatible SDK so it works with both.

## Troubleshooting

**Docker not starting**: Make sure Docker Desktop is open and running.

**Port already in use**: Kill existing process or change ports in `.env` and `vite.config.js`.

**Playwright install fails**: The browser agent falls back to httpx automatically — scraping still works.

**NVIDIA API errors**: Check your key at https://build.nvidia.com, ensure it has credits.

**Database errors on first run**: Tables are auto-created on startup. If you see migration errors, run `docker compose down -v` and restart to reset the DB.
