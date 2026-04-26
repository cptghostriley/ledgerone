import type {
  Client, Document, Job, Deadline, ReconciliationCheck,
  MissingDoc, Schema, ChatMessage,
} from "./types";

export const clients: Client[] = [
  {
    id: "c-001", name: "Sharma Textiles Pvt Ltd", pan: "AABCS1234F", gstin: "27AABCS1234F1Z5",
    type: "Pvt Ltd", filings: ["ITR", "GST", "TDS", "ROC"], status: "flagged",
    partner: "CA Anjali Mehta", docsTotal: 142, docsProcessed: 138, flags: 4,
    lastActivity: "2026-04-17T09:24:00Z", city: "Mumbai",
  },
  {
    id: "c-002", name: "Iyer & Associates LLP", pan: "AAFCI5678K", gstin: "29AAFCI5678K1Z2",
    type: "LLP", filings: ["ITR", "GST", "Audit"], status: "active",
    partner: "CA Rohit Khanna", docsTotal: 86, docsProcessed: 86, flags: 0,
    lastActivity: "2026-04-18T14:02:00Z", city: "Bengaluru",
  },
  {
    id: "c-003", name: "Patel Exports", pan: "AAAPP9912R", gstin: "24AAAPP9912R2Z9",
    type: "Proprietorship", filings: ["GST", "ITR"], status: "active",
    partner: "CA Anjali Mehta", docsTotal: 54, docsProcessed: 52, flags: 1,
    lastActivity: "2026-04-16T11:50:00Z", city: "Surat",
  },
  {
    id: "c-004", name: "Greenleaf Organics Pvt Ltd", pan: "AAGCG3344L", gstin: "07AAGCG3344L1ZD",
    type: "Pvt Ltd", filings: ["ITR", "GST", "TDS", "ROC", "Audit"], status: "flagged",
    partner: "CA Vikram Iyer", docsTotal: 211, docsProcessed: 198, flags: 7,
    lastActivity: "2026-04-18T08:12:00Z", city: "New Delhi",
  },
  {
    id: "c-005", name: "Reddy Constructions LLP", pan: "AAFCR7788M", gstin: "36AAFCR7788M1Z1",
    type: "LLP", filings: ["GST", "TDS", "ITR"], status: "active",
    partner: "CA Rohit Khanna", docsTotal: 178, docsProcessed: 175, flags: 2,
    lastActivity: "2026-04-15T17:30:00Z", city: "Hyderabad",
  },
  {
    id: "c-006", name: "Kapoor Holdings Pvt Ltd", pan: "AAKCK2211H", gstin: "27AAKCK2211H1ZB",
    type: "Pvt Ltd", filings: ["ITR", "ROC", "Audit"], status: "onboarding",
    partner: "CA Anjali Mehta", docsTotal: 12, docsProcessed: 8, flags: 0,
    lastActivity: "2026-04-19T07:20:00Z", city: "Pune",
  },
  {
    id: "c-007", name: "Krishnan Stores", pan: "AAJPK4455Q", type: "Individual",
    filings: ["ITR"], status: "active", partner: "CA Vikram Iyer",
    docsTotal: 18, docsProcessed: 18, flags: 0,
    lastActivity: "2026-04-10T13:00:00Z", city: "Chennai",
  },
  {
    id: "c-008", name: "Bansal Pharma Pvt Ltd", pan: "AABCB6677N", gstin: "08AABCB6677N1ZC",
    type: "Pvt Ltd", filings: ["ITR", "GST", "TDS", "Audit"], status: "active",
    partner: "CA Rohit Khanna", docsTotal: 124, docsProcessed: 120, flags: 1,
    lastActivity: "2026-04-18T19:11:00Z", city: "Jaipur",
  },
  {
    id: "c-009", name: "Mehrotra Logistics Partnership", pan: "AAEFM3322P", gstin: "09AAEFM3322P1Z7",
    type: "Partnership", filings: ["GST", "ITR", "TDS"], status: "flagged",
    partner: "CA Vikram Iyer", docsTotal: 96, docsProcessed: 91, flags: 3,
    lastActivity: "2026-04-17T10:45:00Z", city: "Lucknow",
  },
  {
    id: "c-010", name: "Singh Hospitality Pvt Ltd", pan: "AASCS9988J", gstin: "03AASCS9988J1ZK",
    type: "Pvt Ltd", filings: ["ITR", "GST", "TDS", "Audit"], status: "active",
    partner: "CA Anjali Mehta", docsTotal: 167, docsProcessed: 163, flags: 0,
    lastActivity: "2026-04-19T06:55:00Z", city: "Chandigarh",
  },
];

const docTypes = ["GSTR-1", "GSTR-3B", "GSTR-2A", "Form 16", "Form 26AS", "Bank Statement", "Sales Register", "Purchase Register", "TDS Certificate", "Invoice", "Trial Balance", "P&L Statement"];

export const documents: Document[] = Array.from({ length: 38 }).map((_, i) => {
  const client = clients[i % clients.length];
  const docType = docTypes[i % docTypes.length];
  const status: Document["status"] = i % 11 === 0 ? "review" : i % 17 === 0 ? "failed" : i % 9 === 0 ? "pending" : "processed";
  return {
    id: `d-${String(i + 1).padStart(4, "0")}`,
    clientId: client.id,
    filename: `${docType.replace(/\s/g, "_")}_${client.name.split(" ")[0]}_FY2024-25.pdf`,
    docType,
    financialYear: i % 5 === 0 ? "2023-24" : "2024-25",
    status,
    confidence: status === "processed" ? 0.78 + (i % 22) / 100 : 0.4 + (i % 30) / 100,
    anomalies: status === "review" ? 2 + (i % 3) : status === "processed" ? (i % 5 === 0 ? 1 : 0) : 0,
    uploadedAt: new Date(Date.now() - i * 1000 * 60 * 60 * 6).toISOString(),
    size: `${(0.4 + (i % 9) * 0.7).toFixed(1)} MB`,
    extracted: {
      "Total Taxable Value": `₹${((i + 1) * 124350).toLocaleString("en-IN")}`,
      "CGST": `₹${((i + 1) * 11192).toLocaleString("en-IN")}`,
      "SGST": `₹${((i + 1) * 11192).toLocaleString("en-IN")}`,
      "IGST": `₹${((i + 1) * 4220).toLocaleString("en-IN")}`,
      "Period": "Apr 2024 – Mar 2025",
      "GSTIN": client.gstin ?? "—",
    },
  };
});

export const jobs: Job[] = [
  { id: "j-201", clientId: "c-004", clientName: "Greenleaf Organics Pvt Ltd", type: "Bulk extraction (GSTR-3B × 12)", status: "processing", progress: 64, startedAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(), filesCount: 12 },
  { id: "j-202", clientId: "c-001", clientName: "Sharma Textiles Pvt Ltd", type: "Reconciliation FY2024-25", status: "processing", progress: 32, startedAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(), filesCount: 1 },
  { id: "j-203", clientId: "c-009", clientName: "Mehrotra Logistics Partnership", type: "Bank statement parse", status: "queued", progress: 0, startedAt: new Date().toISOString(), filesCount: 4 },
  { id: "j-204", clientId: "c-008", clientName: "Bansal Pharma Pvt Ltd", type: "Form 26AS extract", status: "completed", progress: 100, startedAt: new Date(Date.now() - 1000 * 60 * 22).toISOString(), durationMs: 184000, filesCount: 1 },
  { id: "j-205", clientId: "c-005", clientName: "Reddy Constructions LLP", type: "GSTR-2A vs Purchase Register", status: "completed", progress: 100, startedAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(), durationMs: 412000, filesCount: 2 },
  { id: "j-206", clientId: "c-002", clientName: "Iyer & Associates LLP", type: "Trial Balance extraction", status: "failed", progress: 47, startedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(), durationMs: 78000, filesCount: 1 },
];

export const deadlines: Deadline[] = [
  { id: "dl-1", clientId: "c-001", clientName: "Sharma Textiles Pvt Ltd", type: "GST", title: "GSTR-3B — March 2026", dueDate: "2026-04-20", status: "due_soon" },
  { id: "dl-2", clientId: "c-004", clientName: "Greenleaf Organics Pvt Ltd", type: "GST", title: "GSTR-3B — March 2026", dueDate: "2026-04-20", status: "due_soon" },
  { id: "dl-3", clientId: "c-005", clientName: "Reddy Constructions LLP", type: "TDS", title: "TDS Q4 FY2025-26 Payment", dueDate: "2026-04-30", status: "upcoming" },
  { id: "dl-4", clientId: "c-008", clientName: "Bansal Pharma Pvt Ltd", type: "GST", title: "GSTR-1 — March 2026", dueDate: "2026-04-11", status: "overdue" },
  { id: "dl-5", clientId: "c-002", clientName: "Iyer & Associates LLP", type: "Audit", title: "Statutory Audit — FY2024-25", dueDate: "2026-09-30", status: "upcoming" },
  { id: "dl-6", clientId: "c-001", clientName: "Sharma Textiles Pvt Ltd", type: "ROC", title: "MGT-7 Annual Return", dueDate: "2026-11-29", status: "upcoming" },
  { id: "dl-7", clientId: "c-010", clientName: "Singh Hospitality Pvt Ltd", type: "TDS", title: "Form 24Q — Q4", dueDate: "2026-05-31", status: "upcoming" },
  { id: "dl-8", clientId: "c-009", clientName: "Mehrotra Logistics Partnership", type: "GST", title: "GSTR-9 Annual Return", dueDate: "2026-12-31", status: "upcoming" },
];

export const reconciliationChecks: ReconciliationCheck[] = [
  { id: "rc-1", name: "Sales Register vs GSTR-1 Outward", passed: true, severity: "info", message: "Outward supplies match within ₹0 tolerance across 234 invoices." },
  { id: "rc-2", name: "Purchase Register vs GSTR-2A ITC", passed: false, severity: "warning", message: "ITC mismatch of ₹48,210 across 6 invoices. Likely supplier upload pending.", flagged: [
    { label: "Tata Steel Ltd — INV-44521", book: "₹1,24,500", portal: "—" },
    { label: "Reliance Polymers — INV-99812", book: "₹78,200", portal: "₹54,800" },
  ]},
  { id: "rc-3", name: "TDS Deducted vs Form 26AS", passed: true, severity: "info", message: "All TDS entries match Form 26AS for FY2024-25." },
  { id: "rc-4", name: "Bank Receipts vs Sales Recorded", passed: false, severity: "critical", message: "₹3,42,800 of bank receipts not posted to sales ledger.", flagged: [
    { label: "HDFC 0014 — 12 Mar 2026", book: "—", portal: "₹1,80,000" },
    { label: "HDFC 0014 — 28 Mar 2026", book: "—", portal: "₹1,62,800" },
  ]},
  { id: "rc-5", name: "Closing Stock — Books vs Physical", passed: true, severity: "info", message: "Variance under tolerance (0.4%)." },
  { id: "rc-6", name: "Director Remuneration — Form 16 vs P&L", passed: true, severity: "info", message: "Aligned across all 4 directors." },
];

export const missingDocs: MissingDoc[] = [
  { id: "m-1", type: "Form 16A — Q4 FY2024-25", requiredFor: "TDS", severity: "blocking", note: "Required to file TDS return." },
  { id: "m-2", type: "Bank Statement — HDFC 0014 (Mar 2026)", requiredFor: "GST", severity: "blocking" },
  { id: "m-3", type: "Director's KYC declaration", requiredFor: "ROC", severity: "blocking" },
  { id: "m-4", type: "Stock valuation report", requiredFor: "Audit", severity: "recommended" },
  { id: "m-5", type: "Foreign remittance Form 15CA", requiredFor: "ITR", severity: "recommended", note: "Only if export receipts apply." },
];

export const schemas: Schema[] = [
  { id: "s-1", name: "GSTR-3B Summary", description: "Extracts taxable value, CGST/SGST/IGST, ITC, late fees from monthly returns.", fieldCount: 14, lastUsed: "2026-04-18T11:00:00Z", uses: 312, fields: [
    { name: "gstin", type: "string", description: "15-char registration number" },
    { name: "period", type: "date", description: "Month and year" },
    { name: "total_taxable_value", type: "currency", description: "Sum of taxable supplies" },
    { name: "cgst", type: "currency", description: "Central GST" },
    { name: "sgst", type: "currency", description: "State GST" },
    { name: "igst", type: "currency", description: "Integrated GST" },
    { name: "itc_claimed", type: "currency", description: "Input tax credit availed" },
  ]},
  { id: "s-2", name: "Bank Statement Parser", description: "Line-item extraction with category tagging from any Indian bank PDF.", fieldCount: 9, lastUsed: "2026-04-19T07:10:00Z", uses: 1102, fields: [
    { name: "transaction_date", type: "date", description: "Posting date" },
    { name: "narration", type: "string", description: "Cleaned narration" },
    { name: "debit", type: "currency", description: "Amount debited" },
    { name: "credit", type: "currency", description: "Amount credited" },
    { name: "balance", type: "currency", description: "Running balance" },
  ]},
  { id: "s-3", name: "Form 16 Salary", description: "Employee salary, deductions, TDS sections from Part A & B.", fieldCount: 18, lastUsed: "2026-04-15T16:40:00Z", uses: 87, fields: [
    { name: "employee_pan", type: "string", description: "Employee PAN" },
    { name: "gross_salary", type: "currency", description: "Total gross" },
    { name: "section_80c", type: "currency", description: "Deduction under 80C" },
  ]},
  { id: "s-4", name: "Trial Balance Extractor", description: "Pulls ledger names, debit, credit columns from any TB format.", fieldCount: 6, lastUsed: "2026-04-12T10:00:00Z", uses: 54, fields: [
    { name: "ledger_name", type: "string", description: "Account head" },
    { name: "debit", type: "currency", description: "Debit balance" },
    { name: "credit", type: "currency", description: "Credit balance" },
  ]},
];

export const chatHistory: ChatMessage[] = [
  { id: "ch-1", role: "user", content: "What's the total ITC claimed by Sharma Textiles in FY2024-25?", timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString() },
  { id: "ch-2", role: "assistant", content: "Sharma Textiles Pvt Ltd claimed total Input Tax Credit of **₹18,42,310** in FY2024-25 across 12 monthly GSTR-3B returns. The breakdown is CGST ₹6,81,420, SGST ₹6,81,420, and IGST ₹4,79,470.", sources: [
    { docId: "d-0001", filename: "GSTR-3B_Sharma_FY2024-25.pdf" },
    { docId: "d-0013", filename: "GSTR-2A_Sharma_FY2024-25.pdf" },
  ], timestamp: new Date(Date.now() - 1000 * 60 * 11).toISOString() },
];

export const recentActivity = [
  { id: "a-1", text: "Reconciliation completed — 4 of 6 checks passed", time: "12 min ago", type: "recon" },
  { id: "a-2", text: "Uploaded GSTR-3B March 2026 (1 file)", time: "38 min ago", type: "upload" },
  { id: "a-3", text: "CA Anjali Mehta marked Form 16A request as sent", time: "2h ago", type: "comment" },
  { id: "a-4", text: "Bank statement parsed — 124 transactions extracted", time: "4h ago", type: "extract" },
  { id: "a-5", text: "Anomaly flagged: ITC mismatch of ₹48,210", time: "6h ago", type: "flag" },
];
