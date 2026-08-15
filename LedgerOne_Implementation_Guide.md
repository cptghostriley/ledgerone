# LedgerOne — Module-Wise Implementation Guide (for Antigravity)

**Purpose of this file:** This is a build spec for an AI-native CA practice OS, built on top of an already-working document extraction engine (Gemma4:e4b/e2b, multimodal, template-based). It is written to be handed to Antigravity as the working context for module-by-module implementation. Each module includes: purpose, data model deltas, API surface, background jobs, UX flow screen-by-screen, and acceptance criteria. Build in the sequence given — later modules assume earlier ones exist.

**Stack assumed** (already in place, extend rather than replace):
- FastAPI (Python) backend
- PostgreSQL with JSONB, GIN trigram indexing, pgvector
- Celery + Redis for async pipelines
- Ollama serving Gemma4 (e4b for heavy multimodal extraction, e2b for cheap/fast calls)
- React frontend
- Docker for deployment

**Core principle:** every module writes to and reads from one shared schema. No module gets its own database. The moat is the join, not any single feature.

---

## 0. Global Schema Foundations (build this before any module work)

These tables are shared infrastructure. Every module below assumes they exist.

```sql
-- Firms and users
firms (id, name, plan_tier, created_at)
users (id, firm_id, name, email, role ENUM('partner','staff','client'), created_at)

-- Clients (the CA's clients, not LedgerOne's users)
clients (id, firm_id, name, entity_type ENUM('proprietorship','partnership','llp','company','individual'),
         pan, gstin, contact_email, contact_phone, health_score, created_at)

-- Central document store — DocInt already writes here in some form; formalize it
documents (id, firm_id, client_id, uploaded_by, file_path, file_type, doc_type,
           template_id, status ENUM('queued','processing','processed','failed','needs_review'),
           extracted_data JSONB,       -- main structured fields
           ai_discoveries JSONB,       -- bonus/unstructured fields
           confidence_scores JSONB,    -- per-field confidence 0-1
           source_refs JSONB,          -- per-field {page, bbox} provenance
           reviewed_by, reviewed_at, uploaded_at)

-- Correction log — every human edit to an extracted field, this is your training signal
document_corrections (id, document_id, field_name, ai_value, corrected_value,
                       corrected_by, corrected_at)

-- Embeddings for retrieval (pgvector)
document_chunks (id, document_id, client_id, chunk_text, embedding VECTOR(768),
                  page_number, chunk_index, created_at)

-- Audit trail — cross-cutting, every AI action that a human can approve/reject logs here
audit_events (id, firm_id, client_id, document_id, module ENUM('docint','noticemgr','taxcalc',
              'compliancecal','clientportal','advisoryai','firmops'),
              action_type, ai_output JSONB, human_decision ENUM('approved','edited','rejected','pending'),
              decided_by, decided_at, created_at)
```

**Why `audit_events` exists as its own table, not per-module:** a CA firm's liability exposure means every AI-suggested output needs a uniform "who approved this and when" trail regardless of which module produced it. Build this table first; every module below writes to it.

**Antigravity build order for Module 0:** migrations → seed script with 1 firm, 3 clients, 2 users → confirm pgvector extension installed and a dummy embedding round-trips.

---

## 1. DocInt Hardening (extend what exists — do this first)

### Problem it solves
Extraction currently dead-ends in a UI card with no client binding, no correction feedback, no batch support.

### Data model deltas
Already covered in `documents` and `document_corrections` above. Add:
```sql
extraction_templates (id, firm_id, name, doc_type, field_schema JSONB, prompt_template TEXT,
                       created_by, created_at, is_active)
```

### API surface
- `POST /documents/upload` — accepts multi-file, client_id required, template_id optional (auto-detect if omitted)
- `GET /documents?client_id=&status=&doc_type=` — list with filters
- `GET /documents/{id}` — full extraction result incl. confidence + source_refs
- `PATCH /documents/{id}/fields/{field_name}` — correction endpoint, writes to `document_corrections` AND updates `extracted_data`
- `POST /documents/{id}/reprocess` — re-run extraction (existing "Reprocess" button, keep it)
- `GET /templates` / `POST /templates` — template CRUD

### Background jobs (Celery)
- `extract_document(document_id)` — calls Ollama/Gemma4:e4b for extraction, writes `extracted_data`, `confidence_scores`, `source_refs`; on completion enqueues `chunk_and_embed(document_id)`
- `chunk_and_embed(document_id)` — feeds Module 2 (Corpus & Retrieval)
- `batch_status_check` — periodic task pushing queue status to frontend via websocket/polling

### UX flow
1. **Upload screen**: multi-file drag-drop, client selector (required — this is the change from the current screenshot), template auto-suggested from filename/doc content, "Start New Upload" becomes a queue, not a single session.
2. **Queue/status board**: replaces the flat session list with grouped-by-client, status badges (Queued / Processing / Processed / Needs Review / Failed), bulk actions.
3. **Result screen** (what you already have, keep the layout): Main Extraction Result + AI Discoveries, but each field gets a small confidence dot (green >90%, amber 70-90%, red <70%) and clicking a field highlights the source region on a page-image viewer alongside.
4. **Correction**: editing a field opens inline, save writes to `document_corrections`, shows a small "corrected" tag going forward so the CA can see what AI got wrong originally (builds trust over time, and it's your fine-tuning dataset).
5. **Export**: a persistent "Export" button on the result screen — CSV/Excel of the client's extracted_data across all their documents. Ship this before anything else in this list; it's the fastest way to make the feature replace an Excel sheet today.

### Acceptance criteria
- Every document has a client_id.
- Every field edit is logged in `document_corrections`.
- CSV export works for a client's full document set.
- Batch upload of 10 files queues and processes without blocking the UI.

---

## 2. Corpus & Retrieval Layer (new — not in the original 8, but a prerequisite for #5 and #6)

### Problem it solves
NoticeMgr and AdvisoryAI both need "search this client's document history" — without a real retrieval layer they're just Gemma calls with no grounding, which is exactly the failure mode that makes CAs distrust AI tools.

### Data model
`document_chunks` (above). Chunking strategy: page-level for scanned docs, section-level (by heading) for text-native PDFs.

### API surface
- `POST /search` — `{client_id, query, top_k}` → hybrid search: pgvector cosine similarity + Postgres trigram fallback for exact terms (PAN, GSTIN, invoice numbers don't embed well, trigram catches them)
- Internal function `retrieve_context(client_id, query, top_k)` used by NoticeMgr and AdvisoryAI, not user-facing directly

### Background jobs
- `chunk_and_embed(document_id)` (triggered from DocInt pipeline)
- `reembed_on_correction(document_id)` — if a human correction changes a field materially, re-chunk/re-embed so retrieval reflects the corrected value, not the AI's original mistake

### UX flow
No dedicated screen — this is plumbing. Optional: a simple internal "search this client" bar in the client detail view for CA's own use, which doubles as your dogfooding test of retrieval quality before AdvisoryAI exists.

### Acceptance criteria
- Query "GST liability jump" against a seeded client's docs returns the right chunk in top-3 results.
- Trigram search catches an exact GSTIN even if semantic search misses it.

---

## 3. ClientPortal

### Problem it solves
Documents currently arrive over WhatsApp/email/Drive. This is the funnel and the stickiness wedge — clients touching the platform is what makes churn expensive for the CA to leave.

### Data model
```sql
client_portal_links (id, client_id, token, expires_at, created_by)
client_uploads (id, client_id, document_id, uploaded_via ENUM('portal','staff'), status)
document_requests (id, client_id, doc_type, description, status ENUM('pending','fulfilled'),
                    requested_by, due_date)
```

### API surface
- `POST /portal/links` — generate branded upload link for a client (magic-link auth, no password)
- `GET /portal/{token}` — client-facing view: what's requested, what's uploaded, what's missing
- `POST /portal/{token}/upload` — feeds straight into DocInt pipeline with client_id pre-bound
- `POST /portal/{token}/approve` — client digitally approves a return before filing (simple click-to-approve + timestamp, logged to `audit_events`)

### UX flow
1. **CA side**: on a client's page, "Request Documents" — pick doc types (GSTR-1, bank statement, etc.), optional due date, generates a shareable link.
2. **Client side** (no login, token-based): clean branded page — "Documents needed" checklist, drag-drop upload per item, progress bar, "Awaiting review" / "Approved" states.
3. **Approval step**: before a return is filed, CA marks it "ready for client approval," client sees a read-only summary + approve button, timestamp logged.

### Acceptance criteria
- A client with no account can upload via link and it lands correctly bound to their client_id.
- CA sees real-time "3 of 5 documents received" status.
- Approval action is timestamped and immutable in `audit_events`.

---

## 4. ComplianceCal

### Problem it solves
Deadline tracking across a whole client roster, currently done manually or in Excel. Deterministic — low AI risk, high daily-engagement value. This should be the screen a CA opens every morning.

### Data model
```sql
compliance_obligations (id, client_id, obligation_type, due_date, status ENUM('upcoming','due','overdue','filed'),
                         auto_generated BOOLEAN, source_document_id, assigned_to)
obligation_rules (entity_type, obligation_type, recurrence_rule, offset_days) -- static config table
```

### API surface
- `GET /compliance/calendar?firm_id=&range=` — matrix view across all clients
- `POST /compliance/obligations` — manual add
- Auto-population: when DocInt processes a document with `doc_type = 'GSTR-1'` and a period field, a Celery job derives the next filing deadline via `obligation_rules` and inserts into `compliance_obligations` with `auto_generated=true`

### Background jobs
- `derive_obligations_from_document(document_id)` — hooked into the DocInt pipeline completion event
- `daily_deadline_digest` — cron job, pushes "what's due this week" summary (email or in-app)

### UX flow
1. **Dashboard**: single view, rows = clients, columns = this week/next week/overdue, color-coded.
2. **Client detail**: full obligation timeline for one client, entity-type-aware (a company sees more obligation types than a proprietorship).
3. **Auto-populated badge**: obligations derived from a document show a small "auto" tag with a link back to the source document — builds trust that it's not guessing.

### Acceptance criteria
- Uploading a GSTR-1 for October auto-creates the Nov 11 deadline without manual entry.
- Dashboard correctly filters by entity type's applicable obligations.

---

## 5. TaxCalc

### Problem it solves
Deterministic computation on top of extracted data — advance tax, TDS shortfall, 234B/234C interest. Replaces the CA's Excel calculator.

### Data model
```sql
tax_computations (id, client_id, financial_year, quarter, computation_type,
                   input_data JSONB, output_data JSONB, computed_at, reviewed_by)
```

### API surface
- `POST /taxcalc/compute` — `{client_id, financial_year}` → pulls latest extracted P&L/balance sheet/challan data via `extracted_data` joins, runs deterministic Python computation (not LLM), returns instalment schedule + interest liability
- `GET /taxcalc/{client_id}/checklist` — filing checklist per client per quarter

### Background jobs
- `recompute_on_new_document(document_id)` — if a new challan or P&L doc lands for a client, flag their latest computation as stale, prompt recompute

### UX flow
1. **Client tax view**: quarterly instalment schedule, computed liability vs. paid, shortfall highlighted in red.
2. **"Recompute" trigger**: whenever underlying documents change, a banner: "New data available — recompute?" rather than silently auto-updating a filed number.
3. **Checklist export**: PDF/Excel filing checklist per client, per quarter.

### Acceptance criteria
- Computation is 100% deterministic Python — LLM only touches extraction, never the math.
- Recompute correctly picks up a newly uploaded challan.

---

## 6. NoticeMgr

### Problem it solves
GST/income tax notice response drafting, grounded in the client's actual document corpus. Highest urgency, most defensible module — depends on Module 2 (Corpus & Retrieval) being solid.

### Data model
```sql
notices (id, client_id, document_id, section_number, demand_amount, response_deadline,
          status ENUM('received','drafting','under_review','responded'), draft_response TEXT)
notice_drafts (id, notice_id, version, content TEXT, generated_by ENUM('ai','human'),
               retrieved_context_ids JSONB, created_at)
```

### API surface
- `POST /notices/{document_id}/draft` — triggers: extract notice fields (already via DocInt) → `retrieve_context(client_id, notice_summary)` from Module 2 → Gemma drafts response grounded in retrieved context → saved as `notice_drafts` version 1
- `GET /notices/{id}/drafts` — version history
- `POST /notices/{id}/approve` — CA sign-off, logs to `audit_events`

### UX flow
1. **Notice intake**: notice PDF uploaded (via DocInt, doc_type='notice'), auto-extracts section, demand amount, deadline → auto-creates `compliance_obligations` entry too (cross-module hook into Module 4).
2. **Draft view**: split screen — notice on left, AI-drafted response on right, each claim in the draft response shows which source document it pulled from (citation chips, using `retrieved_context_ids`).
3. **CA edits and approves**: edits tracked as new version, final approval required before status moves to "responded."

### Acceptance criteria
- Every factual claim in a draft response is traceable to a specific retrieved document chunk.
- No response is markable "responded" without an explicit human approval event.

---

## 7. AdvisoryAI

### Problem it solves
Chat interface over a client's full document history, citation-grounded. Premium tier, hardest trust bar — build last among the AI modules, once retrieval (Module 2) has been proven out by NoticeMgr.

### Data model
```sql
advisory_conversations (id, client_id, user_id, created_at)
advisory_messages (id, conversation_id, role ENUM('user','assistant'), content TEXT,
                    cited_chunks JSONB, created_at)
```

### API surface
- `POST /advisory/chat` — `{client_id, conversation_id, message}` → `retrieve_context` → Gemma answers with mandatory citation format → response includes `cited_chunks` with document + page refs
- Prompt constraint: system prompt must instruct the model to refuse to answer if retrieval returns no relevant chunks, rather than generating unsupported content — this is the single most important prompt-engineering decision in this module.

### UX flow
1. **Chat panel** on client detail page: "What's my client Sharma & Sons' effective tax rate over the last 3 years?"
2. **Every answer renders with inline citation chips** — clicking one opens the source document at the right page. No un-cited claims should render.
3. **"I don't have enough information" state** — when retrieval is empty/weak, the UI should visibly show this as a distinct state, not a hedge buried in text.

### Acceptance criteria
- Zero responses without at least one citation, or an explicit "insufficient data" response.
- Citation click navigates to the correct source page.

---

## 8. FirmOps

### Problem it solves
Internal ops layer — staff assignment, client health scores, billing. This is what justifies firm-tier pricing. Build last — it needs multiple staff and real usage data to be meaningful.

### Data model
```sql
tasks (id, firm_id, client_id, assigned_to, title, due_date, status, linked_module, linked_record_id)
billing_subscriptions (id, firm_id, plan_tier, razorpay_subscription_id, status)
client_health_scores (id, client_id, score, computed_at, factors JSONB) -- derived from
  -- obligation lateness (Module 4), correction rate (Module 1), notice backlog (Module 6)
```

### API surface
- `POST /tasks` / `GET /tasks?assigned_to=&status=`
- `GET /firmops/dashboard` — firm-level view: staff workload, overdue tasks, client health heatmap
- Razorpay webhook integration for subscription + credit pack billing

### UX flow
1. **Partner dashboard**: staff workload grid, client health heatmap (red = high risk — overdue filings, unread notices, low document compliance).
2. **Task assignment**: can be manual or auto-suggested (e.g. an overdue TaxCalc computation auto-suggests a task to the assigned staff member).
3. **Billing**: subscription tier view, credit pack usage (if metering AI calls), Razorpay checkout embed.

### Acceptance criteria
- Client health score correctly aggregates signals from at least 3 other modules.
- Task auto-suggestion fires from a real cross-module event (not just a cron placeholder).

---

## Build Sequencing Summary

| Order | Module | Why here |
|---|---|---|
| 0 | Global schema | Everything depends on it |
| 1 | DocInt hardening | Already exists, fastest path to "actually useful" |
| 2 | Corpus & Retrieval | Prerequisite for NoticeMgr and AdvisoryAI — build before you need it, not during |
| 3 | ClientPortal | Lowest AI risk, highest stickiness, input funnel |
| 4 | ComplianceCal | Deterministic, daily-habit-forming dashboard |
| 5 | TaxCalc | Deterministic, replaces Excel directly |
| 6 | NoticeMgr | Highest-value AI module, now safely grounded |
| 7 | AdvisoryAI | Hardest trust bar, needs retrieval proven first |
| 8 | FirmOps | Needs real multi-user, multi-module data to matter |

## Instructions for Antigravity

- Work module by module in the order above. Do not start a module until the previous one's acceptance criteria pass.
- Every AI-generated output that a human can act on must write an `audit_events` row before it's exposed as "final" in the UI — treat this as a lint rule, not a suggestion.
- Reuse `retrieve_context()` from Module 2 in both Module 6 and Module 7 rather than writing separate retrieval logic — if the implementations diverge, flag it back rather than silently forking.
- Gemma4:e4b for multimodal extraction (Module 1), Gemma4:e2b acceptable for drafting/chat where speed matters more than multimodal input (Modules 6, 7).
- All deterministic math (Module 5) must be plain Python, never routed through the LLM — this is a correctness and liability boundary, not a style preference.
- Each module should ship with a seed script and a smoke test hitting its acceptance criteria before moving to the next.
