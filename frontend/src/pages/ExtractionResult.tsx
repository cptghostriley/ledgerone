import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, FileText, CheckCircle2, AlertTriangle, Clock, Loader2,
  Sparkles, ChevronRight, BarChart3, Calendar, Building2, Hash, UploadCloud
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("access_token")}`,
});

function StatusIcon({ status }: { status: string }) {
  if (status === "processed") return <CheckCircle2 className="h-5 w-5 text-success" />;
  if (status === "failed") return <AlertTriangle className="h-5 w-5 text-destructive" />;
  if (status === "processing") return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  return <Clock className="h-5 w-5 text-muted-foreground" />;
}

function ConfidenceBar({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground text-xs">—</span>;
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-border/60">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold num-tabular">{pct}%</span>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/40 py-2.5 last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[140px]">
        {label.replace(/_/g, " ")}
      </span>
      <span className="text-sm text-right font-medium break-all">
        {typeof value === "object" ? JSON.stringify(value) : String(value)}
      </span>
    </div>
  );
}

export default function ExtractionResult() {
  const { documentId } = useParams<{ documentId: string }>();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["document", documentId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/documents/${documentId}`, { headers: authHeader() });
      if (!res.ok) throw new Error("Document not found");
      return res.json().then(d => d.data);
    },
    // Auto-refresh while processing
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "processing" ? 3000 : false;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading extraction result…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">Document not found or access denied.</p>
        <Button asChild variant="outline"><Link to="/clients">Back to clients</Link></Button>
      </div>
    );
  }

  const extracted = data.extractedData || {};
  const anomalies: any[] = Array.isArray(data.anomalies) ? data.anomalies : [];
  const keyFields = extracted.key_fields || {};
  const lineItems: any[] = extracted.line_items || [];
  const dates: string[] = extracted.dates || [];
  const isPending = data.status === "pending" || data.status === "processing";

  return (
    <div className="flex flex-col">
      <PageHeader
        title={data.filename || "Extraction Result"}
        description={data.summary || "AI-extracted document data"}
      >
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link to={`/clients/${data.clientId || ""}`}><ArrowLeft className="h-4 w-4" /> Back to client</Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to={`/clients/${data.clientId || ""}/upload`}><UploadCloud className="h-4 w-4" /> Upload more</Link>
          </Button>
        </div>
      </PageHeader>

      <div className="px-6 py-6 md:px-8 space-y-5">
        {/* Status card */}
        <Card className="border-border/70 bg-card p-5 shadow-elegant">
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex items-center gap-3">
              <StatusIcon status={data.status} />
              <div>
                <p className="text-sm font-semibold capitalize">{data.status}</p>
                <p className="text-xs text-muted-foreground">{data.filename}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              {data.mimeType || "document"}
            </div>

            {data.financialYear && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                FY {data.financialYear}
              </div>
            )}

            {data.docType && (
              <Badge variant="outline" className="text-xs font-mono">{data.docType}</Badge>
            )}

            <div className="ml-auto flex items-center gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Confidence</p>
                <ConfidenceBar value={data.confidence} />
              </div>
              {data.processingMs && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Processing time</p>
                  <p className="text-sm font-semibold num-tabular">{(data.processingMs / 1000).toFixed(1)}s</p>
                </div>
              )}
            </div>
          </div>

          {isPending && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/8 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              <p className="text-sm text-foreground">
                <strong>Processing in progress.</strong> gemma4:e4b is analyzing your document. This page will refresh automatically.
              </p>
            </div>
          )}
        </Card>

        {/* Anomalies */}
        {anomalies.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5 p-5 shadow-elegant">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <h3 className="font-display text-sm font-bold text-destructive">
                {anomalies.length} Anomal{anomalies.length === 1 ? "y" : "ies"} Detected
              </h3>
            </div>
            <div className="space-y-2">
              {anomalies.map((a, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-background/50 px-3 py-2.5">
                  <span className="font-mono text-[11px] font-bold text-destructive uppercase tracking-wider mt-0.5">{a.type?.replace(/_/g, " ")}</span>
                  <span className="text-xs text-muted-foreground">{a.detail}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Core fields */}
          <Card className="border-border/70 bg-card p-5 shadow-elegant">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-display text-sm font-bold">Extracted Core Fields</h3>
            </div>
            {!isPending && Object.keys(extracted).length === 0 && (
              <p className="text-sm text-muted-foreground">No data extracted yet.</p>
            )}
            <div>
              <FieldRow label="Document Type" value={extracted.document_type} />
              <FieldRow label="Entity Name" value={extracted.entity_name} />
              <FieldRow label="PAN" value={extracted.pan} />
              <FieldRow label="GSTIN" value={extracted.gstin} />
              <FieldRow label="Financial Year" value={extracted.financial_year} />
              <FieldRow label="Total Amount" value={extracted.total_amount != null ? `₹ ${Number(extracted.total_amount).toLocaleString("en-IN")}` : null} />
              <FieldRow label="Tax Amount" value={extracted.tax_amount != null ? `₹ ${Number(extracted.tax_amount).toLocaleString("en-IN")}` : null} />
              <FieldRow label="Summary" value={extracted.summary} />
            </div>
          </Card>

          {/* Key fields */}
          <Card className="border-border/70 bg-card p-5 shadow-elegant">
            <div className="flex items-center gap-2 mb-4">
              <Hash className="h-4 w-4 text-primary" />
              <h3 className="font-display text-sm font-bold">Additional Fields</h3>
            </div>
            {Object.keys(keyFields).length === 0 && dates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No additional fields found.</p>
            ) : (
              <>
                {Object.entries(keyFields).map(([k, v]) => (
                  <FieldRow key={k} label={k} value={v as any} />
                ))}
                {dates.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/40">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Dates Found</p>
                    <div className="flex flex-wrap gap-1.5">
                      {dates.map((d, i) => (
                        <Badge key={i} variant="outline" className="text-xs font-mono">{d}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>

        {/* Line items */}
        {lineItems.length > 0 && (
          <Card className="border-border/70 bg-card shadow-elegant">
            <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3.5">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="font-display text-sm font-bold">Line Items ({lineItems.length})</h3>
            </div>
            <div className="divide-y divide-border/40">
              {lineItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm">{item.description || `Item ${i + 1}`}</span>
                  <span className="font-semibold num-tabular text-sm">
                    {item.amount != null ? `₹ ${Number(item.amount).toLocaleString("en-IN")}` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Raw JSON fallback */}
        {extracted.raw_response && (
          <Card className="border-border/70 bg-card p-5 shadow-elegant">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Raw Model Response</p>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap overflow-auto max-h-64 rounded-lg border border-border/40 bg-muted/20 p-3">
              {extracted.raw_response}
            </pre>
          </Card>
        )}
      </div>
    </div>
  );
}
