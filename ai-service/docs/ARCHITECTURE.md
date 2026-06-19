# AIBridge — AI Service Architecture

> Companion document to `API_CONTRACTS.md`. Read this first for "why", then contracts for "how to call it".

## 1. Scope & non-goals

The AI service is one of three owned by separate teams:

| Layer                | Owner                       |
| -------------------- | --------------------------- |
| Frontend / dashboard | (other team)                |
| Backend / Auth / API Gateway / business CRUD | (other team) |
| **AI / ML service**  | **us — this repo**          |

The AI service **does not**:

- authenticate users or issue tokens;
- know about users, businesses, or subscriptions as records;
- render pages or hold frontend state.

It **does**:

- crawl + extract structured facts from a business website;
- parse uploaded documents into embedded chunks in Qdrant;
- generate readiness reports from a business's website + documents;
- answer user questions via RAG over a per-business knowledge base.

The backend gateway passes `business_id` (a UUID owned by it) on every request. We treat it
as an opaque string and use it as a Qdrant payload filter. We never validate that it
exists in any user table.

## 2. High-level architecture

```
                   ┌────────────────────────────────────────────────────────┐
                   │                  Backend / API Gateway                  │
                   │   (auth, business CRUD, dashboard, billing — other team)│
                   └───────────────────┬─────────────────┬──────────────────┘
                                       │ HTTPS           │ HTTPS
                                       │ /v1/analyze-website
                                       │ /v1/process-documents
                                       │ /v1/generate-report
                                       │ /v1/chat
                                       ▼                 ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │                          AI Service (FastAPI)                            │
   │                                                                          │
   │   ┌───────────────┐  ┌─────────────────┐  ┌──────────────┐  ┌─────────┐  │
   │   │ Website       │  │ Document        │  │ Readiness    │  │ Chat    │  │
   │   │ Analyzer      │  │ Processor       │  │ Report Gen   │  │ Service │  │
   │   └──────┬────────┘  └────────┬────────┘  └──────┬───────┘  └────┬────┘  │
   │          │ HTTPX + BS4       │ PyMuPDF/docx     │ LLM (Groq)   │ LLM     │
   │          │ + LLM extract     │ + chunker        │ + scoring    │ (Groq)  │
   │          ▼                   ▼                 ▼              ▼         │
   │   ┌──────────────────────────────────────────────────────────────────┐   │
   │   │         Embedding Pipeline (sentence-transformers, local)         │   │
   │   └──────────────────────────────┬───────────────────────────────────┘   │
   │                                  │                                       │
   │   ┌──────────────────────────────▼───────────────────────────────┐      │
   │   │                       Qdrant (local)                          │      │
   │   │  website_pages · document_chunks · kb_master · reports · …     │      │
   │   └───────────────────────────────────────────────────────────────┘      │
   └──────────────────────────────────────────────────────────────────────────┘
```

## 3. Folder structure

```
ai-service/
├── app/
│   ├── main.py                   # FastAPI entrypoint, lifespan, router wiring
│   ├── api/
│   │   └── routes/               # one router per module, all under /v1
│   ├── core/
│   │   ├── config.py             # pydantic-settings, single source of truth
│   │   ├── embedding.py          # SentenceTransformer wrapper (Day 2)
│   │   ├── qdrant.py             # client + collection-name constants
│   │   └── groq_client.py        # Groq SDK wrapper (Day 2)
│   └── modules/
│       ├── analyze_website/
│       ├── document_processing/
│       ├── readiness_report/
│       └── chatbot/
├── data/
│   ├── models/                   # local embedding model cache
│   ├── qdrant/                   # local Qdrant storage
│   ├── uploads/                  # raw uploaded files (PDF/DOCX/TXT)
│   └── cache/                    # raw HTML from crawler (for re-extraction)
├── scripts/
│   ├── init_qdrant.py            # idempotent collection bootstrap
│   └── download_models.py        # pre-downloads the embedding model
├── docs/
│   ├── ARCHITECTURE.md
│   └── API_CONTRACTS.md
├── tests/
├── requirements.txt
├── .env.example
└── README.md
```

## 4. Module breakdown

### Module 1 — Website Analysis (`analyze_website/`)

- **Input:** `url`, optional `business_id`, optional `max_pages`.
- **Pipeline:**
  1. `crawler.fetch(url)` — BFS over same-domain links, capped by `CRAWLER_MAX_PAGES`. Honours `robots.txt`, normalises URLs, dedupes, saves raw HTML to `data/cache/<business_id>/`.
  2. `extractor.extract_pages(pages)` — strips nav/footer, splits into sections per heading, builds one structured prompt per page.
  3. `extractor.summarise(pages)` — one Groq call asks the model to emit JSON matching `WebsiteProfile`.
  4. `embedder.embed(sections)` — embeds each section, writes points to `website_pages` (filtered by `business_id`).
  5. Returns `WebsiteProfile` to the caller; the gateway persists it.
- **Output:** `WebsiteProfile { company_summary, services[], products[], faqs[], contact }`.

### Module 2 — Document Processing (`document_processing/`)

- **Input:** multipart upload (`file`, `business_id`, optional `metadata`).
- **Pipeline:** save → parse (`pymupdf` / `python-docx` / plain `read`) → normalise whitespace → `chunker.split(text, size, overlap)` → embed → upsert into `document_chunks` with `payload={business_id, document_id, chunk_index, source_type="document", filename}`.
- **Output:** `{ document_id, chunk_count, token_estimate }`.

### Module 3 — AI Readiness Report (`readiness_report/`)

- **Input:** `business_id` (so we can pull its stored website + documents).
- **Pipeline:**
  1. Aggregate facts: top-K nearest neighbours from `website_pages` ∪ `document_chunks` for a curated query bank (digital presence, data maturity, customer support, ops automations, tooling).
  2. Run a single structured Groq prompt that returns JSON matching `ReadinessReport`.
  3. Score = weighted sum of sub-scores (presence, data, support, automation, tooling). Weights are configurable.
  4. Persist full report (incl. raw LLM output) in `readiness_reports`.
- **Output:** `ReadinessReport { score, subscores, strengths[], weaknesses[], opportunities[], automation_suggestions[], roi_estimates[] }`.

### Module 4 — RAG Chatbot (`chatbot/`)

- **Input:** `business_id`, `question`, optional `session_id`.
- **Pipeline (stateless, no chat history):**
  1. Embed `question` with the same model used at ingestion.
  2. `qdrant.search(collection="kb_master", query_vector=…, filter={business_id}, top_k=CHAT_TOP_K, score_threshold=CHAT_SCORE_THRESHOLD)`.
  3. Concatenate top hits into a context block, capped at `CHAT_MAX_CONTEXT_CHARS`.
  4. Groq chat completion with system prompt `You are a support assistant for <business>. Use ONLY the supplied context. If unsure, say you don't know.`
  5. Log the question + retrieved ids into `chat_logs` and `analytics_events` (fire-and-forget).
- **Output:** `{ answer, citations:[{source_type, source_id, score, snippet}] }`.

## 5. Data flow

```
[Gateway] --POST /v1/analyze-website--> [WebsiteAnalyzer]
                                            │  crawl + extract
                                            ├─► raw HTML  -> data/cache/<bid>/
                                            └─► vectors   -> qdrant|website_pages

[Gateway] --POST /v1/process-documents(multipart)--> [DocumentProcessor]
                                            │  parse + chunk + embed
                                            └─► vectors   -> qdrant|document_chunks

[Gateway] --POST /v1/generate-report--> [ReadinessReport]
                                            │  aggregate neighbours from website_pages + document_chunks
                                            └─► vector+json -> qdrant|readiness_reports

[Widget]  --POST /v1/chat--> [Chatbot]
                                            │  embed(question)
                                            │  search qdrant|kb_master
                                            │  prompt Groq
                                            └─► answer + citations
                                                (also: question vector -> qdrant|chat_logs
                                                        event        -> qdrant|analytics_events)
```

## 6. Qdrant collection design

All collections use **cosine distance** (the embedding model produces L2-normalised
vectors). `business_id` is a **keyword payload field** on every collection — it is the
primary filter for almost every query. Indexes are created by `scripts/init_qdrant.py`.

| Collection           | Size    | Purpose                                                                                              | Key payload fields                                                              |
| -------------------- | ------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `website_pages`      | 384     | Page-level sections scraped from a business website.                                                  | `business_id`, `source_type="website"`, `url`, `section_title`, `section_index`  |
| `document_chunks`    | 384     | Chunks from uploaded PDF/DOCX/TXT.                                                                    | `business_id`, `source_type="document"`, `document_id`, `chunk_index`, `filename`|
| `kb_master`          | 384     | Unified per-business mirror of website + documents for fast chat retrieval.                          | `business_id`, `source_type`, `source_id`, `origin_collection`                   |
| `readiness_reports`  | 384     | Vector summary of each report + full report JSON in payload for retrieval.                           | `business_id`, `report_id`, `version`, `score`, `created_at`                     |
| `chat_logs`          | 384     | Embedded user questions (Day 2+); supports topic clustering & history replay.                         | `business_id`, `session_id`, `question_text`, `asked_at`                         |
| `analytics_events`   | 384     | Embedded event descriptions (questions, doc uploads, report views) for Insights module clustering.   | `business_id`, `event_type`, `created_at`                                       |

Distance metric: **COSINE**. Vector size: **384** (driven by `BAAI/bge-small-en-v1.5`).

## 7. Embedding strategy

- Model: `BAAI/bge-small-en-v1.5` (Apache-2.0, 33M params, 384 dim, fast on CPU).
- Stored **locally** under `ai-service/data/models/`; never fetched at request time.
- Loaded once at FastAPI startup; cached on `app.state.embedding_model`.
- Query prefix: BGE recommends prepending `"Represent this sentence for searching relevant passages: "` to query strings at retrieval time. We do **not** add the prefix at ingestion.
- L2-normalised at model output → cosine == dot product → fast HNSW.
- `EMBEDDING_BATCH_SIZE=32` is the default; tune up on GPU.

## 8. Chunking strategy

- Defaults: `CHUNK_SIZE=500` characters, `CHUNK_OVERLAP=80`.
- **Algorithm:** recursive character splitter with separator fallback
  `["\n\n", "\n", ". ", "? ", "! ", " ", ""]`. We chose character-level (not token-level)
  because BGE tokenises internally and overlap in characters > 0.15 × chunk size gives
  reliable cross-chunk recall on long-form docs.
- Strip page headers/footers/page-numbers from PDF extracts before chunking.
- Drop chunks shorter than 50 chars (likely navigation/menu residue).
- Preserve metadata per chunk: `document_id`, `chunk_index`, `filename`, optional `page_number`.

## 9. Local Qdrant (Windows)

The simplest Day-1 setup runs Qdrant on the same machine as the AI service:

1. Download the Qdrant binary for Windows from <https://github.com/qdrant/qdrant/releases>.
2. From any directory:
   ```bash
   qdrant.exe --storage-snapshots-dir D:/ai-bridge/ai-service/data/qdrant/snapshots ^
              --uri http://127.0.0.1:6333
   ```
3. Confirm with `curl http://127.0.0.1:6333/collections`.
4. Run `python scripts/init_qdrant.py`.

Data persists under `D:/ai-bridge/ai-service/data/qdrant/`. **Never** put Qdrant storage on `C:\`.

## 10. Operational notes

- All file paths come from `app.core.config.settings` and are resolved to absolute paths at startup.
- Logs go to stdout in JSON (Day 2: add `python-json-logger`).
- All Groq calls use `tenacity` retries with exponential back-off (Day 2).
- No background workers in Day 1 — the crawler is on-demand; the sync scheduler lands later.