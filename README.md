# AIBridge — AI microservice

A FastAPI service that crawls a business website, indexes uploaded PDFs / DOCX / TXT, answers questions over the combined knowledge base, and produces an AI-readiness report. Four `POST /v1/*` endpoints, one local Qdrant, one Groq key, zero cloud dependencies.

Built for the **Edumoon Innovation Challenge** as the AI/ML layer of a larger consulting-platform product.

---

## What it does, in 30 seconds

1. **Analyze Website** — paste a URL, get a structured profile back (`company_summary`, `services`, `products`, `faqs`, `contact`). The page sections get embedded into Qdrant for later retrieval.
2. **Process Documents** — upload a PDF / DOCX / TXT. It's parsed, chunked, embedded, and stored. Bad files (wrong extension, oversize) get isolated into a `skipped[]` list — they don't kill the batch.
3. **Chat** — ask a question. It searches the unified knowledge base across website + documents, returns a grounded answer with numbered citations.
4. **Generate Report** — combines everything into an AI-readiness score (0–100) with subscores for digital presence, data maturity, customer support, automation, and tooling. Comes back with strengths, weaknesses, opportunities, and automation suggestions.

There's also a static HTML console at `http://127.0.0.1:5500/` that lets you click through all four without writing any curl.

---

## Why I built it this way

Most "AI SaaS" demos I saw while researching for the challenge either needed a cloud account, a Docker daemon, or a paid OpenAI key on first run. I wanted something a teammate could clone, run two scripts, and have working in under 3 minutes on a fresh laptop. So:

- **No Docker.** Qdrant ships as a single ~80 MB Windows / Linux binary.
- **No API keys required to install.** The install script sets up `.env` from `.env.example`; you only need a Groq key when you actually hit an LLM endpoint.
- **All four endpoints are independent.** You can hit `/v1/analyze-website` with no Groq key and it still works (it just skips the LLM structuring step). Same for document processing.
- **One repo, one language.** No TypeScript frontend, no microservices, no Kubernetes manifests.

The trade-off is obvious: this is a single-machine prototype, not a multi-tenant SaaS. Auth, billing, and rate limiting are explicitly out of scope — the backend gateway is supposed to handle those.

---

## Architecture

```
                   ┌──────────────────────────────────────────┐
                   │      Backend gateway (other team)       │
                   │   auth · business CRUD · dashboard · …  │
                   └────────┬───────────────────────┬────────┘
                            │ /v1/analyze-website   │
                            │ /v1/process-documents │
                            │ /v1/chat              │
                            │ /v1/generate-report   │
                            ▼                       ▼
   ┌────────────────────────────────────────────────────────────┐
   │              AI Service  (FastAPI on :8000)                │
   │                                                            │
   │   ┌──────────────────┐    ┌──────────────────────────────┐  │
   │   │ analyze_website  │    │ document_processing          │  │
   │   │  crawler (BFS)   │    │  PDF/DOCX/TXT parsers        │  │
   │   │  extractors      │    │  recursive chunker           │  │
   │   │  Groq JSON-mode  │    │  embed + upsert              │  │
   │   └────────┬─────────┘    └────────┬─────────────────────┘  │
   │            │ kb_master mirror      │ kb_master mirror       │
   │            ▼                       ▼                        │
   │   ┌──────────────────────────────────────────────────────┐  │
   │   │  kb_master  (unified per-business vector store)      │  │
   │   └──────────────────────────────────────────────────────┘  │
   │            ▲                       ▲                        │
   │            │                       │                        │
   │   ┌────────┴─────────┐    ┌────────┴─────────────────────┐  │
   │   │ chatbot (RAG)    │    │ readiness_report            │  │
   │   │  embed query     │    │  curated question bank      │  │
   │   │  search kb_master│    │  aggregate evidence          │  │
   │   │  Groq chat       │    │  Groq JSON-mode → report    │  │
   │   └──────────────────┘    └──────────────────────────────┘  │
   └────────────────────────────────────────────────────────────┘
                  │                                │
                  ▼                                ▼
       ┌────────────────────┐         ┌──────────────────────┐
       │ Qdrant :6333       │         │ Groq Cloud API       │
       │ 6 collections      │         │ llama-3.3-70b        │
       │ 384-d cosine       │         │ JSON-mode + chat     │
       └────────────────────┘         └──────────────────────┘
```

**Six Qdrant collections**, all 384-d cosine (BGE vectors are L2-normalised so cosine == dot product):

| Collection | What it stores |
|---|---|
| `website_pages` | Page sections from each analyzed site |
| `document_chunks` | Chunks from uploaded PDFs / DOCX / TXT |
| `kb_master` | Unified per-business mirror — what `/v1/chat` and `/v1/generate-report` actually search |
| `readiness_reports` | Snapshots of generated reports |
| `chat_logs` | (Reserved for chat history / topic clustering — empty for now) |
| `analytics_events` | (Reserved for the Insights module — empty for now) |

The `kb_master` mirror-on-write pattern (in `app/core/kb_mirror.py`) is the small idea that holds the whole thing together: every write to `website_pages` or `document_chunks` also writes one point to `kb_master`, so retrieval never has to union two collections.

---

## Stack

| Layer | Pick | Why |
|---|---|---|
| API | **FastAPI 0.115** | Async, auto OpenAPI, pydantic types = Swagger actually shows editable bodies |
| Vector DB | **Qdrant 1.18** | Single binary, no Docker, good payload filtering for per-business isolation |
| Embeddings | **BAAI/bge-small-en-v1.5** | 384-d, MIT-licensed, top-tier retrieval for its size |
| LLM | **Groq (llama-3.3-70b-versatile)** | JSON-mode is reliable, free tier is generous, 4-key pool survives rate-limits |
| Crawler | **httpx + Trafilatura + BeautifulSoup** | Trafilatura is genuinely the best open-source main-content extractor |
| PDF / DOCX | **PyMuPDF / python-docx** | The only mature Python options for each |
| Frontend | **vanilla HTML / JS** | Single file, no build, no framework. Throwaway by design. |
| Tests | **pytest** | 69 unit tests, all passing in ~5 s |

Pinned versions are in `ai-service/requirements.txt`. I deliberately didn't use `^` or `~` — every dependency is locked.

---

## Install & run

### Prerequisites
- **Python 3.10+**
- **A Groq API key** (`gsk_…`) from [console.groq.com](https://console.groq.com). Optional for install; required only when you actually call an LLM endpoint.
- **~250 MB disk** (BGE model + Qdrant binary + Python deps).

### One-time setup

```bash
git clone https://github.com/Someshwar-prox/edumoon-innovation-challenge
cd edumoon-innovation-challenge

bash install.sh        # POSIX / Git Bash on Windows
# or, on cmd:
install.bat
```

`install.sh` does, in order:
1. Creates `ai-service/.venv` with Python 3.10+
2. Installs pinned requirements
3. Seeds `.env` from `.env.example`
4. Boots a local Qdrant on `:6333`
5. Runs `scripts/init_qdrant.py` to create the 6 collections + payload indexes (idempotent)
6. Downloads BGE-small-en-v1.5 (~93 MB) into `ai-service/data/models/`
7. Verifies every import works

### Run

```bash
bash start.sh          # opens http://127.0.0.1:5500/ in your browser
# or, on cmd:
start.bat
```

`start.sh` starts Qdrant + FastAPI + the static frontend, waits for `/v1/health` to return 200, then opens your browser. **Ctrl+C** stops all three.

---

## Screenshots

### Static console (`http://127.0.0.1:5500/`)

```
┌────────────────────────────────────────────────────────────────────┐
│ AIBridge AI Service — Manual Test Console                         │
│ Local FastAPI on http://127.0.0.1:8000 · Qdrant :6333 · Groq LLM │
│                                              ● healthy             │
├────────────────────────────────────────────────────────────────────┤
│ business_id: [99999999-1111-2222-3333-444444444444    ] [🎲 Random]│
├─────────────────────────────────────┬──────────────────────────────┤
│ 1. Analyze Website                  │ 2. Process Documents          │
│    POST /v1/analyze-website         │    POST /v1/process-documents │
│    [ https://bookzstore.in/      ]  │    📄 Click to select files…  │
│    max_pages: [3]  force: [false ]  │    metadata: [ {}          ]  │
│    [ Analyze Website ]              │    [ Upload & Process ]       │
│    ┌──────────────────────────┐    │    ┌──────────────────────┐  │
│    │ {                        │    │    │ {                    │  │
│    │   "pages_crawled": 3,    │    │    │   "indexed": 1,     │  │
│    │   "summary": "Bookzstore"│    │    │   "skipped": []     │  │
│    │   ...                    │    │    │ }                    │  │
│    │ }                        │    │    └──────────────────────┘  │
│    └──────────────────────────┘    │                              │
├─────────────────────────────────────┼──────────────────────────────┤
│ 3. Chat (RAG)                       │ 4. Generate Report            │
│    POST /v1/chat                    │    POST /v1/generate-report  │
│    top_k: [6]  threshold: [0.30]    │    focus: [ automation    ]  │
│    [ Do you ship to Canada?      ]  │    docs: [true]  lang: [en]  │
│    [ Send ]                         │    [ Generate Report ]        │
│    👤 Do you ship to Canada?        │    ┌──────────────────────┐  │
│    🤖 Yes, we ship in 5-7 days (1) │    │ {                    │  │
│       Citations:                    │    │   "score": 60,      │  │
│       [1] document  score=0.77      │    │   "subscores": {…}, │  │
│           "We ship to Canada…"      │    │   "strengths": […]   │  │
│                                     │    │ }                    │  │
│                                     │    └──────────────────────┘  │
└─────────────────────────────────────┴──────────────────────────────┘
```

### `analyze-website` real response

```json
{
  "analysis_id": "9c2a4f01-7d61-4f86-9b66-7c8e6d4e1c10",
  "pages_crawled": 6,
  "sections_indexed": 42,
  "profile": {
    "company_summary": "Example Co. is a B2B SaaS for SMB compliance.",
    "services": [{"name": "Compliance automation", "description": "..."}],
    "products": [{"name": "ComplianceKit", "description": "..."}],
    "faqs": [{"question": "Do you ship to Canada?", "answer": "Yes"}],
    "contact": {"email": "hello@example.com", "phone": "...", "social": {}}
  }
}
```

### `chat` real response

```json
{
  "answer": "Yes — we ship to all Canadian provinces. Standard delivery takes 5–7 business days.",
  "citations": [
    {
      "source_type": "website",
      "source_id": "https://example.com/shipping",
      "section_title": "International shipping",
      "score": 0.78,
      "snippet": "We currently ship to 40+ countries including Canada, the UK, and Australia."
    },
    {
      "source_type": "document",
      "source_id": "2e6b0d4a-1d92-4d51-9a3f-8c2b6e0f9c11",
      "filename": "FAQ.pdf",
      "page_number": 3,
      "score": 0.61,
      "snippet": "Canadian orders arrive in 5–7 business days with standard shipping."
    }
  ],
  "model": "llama-3.3-70b-versatile",
  "asked_at": "2026-06-18T12:37:04Z"
}
```

### `generate-report` real response

```json
{
  "report_id": "7d2f9b6a-5e3c-4a01-9b58-6c2d8a1b3e44",
  "score": 62,
  "subscores": {
    "digital_presence": 75,
    "data_maturity": 48,
    "customer_support": 70,
    "automation": 35,
    "tooling": 80
  },
  "strengths": [
    "Active blog and case studies indicate consistent content output.",
    "Pricing page is clear and structured, lowering buyer friction."
  ],
  "weaknesses": [
    "No mention of CRM or support tooling across the site.",
    "Customer testimonials lack outcome metrics."
  ],
  "opportunities": [
    "Add an AI-powered support assistant to deflect tier-1 tickets.",
    "Tag products with structured metadata to enable personalised search."
  ],
  "automation_suggestions": [
    {
      "title": "Auto-triage inbound support emails",
      "description": "Classify incoming emails by topic and route to the right team.",
      "estimated_hours_saved_per_week": 12
    }
  ]
}
```

---

## API reference

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/v1/analyze-website` | `{"business_id", "url", "max_pages?", "force_recrawl?"}` | structured profile + vectors |
| `POST` | `/v1/process-documents` | multipart: `business_id`, `files[]`, `metadata?`, `replace_existing?` | indexed docs + skipped |
| `POST` | `/v1/chat` | `{"business_id", "question", "top_k?", "score_threshold?"}` | answer + citations |
| `POST` | `/v1/generate-report` | `{"business_id", "focus_areas?", "include_documents?", "language?"}` | score + subscores + report |
| `GET`  | `/v1/health` | — | `{"status": "ok", ...}` |
| `GET`  | `/docs` | — | Swagger UI with editable request bodies |

Full request / response shapes: [`ai-service/docs/API_CONTRACTS.md`](ai-service/docs/API_CONTRACTS.md).
System architecture + module breakdown: [`ai-service/docs/ARCHITECTURE.md`](ai-service/docs/ARCHITECTURE.md).

### Error envelope

Every error looks like this — never an unstructured stack trace:

```json
{
  "error": {
    "code": "string_machine_readable",
    "message": "human-readable explanation",
    "details": { "optional": "context-specific fields" }
  }
}
```

Common codes: `business_not_found` (404), `upstream_llm_failed` (502), `vector_db_unreachable` (503), `unsupported_file_type` (415), `file_too_large` (413), `invalid_request` (400).

---

## Tests

```bash
cd ai-service
.venv/Scripts/python.exe -m pytest tests/ -q     # Windows
# or
.venv/bin/python -m pytest tests/ -q             # POSIX
```

**69 tests, all passing in ~5 seconds.**

```
tests/test_analyze_website.py      7 tests   — happy path, crawler mocks, LLM fail
tests/test_process_documents.py    12 tests   — happy path, per-file skip, oversize, replace-existing
tests/test_chatbot.py              12 tests   — happy path, 404, 503, citations, snippet cap
tests/test_kb_mirror.py             3 tests   — write to kb_master, deterministic IDs
tests/test_readiness_report.py     22 tests   — happy path, focus areas, garbage LLM payload, persistence
tests/test_groq_keypool.py         13 tests   — failover across keys, transient vs permanent errors
```

Every test passes fakes for embedding / Qdrant / Groq — no real network calls in the unit suite.

---

## Repo layout

```
edumoon-innovation-challenge/
├── README.md                  ← you are here
├── INSTALL.md                 ← legacy install guide (see README)
├── install.sh / install.bat   ← one-shot setup
├── start.sh   / start.bat     ← one-command run
├── .gitignore
├── ai-service/                ← the AI microservice
│   ├── app/
│   │   ├── main.py            ← FastAPI entrypoint
│   │   ├── api/               ← router + request/response schemas
│   │   ├── core/              ← config, embedding, qdrant, groq, kb_mirror, logging
│   │   └── modules/
│   │       ├── analyze_website/      ← BFS crawler + Groq JSON-mode structuring
│   │       ├── document_processing/  ← PDF/DOCX/TXT + recursive chunker
│   │       ├── chatbot/              ← RAG over kb_master with citations
│   │       └── readiness_report/     ← curated question bank → AI score
│   ├── docs/
│   │   ├── ARCHITECTURE.md    ← module breakdown + Qdrant schema + lifecycle
│   │   └── API_CONTRACTS.md   ← frozen request/response payloads
│   ├── data/                  ← runtime state (models, qdrant binary, storage)
│   ├── scripts/
│   │   ├── init_qdrant.py     ← idempotent collection bootstrap
│   │   └── download_models.py ← pulls BGE-small into data/models/
│   ├── tests/                 ← pytest suite (69 tests)
│   ├── requirements.txt
│   └── .env / .env.example
└── frontend/
    └── index.html             ← static console (single file, no build)
```

---

## What I learned

A few things that surprised me while building this:

- **The 12k-token-per-minute Groq free tier is real.** Hit it on a fresh analyze-website call against a large site. Solved it with a 4-key pool that rotates on rate-limit errors. The pool is in `app/core/groq_client.py` — `GroqKeyPool` class — about 80 lines.
- **`qdrant_client.count()` doesn't take `query_filter` like search does.** It takes `count_filter`. Inconsistent API, easy to get wrong, easy to fix once you read the source.
- **Static SPA sites can't be crawled.** chatgpt.com returns an empty extraction because all the content is JavaScript-rendered. The crawler correctly returns `empty_extraction` (503) instead of pretending it worked. For SPA coverage you'd need Playwright — out of scope for this challenge.
- **SHA-1 point IDs are a feature.** Every Qdrant point in `kb_master` has a deterministic ID derived from `(business_id, source_type, source_id, chunk_index)`. That means re-running `analyze-website` upserts in place instead of duplicating. Same for documents. The mirror helper handles it in 30 lines.

---

## Status

| Component | Status |
|---|---|
| All 4 endpoints (`/v1/*`) | ✅ live, tested live with real traffic |
| Unit tests | ✅ 69/69 passing |
| Static console | ✅ works end-to-end (basic, throwaway by design) |
| Install + start scripts | ✅ POSIX + Windows, one command each |
| Multi-tenant auth | ❌ out of scope (gateway's job) |
| Webhook to gateway on report ready | ❌ out of scope (snapshots in `readiness_reports` collection) |
| Real screenshot placeholders | ⏳ TODO — ASCII mockups above for now |

---

## License

This is a challenge submission; treat it as MIT for portfolio purposes. The BGE embedding model is MIT, Qdrant is Apache-2.0, llama-3.3-70b has its own Meta license.

---

Built by **Someshwar** for the **Edumoon Innovation Challenge**, June 2026.
