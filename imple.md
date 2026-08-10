# Update Application and UI Features (Revised Plan)

This updated implementation plan incorporates your detailed requirements for the QnA query classifier, PDF report generation, and the comprehensive Automated Reconciliation (Recon) feature.

## User Review Required

> [!WARNING]
> **Massive Scope Increase - Recon Feature**: The reconciliation feature as described (multi-tiered matching engine, split-screen UI, client portal integration, lock periods) is a product in itself. I will implement the core engine and UI, but please note this involves significant new database tables (`BankTransaction`, `LedgerEntry`, `ReconMatch`, `ReconPeriodLock`) and complex UI work.
> 
> **Report Generation**: I will implement PDF generation. Are you comfortable adding a dependency like `weasyprint` or `reportlab` to the Python backend for robust PDF creation? (I'll plan for `reportlab` or a lightweight HTML-to-PDF approach).

## Open Questions

> [!CAUTION]
> 1. **Data Ingestion for Recon**: Will you rely on the existing `/upload` endpoint to ingest Bank Statements and Ledgers? Should I build a specific parsing pipeline for them to convert uploads into `BankTransaction` and `LedgerEntry` rows?
> 2. **Client Collaboration**: For the "Ask Client" portal, should this send an actual email/WhatsApp immediately, or just generate a shareable link that the CA can copy? (I'll plan for generating a shareable link for simplicity).

## Proposed Changes

---

### 1. Global & LLM Configuration
- **Model Update**: Replace `gemma4:e4b` with `gemma4:e2b` across all backend services, `.env`, UI components, and prompts.

### 2. Backend Architecture: QnA Classifier & Insights
- **Query Classifier**: Implement a two-pass LLM pipeline for QnA and AI Insights:
  1. **Pass 1 (Classifier)**: Analyzes the user's prompt (or the login trigger) and identifies what data is needed (e.g., `requires_deadlines: true`, `requires_recon_status: true`, `requires_missing_docs: true`).
  2. **Data Fetcher**: Gathers data from `ComplianceDeadline`, `MissingDocument`, `ReconciliationResult`, `Documents`, and the new Recon tables based on Pass 1.
  3. **Pass 2 (Generator)**: Feeds the aggregated data context to `gemma4:e2b` to generate a comprehensive, accurate response.
- **Client History**: Implement the `ClientHistory` model to track profile updates and recon activities.

### 3. Report Generation
- **PDF Export**: Create `app/services/pdf_generator.py`.
- Implement a helper function to compile a structured HTML/PDF report combining:
  - Client Metadata
  - Latest Recon Results & Unmatched Exceptions
  - Upcoming Deadlines & Missing Documents
- Add an endpoint `GET /api/clients/{id}/report` to trigger and download this PDF, stamped with the current timestamp.

### 4. Comprehensive Reconciliation Engine
#### Database Schema (New Tables)
- `BankTransaction`: `id`, `client_id`, `date`, `description`, `amount`, `type` (dr/cr), `status` (unmatched, matched, queried).
- `LedgerEntry`: `id`, `client_id`, `date`, `description`, `amount`, `type`, `status`.
- `ReconMatch`: `id`, `bank_txn_id`, `ledger_entry_id`, `match_tier` (exact, fuzzy, multi, manual), `confidence_score`, `created_by`.
- `ReconPeriodLock`: `id`, `client_id`, `month_year`, `locked_by`, `locked_at`, `status`.

#### The Matching Engine (`app/services/recon_engine.py`)
- **Tier 1 (Exact)**: Matches identical amounts and dates within 0 days.
- **Tier 2 (Fuzzy)**: Matches exact amounts within +/- 5 days, or slight text similarities in description (using basic string distance or LLM vector similarity if applicable).
- **Tier 3 (Multi)**: Simple subset sum algorithm (or basic heuristics) for 1-to-many matches.

#### Recon Endpoints
- `POST /api/recon/run`: Triggers the engine for a client/period.
- `POST /api/recon/match`: Manual override match from CA.
- `POST /api/recon/ask-client`: Generates a query link for unmatched rows.
- `POST /api/recon/lock`: Freezes the period.

### 5. Frontend UI Implementation
- **Dashboard**:
  - Revamp Doc Processing Chart to be "production-like" using Recharts (smooth curves, gradients, tooltips).
  - Implement AI Insights section with a "Re-scan" button, hooked up to the new Query Classifier pipeline.
- **Clients Page**: Fix the double-click navigation bug by ensuring state handlers and React Router `navigate` calls don't conflict.
- **Client Profile & QnA**: 
  - Render the QnA tab with "Sessions" sidebar, auto-naming via LLM, and chat history.
  - Render a "Download PDF Report" button.
- **Recon Dashboard (Split-Screen UI)**:
  - Implement a highly interactive split-screen view.
  - **Left Pane**: Unmatched Bank Transactions.
  - **Right Pane**: Unmatched Ledger Entries.
  - **Clicking a row** triggers "Smart Recommendations" (highlighting potential fuzzy matches).
  - **Actions**: "Match Selected", "Create Journal" (dummy UI for now), "Ask Client" (generates link).

## Verification Plan
1. Apply new Alembic migrations for Recon tables, QnA, and Client History.
2. Verify all LLM references are `e2b`.
3. Test the QnA Classifier by asking multi-domain questions ("What are the deadlines and recon status for this client?").
4. Upload dummy bank/ledger CSVs (I will create a basic ingest script) and run the Recon Engine. Verify Tier 1 and Tier 2 matches.
5. Test the Split-Screen UI for manual matching and exception handling.
6. Generate and download a PDF report.
