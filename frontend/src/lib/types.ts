export type DocStatus = "processed" | "pending" | "failed" | "review";
export type FilingType = "ITR" | "GST" | "TDS" | "ROC" | "Audit";
export type ClientStatus = "active" | "flagged" | "onboarding" | "archived";
export type Severity = "critical" | "warning" | "info" | "blocking" | "recommended";
export type JobStatus = "queued" | "processing" | "completed" | "failed";
export type DeadlineStatus = "upcoming" | "due_soon" | "overdue" | "filed";

export interface Client {
  id: string;
  name: string;
  pan: string;
  gstin?: string;
  type: "Pvt Ltd" | "LLP" | "Proprietorship" | "Partnership" | "Individual";
  filings: FilingType[];
  status: ClientStatus;
  partner: string;
  docsTotal: number;
  docsProcessed: number;
  flags: number;
  lastActivity: string; // ISO
  city: string;
}

export interface Document {
  id: string;
  clientId: string;
  filename: string;
  docType: string;
  financialYear: string;
  status: DocStatus;
  confidence: number; // 0-1
  anomalies: number;
  uploadedAt: string;
  size: string;
  extracted?: Record<string, string | number>;
}

export interface Job {
  id: string;
  clientId: string;
  clientName: string;
  type: string;
  status: JobStatus;
  progress: number;
  startedAt: string;
  durationMs?: number;
  filesCount: number;
}

export interface Deadline {
  id: string;
  clientId: string;
  clientName: string;
  type: FilingType;
  title: string;
  dueDate: string; // ISO
  status: DeadlineStatus;
}

export interface ReconciliationCheck {
  id: string;
  name: string;
  passed: boolean;
  severity: Severity;
  flagged?: { label: string; book: string; portal: string }[];
  message: string;
}

export interface MissingDoc {
  id: string;
  type: string;
  requiredFor: FilingType;
  severity: "blocking" | "recommended";
  note?: string;
}

export interface Schema {
  id: string;
  name: string;
  description: string;
  fieldCount: number;
  lastUsed: string;
  uses: number;
  fields: { name: string; type: string; description: string }[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: { docId: string; filename: string }[];
  timestamp: string;
}
