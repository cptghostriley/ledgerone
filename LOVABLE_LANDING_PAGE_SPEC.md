# Quantive (LedgerOne) — AI Landing Page Build Specification & Lovable Prompt

> **Purpose:** This document provides a complete, high-level project description, module roadmap, design system, and section-by-section specification for building the official landing page for **Quantive** (the AI-native Practice OS for Chartered Accountants). 
> 
> You can copy and paste the [Lovable Prompt Section](#lovable-ai-prompt-copy-paste-ready) directly into Lovable, V0, or Bolt.new to generate a world-class, production-ready landing page.

---

## 1. Executive Summary & Product Vision

**Quantive** (formerly LedgerOne) is an on-premise, AI-native Operating System engineered specifically for Indian Chartered Accountants, audit firms, and tax practitioners.

Unlike generic accounting software or cloud AI wrappers, Quantive runs **100% locally on the firm's own infrastructure** (powered by local Ollama serving Gemma 4 models). Zero client financial data leaves the firm's premises, satisfying strict ICAI confidentiality standards, Section 138 of the Income Tax Act, and client data privacy laws.

### Core Value Proposition
1. **100% Air-Gapped & Private AI**: Runs locally on local GPU/CPU servers. No API keys sent to third-party clouds (OpenAI/Anthropic).
2. **Automated Multi-Document Extraction**: Multimodal OCR and structured extraction for bank statements (HDFC, ICICI, SBI, Axis), GST returns, TDS certificates, and invoices.
3. **Deterministic Math + AI Intelligence**: Math, tax computations, interest under Section 234B/234C, and advance tax schedules are computed via 100% deterministic code. AI handles extraction, semantic search, and notice drafting.
4. **Immutable ICAI Audit Trail**: Every AI output, extraction edit, notice response approval, or client filing signoff is logged to a central, immutable `audit_events` ledger with exact timestamp and user provenance.

---

## 2. Complete Module Roadmap (Current & Future Modules)

Quantive is built around **one unified PostgreSQL schema** where every module reads and writes to shared client, document, and audit records.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          QUANTIVE PRACTICE OS ARCHITECTURE                      │
├─────────────────┬─────────────────┬──────────────────┬──────────────────────────┤
│ 1. DocInt       │ 2. Corpus & RAG │ 3. ClientPortal  │ 4. ComplianceCal         │
│ Multimodal OCR  │ Vector +        │ Magic Links &    │ Auto-Deadline Matrix     │
│ & Extraction    │ Trigram Search  │ Client Approvals │ GST/ITR/TDS Roster       │
├─────────────────┼─────────────────┼──────────────────┼──────────────────────────┤
│ 5. TaxCalc      │ 6. NoticeMgr    │ 7. AdvisoryAI    │ 8. FirmOps               │
│ Advance Tax &   │ Citation-Backed │ Grounded CA Chat │ Workload Analytics &     │
│ Interest Math   │ Notice Defense  │ & Q&A Engine     │ Client Health Heatmap    │
└─────────────────┴─────────────────┴──────────────────┴──────────────────────────┘
```

### Detailed Breakdown of All 8 Modules

#### Module 1: DocInt (Document Intelligence & Multimodal OCR)
- **Status:** Live / Production
- **What it does:** Processes multi-file batches of invoices, bank statements, GSTR-1/3B/2B files, and Form 16/26AS. Provides a split-screen viewer showing extracted JSON fields alongside source bounding-box regions.
- **Features:** Confidence dot indicators (Green >90%, Amber 70-90%, Red <70%), inline field human corrections (logged to `document_corrections` for continuous feedback), and 1-click bulk CSV/Excel exports.

#### Module 2: Corpus & Retrieval Layer (Hybrid Pgvector + Trigram Search)
- **Status:** Core Infrastructure
- **What it does:** Automatically chunks and embeds processed documents into Postgres `pgvector` (768-dim embeddings).
- **Features:** Combines semantic vector similarity with exact trigram matching (for PANs, GSTINs, invoice numbers, and bank transaction refs) to ensure zero hallucination in downstream AI modules.

#### Module 3: ClientPortal (Passwordless Magic-Link Funnel)
- **Status:** Client Engagement Wedge
- **What it does:** Enables CAs to generate instant branded upload links for clients without requiring passwords or app downloads.
- **Features:** Real-time document request checklists ("3 of 5 received"), drag-and-drop client uploads directly into DocInt, and 1-click digital client filing approval signoffs.

#### Module 4: ComplianceCal (Automated Practice Calendar)
- **Status:** Daily CA Command Center
- **What it does:** Real-time deadline matrix across the firm's entire client roster for GST (GSTR-1, 3B, 9/9C), Income Tax (ITR-3, 5, 6, 7), TDS (Form 24Q, 26Q), and ROC filings.
- **Features:** Auto-derives future filing deadlines directly from uploaded documents, entity-type filtering (Proprietorship, LLP, Pvt Ltd), and color-coded urgency badges (Overdue, Due in 7d, Upcoming).

#### Module 5: TaxCalc (Deterministic Tax Computation Engine)
- **Status:** Advance Tax & Interest Calculator
- **What it does:** Pulls extracted P&L, balance sheet, and challan data to calculate quarterly advance tax payments, TDS shortfalls, and Section 234A/234B/234C interest liabilities.
- **Features:** 100% deterministic Python math engine (no LLM math risks), instant "Recompute" triggers when new documents are uploaded, and PDF tax computation sheet exports.

#### Module 6: NoticeMgr (AI Notice Defense & Grounded Response Drafting)
- **Status:** High-Value AI Defense Module
- **What it does:** Ingests GST and Income Tax demand notices, auto-extracts section numbers, demand amounts, and deadlines, and drafts legally grounded response letters.
- **Features:** Split-screen draft editor with interactive citation chips linking every claim directly to exact pages in the client's past document corpus. Mandatory human partner sign-off before response marking.

#### Module 7: AdvisoryAI (Citation-Grounded CA Assistant)
- **Status:** Grounded Advisory Q&A
- **What it does:** Conversational chat interface over a client's entire multi-year financial archive.
- **Features:** Strict anti-hallucination prompt rules (refuses to answer if source chunks are missing), clickable inline citation pills jumping to exact document pages, and multi-year comparative tax/turnover analysis.

#### Module 8: FirmOps (Practice Management & Client Health Analytics)
- **Status:** Executive Management Layer
- **What it does:** Provides partner-level insights into staff workload distribution, pending audit tasks, firm revenue, and client health scores.
- **Features:** Client Health Heatmap (combining filing lateness, notice backlogs, and document completion rates), staff task allocation, and automated task suggestions.

---

## 3. Brand & Design System Aesthetics

The landing page must mirror the exact visual language of the internal Quantive app:

### Color Palette (HSL & Dark Void Base)
- **Background Base:** Cosmic Obsidian / Deep Dark Navy (`hsl(224 35% 8%)` / `#0d1117`)
- **Card Surfaces:** Translucent Glassmorphism (`hsl(224 30% 11% / 0.75)` with `backdrop-blur-xl`, border `hsl(224 20% 18% / 0.6)`)
- **Primary Indigo Accent:** `hsl(217 91% 60%)` (`#3b82f6` to `#6366f1`)
- **Aurora Gradient Waves (`var(--gradient-aurora)`):**
  - Indigo: `hsl(217 91% 60%)`
  - Electric Teal/Cyan: `hsl(198 85% 60%)`
  - Amber Gold: `hsl(28 85% 60%)`
  - Slate Violet: `hsl(260 65% 60%)`
  - Mint Emerald: `hsl(158 65% 50%)`
- **Text Styling:** Primary headings in `text-foreground` (`#f3f4f6`), subtitles in `text-muted-foreground` (`#9ca3af`), and gradient accent text `.text-aurora`.

### Typography & Numerics
- **Display Font:** Modern Sans-Serif (Outfit / Inter / General Sans) with heavy bold weights (`font-extrabold`, `tracking-tight`).
- **Numerical Figures:** Tabular lining numbers (`num-tabular` / `font-mono`) for audit figures, accuracy percentages, and count statistics.

### Signature Visual Elements
1. **Brand Mark (Quantive Q Crest):** An abstract, geometric monogram **Q** featuring a sleek rounded square badge container, a 270° precision quadrant ring arc, a central core node dot, and a sharp 45° quantum growth beam arrow piercing through.
2. **Aurora Glow Backdrops:** Soft animated radial gradients drifting in the background (`aurora-drift` keyframe animation).
3. **Glassmorphic Cards:** High-contrast borders (`border-white/10` or `border-border/60`), subtle inner shadows, and soft ambient glows on hover.

---

## 4. Section-by-Section Landing Page Structure

The landing page must contain the following 8 sections:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. HEADER NAV: Logo (Q Crest), Links, "Sign In" CTA -> /auth    │
├─────────────────────────────────────────────────────────────────┤
│ 2. HERO SECTION: Eyebrow badge, Huge Headline, Subtitle,       │
│    Dual CTAs ("Launch Workspace" -> /auth), Glowing UI Mockup    │
├─────────────────────────────────────────────────────────────────┤
│ 3. TRUST & METRICS BAR: 100% Air-Gapped, 99.4% OCR, ICAI Ready │
├─────────────────────────────────────────────────────────────────┤
│ 4. MODULE SHOWCASE (Interactive Grid / Tabs): All 8 Modules     │
├─────────────────────────────────────────────────────────────────┤
│ 5. AIR-GAPPED SECURITY & COMPLIANCE DEEP DIVE                  │
├─────────────────────────────────────────────────────────────────┤
│ 6. LIVE RECONCILIATION DEMO PREVIEW (GSTR-3B vs 2B / Bank Recon)│
├─────────────────────────────────────────────────────────────────┤
│ 7. FIRM PRICING TIERS (Solo, Multi-Partner, Practice OS)        │
├─────────────────────────────────────────────────────────────────┤
│ 8. FOOTER: Navigation, ICAI Disclaimer, "Sign In to Firm" CTA   │
└─────────────────────────────────────────────────────────────────┘
```

### Destination Routing
- **Primary CTA ("Launch Workspace" / "Sign In to Firm"):** Must navigate directly to `/auth` (the application login/registration portal).

---

## 5. Lovable AI Prompt (Copy-Paste Ready)

> **Instructions for Lovable / Bolt / V0:** Copy the prompt text below into your AI website builder to generate the full landing page.

```markdown
Create a breathtaking, executive-grade landing page for "Quantive" — an AI-Native Practice Operating System for Indian Chartered Accountants and Audit Firms.

### Routing & Navigation Requirement
- All "Sign In", "Launch Workspace", "Access Portal", and "Get Started" call-to-action (CTA) buttons MUST link to the route `/auth`.

### Design System & Theme Settings
- Base Mode: Dark Mode Obsidian / Cosmic Slate (Background: hsl(224 35% 8%)).
- Colors: Deep Obsidian Navy background, translucent Glassmorphic cards with `backdrop-blur-xl`, border-white/10.
- Accents: Vibrant Aurora linear gradient (Indigo #3b82f6 -> Electric Teal #38bdf8 -> Violet #818cf8 -> Mint #10b981).
- Text Accent Class: Use animated text-gradient for hero keywords ("chartered accountants", "private AI").
- Logo Mark: Abstract geometric monogram "Q" badge — an outer precision quadrant ring with a 45° upward growth arrow vector piercing through.
- Typography: High-impact display font (Outfit or Inter), bold tracking-tight headings, tabular font for numbers.

### Required Landing Page Sections

1. Header Navigation Bar
   - Left: Quantive Logo Crest (Icon + "Quantive" text in bold display font + "Your quantitative advantage" tagline).
   - Center Links: Features, Modules, Security, Compliance, Pricing.
   - Right Action: "Sign In to Firm" button (variant: rounded-xl, aurora gradient background or glass border, links to `/auth`).

2. Hero Section
   - Top Eyebrow Badge: Pill container with glowing indigo dot + text "100% ON-PREMISE PRIVATE AI · ZERO CLOUD UPLOADS".
   - Main Headline (H1, 64px+ font-extrabold): "The Intelligent Practice OS for <span class="gradient-text">Chartered Accountants.</span>"
   - Subtitle (18px leading-relaxed): "Extract, reconcile, audit documents, and draft notice responses with a private AI running locally on your firm's server. Air-gapped confidentiality guaranteed."
   - Dual CTAs:
     - Primary Button: "Launch Workspace →" (Links to `/auth`, gradient fill with hover glow).
     - Secondary Button: "View Module Architecture" (Scrolls to Modules section).
   - Hero Visual: A floating glassmorphic dashboard preview mockup showing an active bank statement extraction, confidence indicators, and live GSTR-3B vs 2B mismatch alerts.

3. Key Metrics & Trust Bar
   - 4-column glass stat cards:
     - "100% Air-Gapped" (Zero data sent outside your firm)
     - "99.4% Extraction Accuracy" (Bank statements, GST, TDS, Invoices)
     - "0 Cloud API Dependencies" (Local Gemma 4 AI engine)
     - "ICAI Compliant" (Immutable audit event log)

4. Modules Showcase (Interactive Grid / Tabs)
   Display all 8 core modules in a sleek grid of translucent glass cards:
   - Module 1: DocInt — Multimodal OCR & Document Intelligence (Bank statement fuzzy parsing, confidence indicators, source bbox highlighting).
   - Module 2: Corpus & RAG Engine — Hybrid Pgvector + Trigram Search (Instant semantic search across millions of client documents).
   - Module 3: ClientPortal — Magic-Link Client Funnel (Passwordless document upload links & click-to-approve client signoffs).
   - Module 4: ComplianceCal — Practice Compliance Matrix (Automated GST, ITR, TDS, ROC filing deadline tracker).
   - Module 5: TaxCalc — Deterministic Tax Engine (Quarterly advance tax, TDS shortfall, Section 234B/234C interest math).
   - Module 6: NoticeMgr — AI Notice Defense (Grounded GST & Income Tax notice response drafting with page citations).
   - Module 7: AdvisoryAI — Grounded CA Assistant (Citation-backed Q&A chat over client document archives).
   - Module 8: FirmOps — Practice Analytics (Partner dashboard, staff workload distribution, client health heatmap).

5. Security & ICAI Compliance Deep-Dive
   - Card 1: "Air-Gapped Privacy by Design" (Docker local deployment, Ollama Gemma 4 execution).
   - Card 2: "Immutable Audit Ledger" (Every AI output & human edit logged to `audit_events`).
   - Card 3: "Granular Role Access" (Partner, Senior Staff, Article Clerk, Client views).

6. Interactive Reconciliation & Extraction Simulator
   - Visual mock demo comparing GSTR-3B filed tax credit against GSTR-2B portal downloads with highlighted variance flags.

7. Firm Pricing Tiers
   - Solo Practitioner Tier (1 Partner, 50 Clients, Local AI engine).
   - Multi-Partner Firm Tier (5 Partners, Unlimited Staff, Full 8 Modules, Audit Ledger).
   - Practice OS Enterprise (Custom server hardware setup, multi-branch, dedicated support).
   - All pricing cards include a "Get Started →" button linking to `/auth`.

8. Footer
   - Logo crest, copyright "© 2026 Quantive · Built for ICAI-registered firms in India".
   - Links: Terms, Privacy, ICAI Compliance Whitepaper, Support.
   - Quick action link: "Member Login" linking to `/auth`.
```

---

## 6. Verification & Lovable Prompt Guidelines

When feeding this spec into Lovable:
1. Ensure the generated React code includes **`import { Link } from "react-router-dom"`** and wraps all CTA buttons with `<Link to="/auth">`.
2. Check that the color palette uses dark CSS variables (`hsl(224 35% 8%)`) to maintain the signature Quantive obsidian aurora look.
3. Verify that all 8 modules are listed clearly on the page.
