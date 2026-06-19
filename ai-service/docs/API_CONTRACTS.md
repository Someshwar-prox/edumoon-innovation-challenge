# AIBridge AI Service — API Contracts

> Hand-off document for the backend / API-Gateway team.
>
> **Base URL (Day-1 dev):** `http://127.0.0.1:8000`
> **Versioning:** all endpoints live under `/v1`.
> **Content type:** `application/json` unless noted.
> **Day-1 status:** all routes return `501 Not Implemented` with the placeholder body shown below. The payload shapes in this document are the **contract** — they will not change when business logic lands.

## Conventions

### Authentication

Out of scope for this service. The gateway is expected to authenticate the caller and forward the verified `business_id` (UUID, owned by the gateway) on every request. The AI service does **not** validate tokens.

### `business_id`

Every request carries a `business_id` (string, UUID format). The AI service treats it as opaque and uses it as a Qdrant payload filter to isolate one tenant's data.

### IDs owned by the AI service

| ID                | Format                       | Where it comes from                              |
| ----------------- | ---------------------------- | ------------------------------------------------ |
| `analysis_id`     | UUIDv4                       | `POST /v1/analyze-website`                       |
| `document_id`     | UUIDv4                       | `POST /v1/process-documents`                     |
| `report_id`       | UUIDv4                       | `POST /v1/generate-report`                       |

These IDs are returned to the caller and should be persisted by the gateway for later reference (e.g. linking a report back to a business record).

### Error envelope

All errors follow this shape:

```json
{
  "error": {
    "code": "string_machine_readable",
    "message": "human-readable explanation",
    "details": { "optional": "context-specific fields" }
  }
}
```

HTTP status codes used: `200`, `400` (bad request), `404` (resource not found), `413` (upload too large), `415` (unsupported media type), `422` (validation failed), `429` (rate-limited by upstream), `500` (internal), `501` (Day-1 stub), `502` (Groq upstream failure), `503` (Qdrant unreachable).

### Common error codes

| `error.code`              | HTTP | Meaning                                              |
| ------------------------- | ---- | ---------------------------------------------------- |
| `invalid_url`             | 400  | `url` failed URL/host validation                     |
| `unsupported_file_type`   | 415  | Uploaded file extension is not PDF/DOCX/TXT          |
| `file_too_large`          | 413  | Upload exceeds configured limit (default 25 MB)      |
| `missing_business_id`     | 400  | `business_id` not provided                           |
| `business_not_found`      | 404  | No website analysis or documents for that business   |
| `upstream_llm_failed`     | 502  | Groq call failed after all keys in the pool are exhausted |
| `vector_db_unreachable`   | 503  | Qdrant is down                                       |
| `not_implemented`         | 501  | Endpoint exists but Day-1 stub                       |

---

## 1. `POST /v1/analyze-website`

Crawls a business website and extracts a structured profile. Stores section embeddings in Qdrant for later retrieval.

### Request

- Method / path: `POST /v1/analyze-website`
- Headers: `Content-Type: application/json`
- Body:

```json
{
  "business_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "url": "https://example.com",
  "max_pages": 8,
  "force_recrawl": false
}
```

| Field           | Type    | Required | Default | Notes                                                              |
| --------------- | ------- | -------- | ------- | ------------------------------------------------------------------ |
| `business_id`   | string  | yes      | —       | UUID owned by gateway                                              |
| `url`           | string  | yes      | —       | Must be `http(s)://…`; same-domain crawl only                      |
| `max_pages`     | integer | no       | 8       | 1 ≤ N ≤ 50. Caps the BFS crawl                                     |
| `force_recrawl` | boolean | no       | false   | When true, re-crawl even if cached; existing vectors are replaced  |

### Response — `200 OK`

```json
{
  "analysis_id": "9c2a4f01-7d61-4f86-9b66-7c8e6d4e1c10",
  "business_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "url": "https://example.com",
  "pages_crawled": 6,
  "sections_indexed": 42,
  "profile": {
    "company_summary": "Example Co. is a fictional placeholder used in documentation.",
    "services": [
      { "name": "Online sales", "description": "End-to-end e-commerce enablement." },
      { "name": "Subscription billing", "description": "Recurring revenue infrastructure." }
    ],
    "products": [
      { "name": "ExampleWidget", "description": "Embeddable checkout widget." }
    ],
    "faqs": [
      { "question": "Do you ship internationally?", "answer": "Yes, to 40+ countries." }
    ],
    "contact": {
      "email": "hello@example.com",
      "phone": "+1-555-0100",
      "address": "1 Example Way, Springfield, USA",
      "social": {
        "linkedin": "https://linkedin.com/company/example",
        "twitter": "https://twitter.com/example"
      }
    }
  },
  "crawled_urls": [
    "https://example.com",
    "https://example.com/about",
    "https://example.com/pricing"
  ],
  "created_at": "2026-06-18T12:34:56Z"
}
```

### Day-1 stub response — `501 Not Implemented`

```json
{
  "error": {
    "code": "not_implemented",
    "message": "/v1/analyze-website is scaffolded but business logic lands in Day 2.",
    "details": { "endpoint": "analyze_website" }
  }
}
```

---

## 2. `POST /v1/process-documents`

Parses one or more uploaded documents (PDF/DOCX/TXT), chunks them, embeds the chunks, and stores them in Qdrant.

### Request

- Method / path: `POST /v1/process-documents`
- Headers: `Content-Type: multipart/form-data`
- Form fields:

| Field            | Type   | Required | Notes                                                              |
| ---------------- | ------ | -------- | ------------------------------------------------------------------ |
| `business_id`    | string | yes      | UUID owned by gateway                                              |
| `files`          | file   | yes      | 1 ≤ N ≤ 10 files per request                                       |
| `metadata`       | string | no       | JSON-encoded string; free-form tags merged into each chunk payload |
| `replace_existing` | boolean | no    | If true, deletes prior vectors for the same `business_id` + `document_id` first |

Accepted file extensions: `.pdf`, `.docx`, `.txt`. Max size per file: **25 MB** (configurable).

#### Example `curl`

```bash
curl -X POST http://127.0.0.1:8000/v1/process-documents \
  -F "business_id=3fa85f64-5717-4562-b3fc-2c963f66afa6" \
  -F "files=@./FAQ.pdf" \
  -F "files=@./Policies.docx" \
  -F 'metadata={"tags":["public","v1"]}'
```

### Response — `200 OK`

```json
{
  "business_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "results": [
    {
      "document_id": "2e6b0d4a-1d92-4d51-9a3f-8c2b6e0f9c11",
      "filename": "FAQ.pdf",
      "size_bytes": 184320,
      "pages": 8,
      "chunk_count": 47,
      "token_estimate": 9120,
      "status": "indexed"
    },
    {
      "document_id": "8a17c3f2-22b1-4d3a-9d52-1e7b9c8e4d22",
      "filename": "Policies.docx",
      "size_bytes": 57344,
      "pages": null,
      "chunk_count": 22,
      "token_estimate": 4310,
      "status": "indexed"
    }
  ],
  "skipped": [
    {
      "filename": "image.png",
      "reason": "unsupported_file_type"
    }
  ],
  "created_at": "2026-06-18T12:35:01Z"
}
```

### Day-1 stub response — `501 Not Implemented`

```json
{
  "error": {
    "code": "not_implemented",
    "message": "/v1/process-documents is scaffolded but business logic lands in Day 2.",
    "details": { "endpoint": "document_processing" }
  }
}
```

---

## 3. `POST /v1/generate-report`

Combines a business's website content + uploaded documents into an AI readiness report.

### Request

- Method / path: `POST /v1/generate-report`
- Headers: `Content-Type: application/json`
- Body:

```json
{
  "business_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "focus_areas": ["customer_support", "automation", "data_maturity"],
  "include_documents": true,
  "language": "en"
}
```

| Field              | Type           | Required | Default | Notes                                                          |
| ------------------ | -------------- | -------- | ------- | -------------------------------------------------------------- |
| `business_id`      | string         | yes      | —       | UUID owned by gateway                                          |
| `focus_areas`      | string[]       | no       | all     | Subset of: `digital_presence`, `data_maturity`, `customer_support`, `automation`, `tooling` |
| `include_documents`| boolean        | no       | true    | If false, report draws only from website content               |
| `language`         | string         | no       | `"en"`  | Output language for prose sections                              |

### Response — `200 OK`

```json
{
  "report_id": "7d2f9b6a-5e3c-4a01-9b58-6c2d8a1b3e44",
  "business_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
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
    },
    {
      "title": "Lead enrichment from website visits",
      "description": "Use visit signals to auto-populate CRM records.",
      "estimated_hours_saved_per_week": 6
    }
  ],
  "roi_estimates": [
    {
      "suggestion_title": "Auto-triage inbound support emails",
      "estimated_annual_savings_usd": 28000,
      "confidence": "medium"
    }
  ],
  "sources_used": {
    "website_sections": 42,
    "document_chunks": 19
  },
  "created_at": "2026-06-18T12:36:12Z"
}
```

### Day-1 stub response — `501 Not Implemented`

```json
{
  "error": {
    "code": "not_implemented",
    "message": "/v1/generate-report is scaffolded but business logic lands in Day 2.",
    "details": { "endpoint": "readiness_report" }
  }
}
```

---

## 4. `POST /v1/chat`

Stateless RAG answer over a business's knowledge base. **Day-1 has no chat history** — every call is independent.

### Request

- Method / path: `POST /v1/chat`
- Headers: `Content-Type: application/json`
- Body:

```json
{
  "business_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "question": "Do you ship to Canada?",
  "session_id": "optional-uuid-from-widget",
  "top_k": 6,
  "score_threshold": 0.30
}
```

| Field             | Type    | Required | Default | Notes                                                          |
| ----------------- | ------- | -------- | ------- | -------------------------------------------------------------- |
| `business_id`     | string  | yes      | —       | UUID owned by gateway                                          |
| `question`        | string  | yes      | —       | 1–1000 characters                                              |
| `session_id`      | string  | no       | —       | Echoed back in citations for the widget's bookkeeping only     |
| `top_k`           | integer | no       | 6       | Max neighbours retrieved                                       |
| `score_threshold` | number  | no       | 0.30    | Cosine similarity floor; below this, neighbours are dropped    |

### Response — `200 OK`

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
  "model": "llama-3.1-70b-versatile",
  "asked_at": "2026-06-18T12:37:04Z"
}
```

When no neighbour passes `score_threshold`, the answer is `"I don't have that information in my current knowledge base."` and `citations` is `[]`.

### Day-1 stub response — `501 Not Implemented`

```json
{
  "error": {
    "code": "not_implemented",
    "message": "/v1/chat is scaffolded but business logic lands in Day 2.",
    "details": { "endpoint": "chatbot" }
  }
}
```

---

## 5. `GET /v1/health` (bonus — for gateway liveness probes)

`GET /v1/health` returns `200 OK` with `{ "status": "ok", "service": "ai-service", "version": "0.1.0" }`. Implemented in Day 1 so the gateway can wire probes immediately.

---

## 6. Versioning & breaking-change policy

- Contracts in this document are **Day-1 frozen**. Day-2 implementation must match.
- New optional fields may be added without bumping the version. Removing or renaming a field, changing a type, or changing a status code requires `/v2`.
- The AI service never returns fields the contract does not document (no leak of internal ids like Qdrant point ids).

## 7. Sequence — typical onboarding flow

```
1. Gateway  POST /v1/analyze-website  →  business_id + url
2. Gateway  POST /v1/process-documents  →  business_id + uploaded PDFs/DOCX/TXT
3. Gateway  POST /v1/generate-report  →  business_id
4. Widget   POST /v1/chat  →  business_id + question   (any time after step 1 or 2)
```

A business can be queried via `/v1/chat` as soon as either step 1 or step 2 has produced vectors for it. If neither has run, `/v1/chat` returns `404 business_not_found`.