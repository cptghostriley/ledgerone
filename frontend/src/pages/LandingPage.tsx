import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useScroll, useTransform, useInView } from "framer-motion";
import {
  ArrowRight, ArrowUp, CheckCircle2, Lock,
  ChevronRight, ChevronLeft,
  Shield, Check, Mail, Menu, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/logo";

/* ── Animated reveal wrapper ────────────────────────────────────── */
function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-30px" });
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay }}
    >{children}</motion.div>
  );
}

export default function LandingPage() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const titleY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const subtitleY = useTransform(scrollYProgress, [0, 1], [0, -30]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [activeSecLayer, setActiveSecLayer] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 350) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ── 6 Core Product Modules ─────────────────────────────────────── */
  const modules = [
    {
      id: "scrutiny",
      title: "Scrutiny",
      tagline: "Draft notice responses grounded in the client's actual records.",
      description: "Upload a GST or income tax notice — automatically cross-checked against past filings, invoices, and ledgers. Every drafted claim links back to a source document.",
      builtFor: "The firm starting notice responses at 11pm before a deadline.",
      preview: {
        letterhead: "REF: IT-143(1)-2025-8821 • INCOME TAX DEPARTMENT NOTICE",
        noticeTitle: "Notice u/s 143(1) — Discrepancy in Input Tax Credit",
        demand: "₹4,12,000",
        citationDoc: "GSTR-2B_Oct_2025.pdf (p. 3)",
        draftText: "Taxpayer has correctly claimed ITC of ₹4,12,000 corresponding to Invoice #INV-8821 reflected in GSTR-2B Table 4(A)(5).",
        status: "Partner Review Required"
      }
    },
    {
      id: "calendar",
      title: "Statutory Calendar",
      tagline: "Every client's filing deadlines, auto-populated in one place.",
      description: "GST returns, TDS, advance tax, and ROC filings mapped per entity type. Auto-updates the moment a relevant document lands with zero manual re-entry.",
      builtFor: "The partner checking five spreadsheets to know what's due tomorrow.",
      preview: {
        letterhead: "REF: ST-CAL-2026-Q3 • COMPLIANCE SCHEDULE RECORD",
        rows: [
          { client: "Sharma & Sons (Prop.)", obligation: "GSTR-3B (Oct)", due: "2025-11-20", status: "Ready for Sign-Off" },
          { client: "Apex Tech LLP", obligation: "Advance Tax Q3", due: "2025-12-15", status: "Calculated" },
          { client: "Vanguard Logistics Ltd", obligation: "TDS Filing 26Q", due: "2025-11-30", status: "Documents Pending" },
        ]
      }
    },
    {
      id: "working-papers",
      title: "Working Papers",
      tagline: "Upload a document once. Every figure becomes usable everywhere.",
      description: "Invoices, ledgers, bank statements, and challans read automatically with field-level confidence scoring and page bounding box citations.",
      builtFor: "The associate spending hours typing numbers into Excel.",
      preview: {
        letterhead: "REF: AUD-WP-2025-0911 • WORKING PAPER EXTRACTION",
        docName: "Tax_Invoice_2025_0911.pdf",
        fields: [
          { name: "Supplier GSTIN", val: "27AAACB1102R1Z8", conf: "0.99" },
          { name: "Taxable Value", val: "₹12,45,000.00", conf: "0.97" },
          { name: "IGST Amount", val: "₹2,24,100.00", conf: "0.98" },
        ]
      }
    },
    {
      id: "correspondence",
      title: "Correspondence",
      tagline: "Stop chasing client documents over WhatsApp.",
      description: "Generate passwordless magic links listing required documents. Clients upload directly, see missing items, and digitally sign off on returns before filing.",
      builtFor: "The firm losing hours to 'did you get my documents?' back-and-forth.",
      preview: {
        letterhead: "REF: PORTAL-REQ-2026-0814 • CLIENT PORTAL AUDIT TRAIL",
        clientName: "Rohan Industries",
        items: [
          { name: "Bank Statement (Q3)", status: "Uploaded" },
          { name: "GSTR-1 Sales Summary", status: "Uploaded" },
          { name: "Form 16 Part A & B", status: "Awaiting Upload" },
        ],
        approvalStatus: "Client Approved (2026-08-14 16:40 IST)"
      }
    },
    {
      id: "counsel",
      title: "Counsel",
      tagline: "Ask a question about a client, get an answer with direct citations.",
      description: "Instant Q&A over full client document history. Every claim cites the exact document and page number. Refuses to guess if data is absent.",
      builtFor: "The moment a client asks a sharp question on a call and you need the number.",
      preview: {
        letterhead: "REF: CNSL-QUERY-2026-041 • RECORDED INQUIRY & CITATION",
        query: "What was Sharma & Sons' effective tax rate in FY 2024-25?",
        answer: "Gross total income was ₹48,50,000 and net tax paid was ₹6,79,000, resulting in an effective tax rate of 14.0%.",
        citations: ["ITR-V_2024-25.pdf (p. 2)", "Computation_2025.pdf (p. 1)"]
      }
    },
    {
      id: "bench",
      title: "Bench",
      tagline: "See team workload and client health before deadlines sneak up.",
      description: "Task assignments, pending sign-offs, and stalled document requests unified in one practice management view for firm partners.",
      builtFor: "The partner managing more clients than they can hold in their head.",
      preview: {
        letterhead: "REF: BENCH-MGT-2026-0815 • PRACTICE HEALTH OVERVIEW",
        activeClients: "42 Active Clients",
        metrics: [
          { label: "Pending Partner Sign-Offs", val: "3", alert: true },
          { label: "Filing Deadlines This Week", val: "12", alert: false },
          { label: "Stalled Client Uploads", val: "2", alert: true }
        ]
      }
    }
  ];

  const handlePrev = () => {
    setActiveIdx((prev) => (prev === 0 ? modules.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setActiveIdx((prev) => (prev === modules.length - 1 ? 0 : prev + 1));
  };

  /* Card renderer helper */
  const renderModuleCard = (m: typeof modules[0]) => {
    const prevData = m.preview;
    return (
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 shadow-xl shadow-slate-200/50">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-center">

          {/* Left Column: Domain Copy */}
          <div className="lg:col-span-5 space-y-3.5">
            <div className="flex items-center gap-2">
              <span className="uppercase tracking-widest text-[11px] font-semibold text-[#2563eb]">
                MODULE {m.title}
              </span>
            </div>

            <h3 className="font-serif-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {m.title}
            </h3>

            <p className="text-xs sm:text-sm font-semibold text-[#2563eb] leading-snug">
              {m.tagline}
            </p>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              {m.description}
            </p>

            <div className="pt-3 border-t border-slate-200">
              <p className="uppercase tracking-widest text-[10px] font-semibold text-[#2563eb] mb-1">BUILT FOR</p>
              <p className="text-xs font-normal text-slate-700 italic">"{m.builtFor}"</p>
            </div>
          </div>

          {/* Right Column: Signature Document Mockup */}
          <div className="lg:col-span-7 rounded-lg border border-slate-300 bg-[#f8fafc] text-slate-900 p-4 sm:p-5 shadow-sm">
            {/* Signature Letterhead Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
              <span className="font-mono text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                {prevData.letterhead}
              </span>
              <span className="font-mono text-[9px] font-semibold text-slate-400 uppercase tracking-widest hidden sm:inline">
                CONFIDENTIAL
              </span>
            </div>

            {/* 1. Scrutiny Notice Response Preview */}
            {prevData.noticeTitle && (
              <div className="space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-1 pb-1">
                  <span className="font-serif-display text-xs sm:text-sm font-bold text-slate-900">
                    {prevData.noticeTitle}
                  </span>
                  <span className="font-mono text-xs font-bold text-rose-600">
                    Demand: {prevData.demand}
                  </span>
                </div>

                <div className="p-3 rounded-md bg-white border border-slate-200 space-y-2 shadow-xs">
                  <p className="uppercase tracking-wider text-[9px] font-semibold text-slate-500">VERIFIED CITATION CLAUSE</p>
                  <p className="font-mono text-[11px] leading-relaxed text-slate-900">
                    "{prevData.draftText}"
                  </p>
                  <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-200 gap-1">
                    <span className="font-mono text-[10px] text-slate-500">
                      Source: <span className="text-slate-900 font-semibold">{prevData.citationDoc}</span>
                    </span>
                    <span className="rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-[9px] font-semibold text-rose-700">
                      {prevData.status}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Statutory Calendar Preview */}
            {prevData.rows && (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold border-b border-slate-200 pb-1.5">
                  <span>CLIENT ENTITY</span>
                  <span>OBLIGATION</span>
                  <span>STATUS</span>
                </div>
                {prevData.rows.map(r => (
                  <div key={r.client} className="flex justify-between items-center p-2 rounded-md bg-white border border-slate-200 text-[11px] shadow-xs">
                    <div>
                      <p className="font-bold text-slate-900">{r.client}</p>
                      <p className="font-mono text-[10px] text-slate-500">{r.obligation} • Due <span className="text-slate-900">{r.due}</span></p>
                    </div>
                    <span className="rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 3. Working Papers Extraction Table Preview */}
            {prevData.docName && (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                  <span className="font-mono text-[11px] font-bold text-slate-900">{prevData.docName}</span>
                  <span className="font-mono text-[10px] text-slate-500">BOUNDING BOX OK</span>
                </div>
                {prevData.fields?.map(f => (
                  <div key={f.name} className="flex justify-between items-center p-2 rounded-md bg-white border border-slate-200 text-[11px] shadow-xs">
                    <span className="text-slate-500 font-medium">{f.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">{f.val}</span>
                      <span className="font-mono text-[9px] font-semibold text-slate-500 bg-slate-100 px-1 py-0.5 rounded">
                        {f.conf}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 4. Correspondence Client Portal Preview */}
            {prevData.clientName && (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                  <span className="font-bold text-slate-900">{prevData.clientName}</span>
                  <span className="font-mono text-[10px] text-slate-500">{prevData.approvalStatus}</span>
                </div>
                {prevData.items?.map(i => (
                  <div key={i.name} className="flex justify-between items-center p-2 rounded-md bg-white border border-slate-200 text-[11px] shadow-xs">
                    <span className="text-slate-900">{i.name}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${i.status.includes("Uploaded") ? "bg-blue-50 border border-blue-200 text-blue-700" : "bg-rose-50 border border-rose-200 text-rose-700"}`}>
                      {i.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 5. Counsel Chat & Citations Preview */}
            {prevData.query && (
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-md bg-blue-50/70 border border-blue-100">
                  <p className="uppercase tracking-wider text-[9px] font-semibold text-blue-600 mb-0.5">QUERY</p>
                  <p className="font-medium text-slate-900">"{prevData.query}"</p>
                </div>
                <div className="p-2.5 rounded-md bg-white border border-slate-200 shadow-xs">
                  <p className="uppercase tracking-wider text-[9px] font-semibold text-blue-600 mb-0.5">RESPONSE WITH RECEIPTS</p>
                  <p className="text-slate-900 leading-relaxed">{prevData.answer}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 pt-2 border-t border-slate-200">
                    {prevData.citations?.map(c => (
                      <span key={c} className="font-mono text-[10px] bg-slate-50 border border-slate-200 text-slate-900 px-2 py-0.5 rounded-md">
                        📄 {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 6. Bench Workload & Health Preview */}
            {prevData.activeClients && (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                  <span className="font-bold text-slate-900">Practice Roster</span>
                  <span className="font-mono text-[10px] text-slate-500">{prevData.activeClients}</span>
                </div>
                {prevData.metrics?.map(m => (
                  <div key={m.label} className="flex justify-between items-center p-2 rounded-md bg-white border border-slate-200 text-[11px] shadow-xs">
                    <span className="text-slate-900">{m.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">{m.val}</span>
                      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-md ${m.alert ? "bg-rose-50 border border-rose-200 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                        ACTIVE
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>

        </div>
      </div>
    );
  };

  const prevIdx = (activeIdx - 1 + modules.length) % modules.length;
  const nextIdx = (activeIdx + 1) % modules.length;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 selection:bg-blue-600 selection:text-white overflow-x-hidden font-sans">
      {/* ── Header ───────────────────────────────────────────── */}
      <header className="fixed top-0 z-50 w-full border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <LogoMark className="h-8 w-8 text-[#2563eb] font-serif italic text-2xl" />
            <span className="font-serif-display text-xl font-bold tracking-tight text-slate-900">Quantive</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-600">
            <a href="#modules" className="transition-colors hover:text-slate-900">Modules</a>
            <a href="#security" className="transition-colors hover:text-slate-900">Security &amp; Privacy</a>
            <a href="#contact" className="transition-colors hover:text-slate-900">Contact</a>
          </nav>

          {/* Desktop CTA — Larger Capsules */}
          <div className="hidden sm:flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="h-10 px-5 text-xs font-semibold rounded-full border border-slate-200/80 bg-white/80 hover:bg-slate-100 text-slate-700 shadow-xs">
              <Link to="/coming-soon">Sign In</Link>
            </Button>
            <Button asChild size="sm" className="h-10 px-6 rounded-full bg-[#2563eb] text-white text-xs font-semibold hover:bg-[#1d4ed8] transition-all shadow-md">
              <Link to="/coming-soon" className="gap-1.5">Get Started <ChevronRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-2 text-slate-600 hover:text-slate-900"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-b border-slate-200 bg-white px-6 py-4 space-y-3 shadow-md">
            <a href="#modules" onClick={() => setMobileMenuOpen(false)} className="block text-xs font-medium text-slate-600 hover:text-slate-900">Modules</a>
            <a href="#security" onClick={() => setMobileMenuOpen(false)} className="block text-xs font-medium text-slate-600 hover:text-slate-900">Security &amp; Privacy</a>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="block text-xs font-medium text-slate-600 hover:text-slate-900">Contact</a>
            <div className="pt-3 border-t border-slate-200 flex flex-col gap-2">
              <Button asChild variant="outline" size="sm" className="w-full justify-center rounded-full border-slate-200 text-slate-700 hover:bg-slate-50 text-xs">
                <Link to="/coming-soon">Sign In</Link>
              </Button>
              <Button asChild size="sm" className="w-full justify-center bg-[#2563eb] text-white font-semibold text-xs rounded-full">
                <Link to="/coming-soon">Get Started</Link>
              </Button>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ── Intro Frame / Hero Section (Identical BG & High Grid Visibility as Dashboard Header / Image 2) ── */}
        <section ref={heroRef} className="relative isolate min-h-[88vh] sm:min-h-[92vh] flex flex-col items-center justify-center overflow-hidden text-slate-900 pt-24 pb-16 px-4 sm:px-6 border-b border-slate-200/80">
          
          {/* 1. Rich Shifting Pastel Aurora Color Wash (Sky Blue, Soft Teal, Warm Peach, Soft Lavender) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              background: `
                radial-gradient(ellipse 65% 75% at 12% 18%, rgba(191, 219, 254, 0.85), transparent 65%),
                radial-gradient(ellipse 75% 85% at 88% 12%, rgba(186, 230, 253, 0.90), transparent 65%),
                radial-gradient(ellipse 60% 70% at 50% 85%, rgba(254, 243, 199, 0.75), transparent 65%),
                radial-gradient(ellipse 55% 65% at 75% 75%, rgba(221, 214, 254, 0.70), transparent 65%),
                linear-gradient(135deg, #f0f7ff 0%, #e0f2fe 35%, #fef3c7 70%, #f3e8ff 100%)
              `,
              filter: "saturate(140%)",
            }}
          />

          {/* 2. Micro Grid & Dots Pattern Layer (Sharply visible micro grid lines & dots matching Image 2) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 opacity-100"
            style={{
              backgroundImage: `
                radial-gradient(circle, rgba(30, 41, 59, 0.22) 1.1px, transparent 1.1px),
                linear-gradient(to right, rgba(30, 41, 59, 0.08) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(30, 41, 59, 0.08) 1px, transparent 1px)
              `,
              backgroundSize: "12px 12px, 12px 12px, 12px 12px",
            }}
          />

          {/* Extra-Large Background Parallax Title Watermark */}
          <motion.div style={{ y: titleY, opacity: heroOpacity }} className="relative z-10 text-center w-full max-w-7xl">
            <h1 className="font-serif-display text-[clamp(5rem,16vw,18rem)] font-bold leading-none tracking-tighter text-slate-900/[0.045] select-none uppercase">
              QUANTIVE
            </h1>
          </motion.div>

          {/* Hero Main Copy */}
          <motion.div style={{ y: subtitleY }} className="relative z-20 -mt-10 sm:-mt-20 text-center max-w-3xl">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/90 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-sm backdrop-blur-md mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2563eb]" />
              Workspace • Air-Gapped OS
            </div>

            <h2 className="font-serif-display text-3xl sm:text-5xl md:text-6xl font-bold leading-[1.12] tracking-tight text-slate-900 text-balance px-2">
              Automate GST, Tax &amp; Audit Workflows with{" "}
              <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 font-normal">On-Premise Intelligence.</span>
            </h2>
            <p className="mt-4 sm:mt-5 text-xs sm:text-base leading-relaxed text-slate-600 max-w-xl mx-auto px-2 font-normal">
              Replace scattered spreadsheets, WhatsApp threads, and paper files. Six integrated practice modules running on your private firm server.
            </p>
            <div className="mt-7 sm:mt-9">
              <Button asChild size="lg" className="h-11 px-8 rounded-full bg-[#2563eb] text-white font-semibold hover:bg-[#1d4ed8] transition-all text-xs sm:text-sm shadow-md">
                <Link to="/coming-soon" className="gap-2">
                  Get Started <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </motion.div>

          {/* Trust badges */}
          <motion.div style={{ opacity: heroOpacity }} className="relative z-20 mt-10 sm:mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] sm:text-xs text-slate-600 font-medium px-2">
            {["ICAI Confidentiality Standard", "Air-Gapped Local Server", "Zero External Cloud Uploads", "Immutable Audit Logs"].map(t => (
              <span key={t} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#2563eb]" /> {t}</span>
            ))}
          </motion.div>
        </section>

        {/* ── Key Metrics Strip ─────────────────────────────────── */}
        <section className="relative border-y border-slate-200/80 bg-white py-8 sm:py-10">
          <Reveal className="mx-auto max-w-6xl px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[["6 Practice Modules", "One Shared Client File"], ["100% Air-Gapped", "Private Server Runtime"], ["Full Provenance", "Every Claim Cited"], ["Zero Silos", "No Double Data Entry"]].map(([v, l]) => (
              <div key={l as string} className="p-1">
                <p className="font-serif-display text-xl sm:text-3xl font-bold text-slate-900">{v}</p>
                <p className="mt-1 text-[11px] sm:text-xs font-medium text-slate-500">{l}</p>
              </div>
            ))}
          </Reveal>
        </section>

        {/* ── Product Modules Section (Light Surface + 2-Line Header + Visible Blurred Adjacent Cards) ── */}
        <section id="modules" className="relative py-16 sm:py-24 bg-slate-50/90 text-slate-900 overflow-hidden border-t border-slate-200/70">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {/* Header restricted to 2 lines on desktop */}
            <Reveal className="mx-auto max-w-3xl text-center mb-8">
              <h2 className="font-serif-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900 leading-snug max-w-3xl mx-auto text-balance">
                Six ways this replaces what's currently scattered<br className="hidden sm:inline" /> across WhatsApp, Excel, and a filing cabinet
              </h2>
              <p className="mt-3 sm:mt-4 text-slate-600 text-xs sm:text-base text-balance">
                Every module runs on the same client file — nothing lives in a silo, nothing gets re-typed twice.
              </p>
            </Reveal>

            {/* Plain Text Tabs */}
            <Reveal delay={0.05} className="flex overflow-x-auto sm:flex-wrap justify-start sm:justify-center items-center gap-1.5 sm:gap-2 max-w-4xl mx-auto mb-8 sm:mb-12 px-2 py-1 scrollbar-none">
              {modules.map((m, idx) => {
                const isActive = idx === activeIdx;
                return (
                  <button
                    key={m.id}
                    onClick={() => setActiveIdx(idx)}
                    title={m.tagline}
                    className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-[#2563eb] text-white font-semibold shadow-sm"
                        : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80 shadow-sm"
                    }`}
                  >
                    {m.title}
                  </button>
                );
              })}
            </Reveal>
          </div>

          {/* Carousel Stage with Edge Navigation & Partially Visible Blurred Adjacent Cards */}
          <div className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Left Arrow Button */}
            <button
              onClick={handlePrev}
              aria-label="Previous Module"
              className="absolute left-1 sm:left-0 lg:-left-6 top-1/2 -translate-y-1/2 z-40 grid h-10 w-10 sm:h-11 sm:w-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition-all hover:bg-[#2563eb] hover:text-white hover:border-[#2563eb]"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {/* Right Arrow Button */}
            <button
              onClick={handleNext}
              aria-label="Next Module"
              className="absolute right-1 sm:right-0 lg:-right-6 top-1/2 -translate-y-1/2 z-40 grid h-10 w-10 sm:h-11 sm:w-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition-all hover:bg-[#2563eb] hover:text-white hover:border-[#2563eb]"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Carousel Stage with 3D Wheel Rotation & Lowered Side Cards */}
            <div 
              className="relative flex items-center justify-center min-h-[460px] sm:min-h-[500px] py-4 overflow-visible"
              style={{ perspective: "1200px" }}
            >
              {modules.map((m, idx) => {
                const total = modules.length;
                let diff = (idx - activeIdx + total) % total;
                if (diff > total / 2) diff -= total;

                const isActive = diff === 0;
                const isPrev = diff === -1;
                const isNext = diff === 1;
                const isVisible = isActive || isPrev || isNext;

                return (
                  <motion.div
                    key={m.id}
                    initial={false}
                    animate={{
                      x: diff === 0 ? "0%" : diff === 1 ? "68%" : diff === -1 ? "-68%" : diff > 0 ? "130%" : "-130%",
                      y: diff === 0 ? "0px" : isVisible ? "42px" : "90px",
                      scale: diff === 0 ? 1 : isVisible ? 0.85 : 0.65,
                      rotateY: diff === 0 ? 0 : diff === 1 ? -16 : diff === -1 ? 16 : diff > 0 ? -30 : 30,
                      rotateZ: diff === 0 ? 0 : diff === 1 ? 2.5 : diff === -1 ? -2.5 : 0,
                      opacity: diff === 0 ? 1 : isVisible ? 0.42 : 0,
                      filter: diff === 0 ? "blur(0px)" : "blur(2.5px)",
                      zIndex: diff === 0 ? 30 : isVisible ? 10 : 0,
                    }}
                    transition={{
                      duration: 0.5,
                      ease: [0.25, 1, 0.5, 1],
                    }}
                    onClick={() => {
                      if (isPrev) handlePrev();
                      if (isNext) handleNext();
                    }}
                    className={`absolute top-0 left-0 right-0 mx-auto w-full max-w-4xl px-2 sm:px-4 ${
                      isVisible ? "pointer-events-auto" : "pointer-events-none"
                    } ${isPrev || isNext ? "cursor-pointer hover:opacity-60 transition-opacity" : ""}`}
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    {renderModuleCard(m)}
                  </motion.div>
                );
              })}
            </div>

            {/* Pagination Dots */}
            <div className="flex items-center justify-center gap-1.5 mt-4 sm:mt-6">
              {modules.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveIdx(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    idx === activeIdx
                      ? "w-6 bg-[#2563eb]"
                      : "w-1.5 bg-slate-300 hover:bg-slate-400"
                  }`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── Security & Privacy Deep Dive ────────────────────────── */}
        <section id="security" className="relative isolate py-20 sm:py-28 text-slate-900 border-t border-slate-200/80 overflow-hidden">
          
          {/* 1. Subtle Multicolor Aurora Wash */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 opacity-85"
            style={{
              background: `
                radial-gradient(ellipse 60% 70% at 15% 25%, rgba(191, 219, 254, 0.60), transparent 65%),
                radial-gradient(ellipse 70% 80% at 85% 20%, rgba(186, 230, 253, 0.65), transparent 65%),
                radial-gradient(ellipse 55% 65% at 50% 85%, rgba(254, 243, 199, 0.50), transparent 65%),
                linear-gradient(135deg, #f8fafc 0%, #f0f7ff 50%, #fcfbf7 100%)
              `,
            }}
          />

          {/* 2. Micro Grid Dots Layer (Less opaque dots as requested) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 opacity-60"
            style={{
              backgroundImage: `
                radial-gradient(circle, rgba(30, 41, 59, 0.09) 0.85px, transparent 0.85px),
                linear-gradient(to right, rgba(30, 41, 59, 0.025) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(30, 41, 59, 0.025) 1px, transparent 1px)
              `,
              backgroundSize: "12px 12px, 12px 12px, 12px 12px",
            }}
          />

          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
              
              {/* Left Copy Column */}
              <Reveal className="lg:col-span-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/90 bg-blue-50/80 px-3.5 py-1 text-xs font-semibold uppercase tracking-widest text-[#2563eb] mb-4 backdrop-blur-md">
                  <Lock className="h-3.5 w-3.5 text-[#2563eb]" /> Air-Gapped Infrastructure
                </div>
                <h2 className="font-serif-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-[1.15]">
                  Your clients' financial records never leave your firm's server.
                </h2>
                <p className="mt-4 text-sm sm:text-base leading-relaxed text-slate-600 font-normal">
                  Designed specifically to satisfy ICAI confidentiality guidelines and Indian privacy mandates. Quantive executes 100% locally with zero cloud API dependencies.
                </p>

                {/* Technical Specification Guarantees Strip (No icons, no rounded cards, no individual boxes) */}
                <div className="mt-8 border-y border-slate-200/90 py-5">
                  <div className="grid grid-cols-3 divide-x divide-slate-200/90 text-left">
                    <div className="pr-3 sm:pr-4">
                      <p className="font-mono text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-900">LOCAL ONLY</p>
                      <p className="mt-1 text-[11px] text-slate-600 leading-snug font-normal">100% on-premise execution with zero cloud socket connections.</p>
                    </div>
                    <div className="px-3 sm:px-4">
                      <p className="font-mono text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-900">HUMAN APPROVAL</p>
                      <p className="mt-1 text-[11px] text-slate-600 leading-snug font-normal">AI pre-drafts notices; partner sign-off is mandatory before filing.</p>
                    </div>
                    <div className="pl-3 sm:pl-4">
                      <p className="font-mono text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-900">IMMUTABLE AUDIT</p>
                      <p className="mt-1 text-[11px] text-slate-600 leading-snug font-normal">Cryptographically hashed audit log for every client document.</p>
                    </div>
                  </div>
                </div>
              </Reveal>

              {/* Right Side Graphic System Architecture Flow Diagram */}
              <Reveal delay={0.1} className="lg:col-span-7">
                <div className="relative rounded-2xl border border-slate-200/90 bg-white/95 p-6 sm:p-7 shadow-xl backdrop-blur-xl min-h-[570px] flex flex-col justify-between">
                  
                  <div>
                    {/* Diagram Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4 mb-5">
                      <div className="flex items-center gap-2.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-900">
                          AIR-GAPPED SYSTEM ARCHITECTURE
                        </span>
                      </div>
                      
                      <div className="font-mono text-[11px] text-slate-500 flex items-center gap-2">
                        <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded border border-emerald-200 font-bold">
                          100% ON-PREMISE
                        </span>
                      </div>
                    </div>

                    {/* ── Visual Architecture Graphic Canvas ────────────────── */}
                    <div className="relative rounded-xl border border-slate-200/80 bg-slate-50/70 p-5 font-mono overflow-hidden">
                      
                      {/* SVG Connector Flow Lines */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#94a3b8" />
                            <stop offset="50%" stopColor="#2563eb" />
                            <stop offset="100%" stopColor="#10b981" />
                          </linearGradient>
                        </defs>
                        <path d="M 120 70 L 220 70 M 340 70 L 440 70 M 280 110 L 280 160 M 120 190 L 220 190 M 340 190 L 440 190" stroke="url(#flowGrad)" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
                      </svg>

                      {/* Architectural Graphic Flow Layout */}
                      <div className="relative z-10 space-y-6">
                        
                        {/* Top Row: Data Ingestion -> Local Engine -> Encrypted Storage */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          
                          {/* Node 1: Ingestion */}
                          <div
                            onClick={() => setActiveSecLayer(0)}
                            className={`cursor-pointer group rounded-lg border p-3 transition-all duration-200 ${
                              activeSecLayer === 0
                                ? "border-[#2563eb] bg-white shadow-md ring-1 ring-[#2563eb]"
                                : "border-slate-200 bg-white/90 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mb-1">
                              <span>01. INGESTION</span>
                              <span className="text-[#2563eb]">INTRANET</span>
                            </div>
                            <div className="font-bold text-slate-900 text-xs">Client Records</div>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-semibold">Tax Notices</span>
                              <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-semibold">Bank PDFs</span>
                            </div>
                          </div>

                          {/* Node 2: Local Model Engine */}
                          <div
                            onClick={() => setActiveSecLayer(0)}
                            className={`cursor-pointer group rounded-lg border p-3 transition-all duration-200 ${
                              activeSecLayer === 0
                                ? "border-[#2563eb] bg-blue-50/80 shadow-md ring-1 ring-[#2563eb]"
                                : "border-blue-200/80 bg-blue-50/40 hover:border-blue-300"
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] text-blue-600 font-bold mb-1">
                              <span>02. LOCAL AI</span>
                              <span className="bg-blue-100 px-1 rounded text-[9px]">0 API CALLS</span>
                            </div>
                            <div className="font-bold text-[#2563eb] text-xs">Private Model Server</div>
                            <div className="mt-1.5 text-[10px] text-slate-600 font-normal leading-tight">
                              Local Gemma4 / Ollama in Server RAM
                            </div>
                          </div>

                          {/* Node 3: Encrypted Storage */}
                          <div
                            onClick={() => setActiveSecLayer(1)}
                            className={`cursor-pointer group rounded-lg border p-3 transition-all duration-200 ${
                              activeSecLayer === 1
                                ? "border-[#2563eb] bg-white shadow-md ring-1 ring-[#2563eb]"
                                : "border-slate-200 bg-white/90 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mb-1">
                              <span>03. VAULT</span>
                              <span className="text-emerald-600">AES-256</span>
                            </div>
                            <div className="font-bold text-slate-900 text-xs">Encrypted Storage</div>
                            <div className="mt-1.5 text-[10px] text-slate-600 font-normal leading-tight">
                              Per-Tenant Isolated Client Lanes
                            </div>
                          </div>

                        </div>

                        {/* Connection Divider Arrow */}
                        <div className="flex items-center justify-center gap-2 my-1">
                          <div className="h-px flex-1 bg-slate-200" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-0.5 bg-white rounded border border-slate-200">
                            HUMAN APPROVAL GATEWAY &amp; AUDIT PIPELINE
                          </span>
                          <div className="h-px flex-1 bg-slate-200" />
                        </div>

                        {/* Bottom Row: Human Gatekeeper & Immutable Audit */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          
                          {/* Node 4: Partner Human Approval Gatekeeper */}
                          <div
                            onClick={() => setActiveSecLayer(2)}
                            className={`cursor-pointer group rounded-lg border p-3.5 transition-all duration-200 ${
                              activeSecLayer === 2
                                ? "border-emerald-500 bg-emerald-50/70 shadow-md ring-1 ring-emerald-500"
                                : "border-emerald-200 bg-emerald-50/30 hover:border-emerald-300"
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] text-emerald-700 font-bold mb-1">
                              <span>04. MANDATORY PARTNER SIGN-OFF</span>
                              <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[9px]">MANDATORY</span>
                            </div>
                            <div className="font-bold text-slate-900 text-xs">Partner Authorization Gate</div>
                            <div className="mt-1 text-[11px] text-slate-600 font-sans italic">
                              "AI pre-drafts. Only partner sign-off unlocks final filing export."
                            </div>
                          </div>

                          {/* Node 5: Immutable Event Log */}
                          <div
                            onClick={() => setActiveSecLayer(3)}
                            className={`cursor-pointer group rounded-lg border p-3.5 transition-all duration-200 ${
                              activeSecLayer === 3
                                ? "border-[#2563eb] bg-white shadow-md ring-1 ring-[#2563eb]"
                                : "border-slate-200 bg-white/90 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mb-1">
                              <span>05. AUDIT LAYER</span>
                              <span className="text-slate-700">SHA-256</span>
                            </div>
                            <div className="font-bold text-slate-900 text-xs">Immutable Event Trail</div>
                            <div className="mt-1 text-[10px] text-slate-500 font-mono">
                              Cryptographically chained audit trail
                            </div>
                          </div>

                        </div>

                      </div>
                    </div>

                    {/* ── Interactive Specification Reader Panel (Fixed height to prevent jerking) ── */}
                    <div className="mt-5 h-[108px] rounded-xl border border-slate-200 bg-white p-4 font-mono overflow-hidden">
                      <AnimatePresence mode="wait">
                        {activeSecLayer === 0 && (
                          <motion.div key="spec-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2 text-xs">
                            <div className="flex justify-between font-bold text-slate-900 border-b border-slate-100 pb-1.5">
                              <span>01-02 SPEC // LOCAL EXECUTION PIPELINE</span>
                              <span className="text-[#2563eb]">0 OUTBOUND SOCKETS</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                              <div>• Runtime: Local Server GPU/RAM</div>
                              <div>• Model: Ollama / Gemma4</div>
                              <div>• Network: Private Intranet Only</div>
                              <div>• Telemetry: 100% Disabled</div>
                            </div>
                          </motion.div>
                        )}

                        {activeSecLayer === 1 && (
                          <motion.div key="spec-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2 text-xs">
                            <div className="flex justify-between font-bold text-slate-900 border-b border-slate-100 pb-1.5">
                              <span>03 SPEC // DATA ISOLATION &amp; AES-256 VAULT</span>
                              <span className="text-emerald-700">ICAI COMPLIANT</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                              <div>• Storage: Local PostgreSQL + Vault</div>
                              <div>• Encryption: AES-256 at Rest</div>
                              <div>• Tenant Isolation: Hardware Key Lock</div>
                              <div>• Backup: Firm Local Custody</div>
                            </div>
                          </motion.div>
                        )}

                        {activeSecLayer === 2 && (
                          <motion.div key="spec-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2 text-xs">
                            <div className="flex justify-between font-bold text-slate-900 border-b border-slate-100 pb-1.5">
                              <span>04 SPEC // MANDATORY PARTNER APPROVAL</span>
                              <span className="text-emerald-700">DUAL-KEY AUTH</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                              <div>• Pre-Drafting: AI Notice Analysis</div>
                              <div>• Sign-Off: Mandatory Partner 2FA</div>
                              <div>• Export Lock: Sealed until Approved</div>
                              <div>• Responsibility: Partner Signatory</div>
                            </div>
                          </motion.div>
                        )}

                        {activeSecLayer === 3 && (
                          <motion.div key="spec-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2 text-xs">
                            <div className="flex justify-between font-bold text-slate-900 border-b border-slate-100 pb-1.5">
                              <span>05 SPEC // SHA-256 IMMUTABLE AUDIT LOG</span>
                              <span className="text-slate-800">COURT-READY</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                              <div>• Logging: SHA-256 Hash Chained</div>
                              <div>• Provenance: Ingestion to Export</div>
                              <div>• Non-Repudiable: Partner Timestamp</div>
                              <div>• Audit Export: Peer Review Ready</div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Cryptographic Link Footer Bar */}
                  <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500 font-mono">
                    <span>ICAI Practice Security Standard v2.4</span>
                    <Link to="/coming-soon?topic=air-gapped" className="font-sans font-bold text-[#2563eb] hover:underline">
                      Read Full Security Specification →
                    </Link>
                  </div>

                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Final Conversion CTA ──────────────────────────────── */}
        <section className="relative border-t border-slate-200/80 bg-slate-900 text-white py-16 sm:py-24 px-4">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="font-serif-display text-2xl sm:text-4xl font-bold tracking-tight text-white">
              Ready to automate your practice?
            </h2>
            <p className="mt-3 sm:mt-4 text-xs sm:text-base text-slate-300">
              Join ICAI-registered Chartered Accountant firms using Quantive for air-gapped practice intelligence.
            </p>
            <div className="mt-6 sm:mt-8">
              <Button asChild size="lg" className="h-11 px-8 rounded-full bg-[#2563eb] text-white font-semibold hover:bg-[#1d4ed8] transition-all text-xs sm:text-sm shadow-md">
                <Link to="/coming-soon?topic=beta" className="gap-2">
                  Get Started <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ── Enlarged Quantive Branding Footer ─────────────────── */}
      <footer id="contact" className="border-t border-slate-200 bg-white text-slate-600 pt-14 pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-slate-200">
            {/* Brand Col — Enlarged Branding */}
            <div className="md:col-span-5 space-y-3.5">
              <div className="flex items-center gap-3">
                <LogoMark className="h-9 w-9 text-[#2563eb] font-serif italic text-3xl" />
                <div className="flex flex-col leading-none">
                  <span className="font-serif-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Quantive</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 mt-1">Your quantitative advantage</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm font-normal">
                Air-gapped Practice Operating System for Indian Chartered Accountants. Unifying notice responses, filing calendars, and document extraction under strict on-premise security.
              </p>
              <div className="pt-2">
                <p className="text-xs font-semibold text-slate-700">Contact &amp; Inquiries:</p>
                <a href="mailto:workstudiotwelve@gmail.com" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2563eb] hover:text-[#1d4ed8] transition-colors mt-1">
                  <Mail className="h-3.5 w-3.5" /> workstudiotwelve@gmail.com
                </a>
              </div>
            </div>

            {/* Modules Col */}
            <div className="md:col-span-3 space-y-3">
              <p className="uppercase tracking-widest text-[10px] font-semibold text-slate-900">Practice Modules</p>
              <ul className="space-y-2 text-xs font-medium text-slate-500">
                <li><Link to="/coming-soon?topic=scrutiny" className="hover:text-slate-900 transition-colors">Notice Scrutiny</Link></li>
                <li><Link to="/coming-soon?topic=calendar" className="hover:text-slate-900 transition-colors">Statutory Calendar</Link></li>
                <li><Link to="/coming-soon?topic=working-papers" className="hover:text-slate-900 transition-colors">Working Papers</Link></li>
                <li><Link to="/coming-soon?topic=correspondence" className="hover:text-slate-900 transition-colors">Client Correspondence</Link></li>
                <li><Link to="/coming-soon?topic=counsel" className="hover:text-slate-900 transition-colors">Citation Counsel</Link></li>
                <li><Link to="/coming-soon?topic=bench" className="hover:text-slate-900 transition-colors">Practice Bench</Link></li>
              </ul>
            </div>

            {/* Security & Access Col */}
            <div className="md:col-span-4 space-y-3">
              <p className="uppercase tracking-widest text-[10px] font-semibold text-slate-900">Security &amp; Deployment</p>
              <ul className="space-y-2 text-xs font-medium text-slate-500">
                <li><Link to="/coming-soon?topic=air-gapped" className="hover:text-slate-900 transition-colors">100% On-Premise Air-Gapped Engine</Link></li>
                <li><Link to="/coming-soon?topic=icai" className="hover:text-slate-900 transition-colors">ICAI Confidentiality Standard</Link></li>
                <li><Link to="/coming-soon?topic=ledger" className="hover:text-slate-900 transition-colors">Immutable Event Ledger</Link></li>
                <li><Link to="/coming-soon?topic=beta" className="hover:text-slate-900 transition-colors text-[#2563eb] font-semibold">Request Firm Beta Access →</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>&copy; 2026 Quantive Intelligence. Built for Chartered Accountants in India.</p>
            <div className="flex items-center gap-6">
              <Link to="/coming-soon?topic=privacy" className="hover:text-slate-900 transition-colors">Privacy Policy</Link>
              <Link to="/coming-soon?topic=terms" className="hover:text-slate-900 transition-colors">Terms of Service</Link>
              <a href="mailto:workstudiotwelve@gmail.com" className="hover:text-slate-900 transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Back to Top Floating Button */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={scrollToTop}
            aria-label="Back to top"
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-4 py-2.5 text-xs font-semibold text-slate-800 shadow-xl backdrop-blur-md transition-all hover:bg-[#2563eb] hover:text-white hover:border-[#2563eb] hover:shadow-2xl group"
          >
            <ArrowUp className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
            <span>Back to top</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
