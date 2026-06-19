# AIBridge — install & run

AI microservice that crawls a business website, indexes uploaded PDFs / DOCX / TXT, answers questions over the combined knowledge base, and produces an AI-readiness report. Four `POST /v1/*` endpoints, one static HTML console, one Qdrant binary, one Groq key.

## Prerequisites

- **Python 3.10+** (3.11 tested).
- **~250 MB free disk** (BGE embedding model + dependencies + Qdrant storage).
- **A Groq API key** (`gsk_…`). Get one at https://console.groq.com. You can paste multiple keys comma-separated for automatic failover when one hits a rate-limit.
- **OS shell** — Git Bash on Windows (recommended) or any POSIX shell on macOS / Linux. Pure `cmd.exe` is supported via `.bat` scripts but slower.

## One-time install

From the repo root:

```bash
bash install.sh        # POSIX / Git Bash on Windows
# or
install.bat            # cmd.exe on Windows
```

The script will:

1. Create `ai-service/.venv` with Python 3.10+.
2. Install every pinned dependency from `ai-service/requirements.txt`.
3. Copy `ai-service/.env.example` to `ai-service/.env` if missing.
4. Boot a local Qdrant on `:6333`, create the 6 collections + payload indexes (idempotent), then leave it running.
5. Download `BAAI/bge-small-en-v1.5` (~93 MB) into `ai-service/data/models/`.

Re-runnable. Nothing is downloaded twice; nothing is deleted.

## Start the stack

Each time you want to work:

```bash
bash start.sh          # POSIX / Git Bash on Windows
# or
start.bat              # cmd.exe on Windows
```

`start.sh` does this in order:

1. Starts Qdrant on `:6333` (skipped if already running).
2. Starts FastAPI on `:8000`.
3. Starts the static frontend on `:5500`.
4. Waits until `/v1/health` returns 200.
5. Opens `http://127.0.0.1:5500/` in your default browser.
6. Streams combined logs. **Ctrl+C** stops all three services cleanly.

## Stop the stack

`Ctrl+C` in the terminal running `start.sh` / `start.bat`. On Windows, if Qdrant stays up, run:

```powershell
taskkill /F /IM qdrant.exe
```

## Run the tests

```bash
cd ai-service
.venv/Scripts/python.exe -m pytest tests/ -q     # Windows
# or
.venv/bin/python -m pytest tests/ -q             # POSIX
```

Currently 69 unit tests covering: website analysis (7), document processing (12), chatbot (12), kb_master mirror (3), readiness report (22), misc helpers (13).

## Use your own Groq key

Open `ai-service/.env` and set:

```
GROQ_API_KEYS=gsk_your_key_here
# or several, comma-separated, for failover:
GROQ_API_KEYS=gsk_key1,gsk_key2,gsk_key3
```

Restart `start.sh`. The pool rotates to the next key on rate-limit / auth / connection errors.

If `GROQ_API_KEYS` is empty, the LLM endpoints return `503 llm_not_configured` — but the crawler, document parser, and vector store still work.

## Repo layout

```
ai-bridge/
├── INSTALL.md                  ← you are here
├── install.sh / install.bat    ← one-shot setup
├── start.sh   / start.bat      ← one-command run
├── .gitignore
├── ai-service/                 ← the AI microservice
│   ├── app/                    ← Python package
│   │   ├── main.py             ← FastAPI entrypoint
│   │   ├── api/                ← router + request/response schemas
│   │   ├── core/               ← config, embedding, qdrant, groq, logging
│   │   └── modules/
│   │       ├── analyze_website/
│   │       ├── document_processing/
│   │       ├── chatbot/
│   │       └── readiness_report/
│   ├── docs/
│   │   ├── ARCHITECTURE.md     ← module breakdown + Qdrant schema + lifecycle
│   │   └── API_CONTRACTS.md    ← frozen request/response payloads
│   ├── data/                   ← runtime state (models, qdrant storage, uploads, cache)
│   ├── scripts/
│   │   ├── init_qdrant.py      ← idempotent collection bootstrap
│   │   └── download_models.py  ← pulls BGE-small into data/models/
│   ├── tests/                  ← pytest suite (69 tests)
│   ├── requirements.txt
│   └── .env / .env.example
└── frontend/
    └── index.html              ← the static console (single file)
```

## The four endpoints

| Method | Path                       | What it does                                                        |
|--------|----------------------------|---------------------------------------------------------------------|
| POST   | `/v1/analyze-website`      | Crawl a URL → structured business profile + kb_master embeddings    |
| POST   | `/v1/process-documents`    | Parse uploaded PDF/DOCX/TXT → chunk → embed → kb_master             |
| POST   | `/v1/chat`                 | RAG over kb_master → grounded answer with citations                 |
| POST   | `/v1/generate-report`      | Aggregate kb_master → AI readiness score (0–100) + subscores        |
| GET    | `/v1/health`               | Liveness probe. Returns `200 {status: ok, …}`                       |
| GET    | `/`                        | Service metadata                                                    |
| GET    | `/docs`                    | Swagger UI with editable request bodies                             |

Full request / response shapes are in [`ai-service/docs/API_CONTRACTS.md`](ai-service/docs/API_CONTRACTS.md).

## Using the static frontend

Open `http://127.0.0.1:5500/` after `start.sh`. You'll see four cards and a green status dot. Run them in order with the same `business_id`:

1. Click **🎲 Random** for a fresh business_id.
2. **Analyze Website** — type `https://example.com`, click the button. Wait ~5-10 s.
3. **Process Documents** — pick any `.txt` file. Click the button. Wait ~2 s.
4. **Chat** — ask something your seed could answer. Citations appear under each answer.
5. **Generate Report** — click the button. Wait ~15-30 s (15 vector searches + one LLM JSON-mode call).

Re-clicking 🎲 Random starts a clean tenant in Qdrant.

## Troubleshooting

**Qdrant port 6333 already in use.** Something else is bound. Either stop it (`taskkill /F /IM qdrant.exe` on Windows, `pkill qdrant` on POSIX) or change `QDRANT_PORT` in `ai-service/.env` and update the install / start scripts to match.

**FastAPI port 8000 already in use.** Same fix — change `APP_PORT` in `.env`.

**Frontend `TypeError: Failed to fetch` in the browser console.** FastAPI is not running on `:8000`, or the browser is loading `index.html` from a non-loopback origin. Make sure you opened `http://127.0.0.1:5500/` (loopback) and not `http://localhost:5500/` (different origin on some setups). CORS is permissive by default.

**`empty_extraction` from `/v1/analyze-website`.** The crawler couldn't extract any text from the page. Common causes: the site is a single-page app rendered by JavaScript (e.g. `chatgpt.com`), the page requires login, or the URL 404s. Try a plain HTML site like `https://example.com` to confirm the crawler itself works.

**Groq `429` on big requests.** You hit the free-tier per-minute token limit. Add more keys to `GROQ_API_KEYS=...` (comma-separated) — the pool will rotate to the next key automatically.

**First-run download is slow.** `download_models.py` pulls ~93 MB on first install. Subsequent runs use the cache.

**`uvicorn` says "Address already in use".** A previous `start.sh` child process is still bound. `taskkill /F /IM python.exe /T` (Windows) or `pkill -f uvicorn` (POSIX), then re-run `start.sh`.

## What's not in this repo

- The backend gateway (auth, business CRUD, billing) — owned by another team.
- Frontend for end users (the static console in `frontend/` is for manual testing only).
- Persistent storage of generated reports (the AI service writes a snapshot into Qdrant's `readiness_reports` collection; the gateway is expected to copy this out).

See `ai-service/docs/ARCHITECTURE.md` for the system-level context.
