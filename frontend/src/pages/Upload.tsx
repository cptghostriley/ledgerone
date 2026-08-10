import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileText, X, CheckCircle2, ArrowLeft, Sparkles, ExternalLink, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  progress: number;
  done: boolean;
  documentId?: string;
  jobId?: string;
}

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("access_token")}` });

/** Polls a job status until it's completed or failed. */
function useJobPoller(jobId: string | null) {
  const [status, setStatus] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let stopped = false;

    const poll = async () => {
      while (!stopped) {
        try {
          const res = await fetch(`/api/v1/jobs/${jobId}`, { headers: authHeader() });
          if (res.ok) {
            const data = await res.json();
            const j = data.data ?? data;
            setStatus(j.status);
            if (j.status === "completed" && j.document_id) {
              setDocumentId(j.document_id);
              break;
            }
            if (j.status === "failed") break;
          }
        } catch (_) {}
        await new Promise((r) => setTimeout(r, 3000));
      }
    };

    poll();
    return () => { stopped = true; };
  }, [jobId]);

  return { status, documentId };
}

export default function Upload() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: serverClients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch("/api/v1/clients", { headers: authHeader() });
      if (!res.ok) throw new Error("Failed");
      return res.json().then((d) => d.data);
    },
  });

  const { data: serverSchemas } = useQuery({
    queryKey: ["schemas"],
    queryFn: async () => {
      const res = await fetch("/api/v1/schemas", { headers: authHeader() });
      if (!res.ok) throw new Error("Failed");
      return res.json().then((d) => d.data);
    },
  });

  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedSchema, setSelectedSchema] = useState<string>("");

  const client =
    serverClients?.find((c: any) => c.id === (selectedClient || id)) ||
    serverClients?.[0] ||
    { id: "unknown", name: "Unknown" };
  const schemaId = selectedSchema || serverSchemas?.[0]?.id || "";

  const [files, setFiles] = useState<UploadedFile[]>([]);

  // Track the most recent completed job that finished, then navigate to results
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const { status: polledStatus, documentId: polledDocId } = useJobPoller(pendingJobId);

  useEffect(() => {
    if (polledStatus === "completed" && polledDocId) {
      toast.success("Processing complete! Opening results…");
      navigate(`/documents/${polledDocId}`);
    }
    if (polledStatus === "failed") {
      toast.error("Processing failed. Check the Jobs page for details.");
      setPendingJobId(null);
    }
  }, [polledStatus, polledDocId, navigate]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"], "image/*": [".png", ".jpg", ".jpeg"] },
    onDrop: (accepted) => {
      const newFiles = accepted.map((f) => ({
        id: `${Date.now()}-${f.name}`,
        name: f.name,
        size: `${(f.size / 1024 / 1024).toFixed(2)} MB`,
        progress: 0,
        done: false,
      }));
      setFiles((prev) => [...prev, ...newFiles]);

      accepted.forEach((f, idx) => {
        const fileId = newFiles[idx].id;
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = (e.loaded / e.total) * 100;
            setFiles((prev) =>
              prev.map((item) => (item.id === fileId ? { ...item, progress: pct } : item))
            );
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const resp = JSON.parse(xhr.responseText);
            const docId = resp?.data?.document_id;
            const jobId = resp?.data?.job_id;
            toast.success(`${f.name} uploaded — processing started`);
            setFiles((prev) =>
              prev.map((item) =>
                item.id === fileId
                  ? { ...item, progress: 100, done: true, documentId: docId, jobId }
                  : item
              )
            );
            // Start polling the first uploaded job
            if (jobId) setPendingJobId(jobId);
          } else {
            toast.error(`Upload failed for ${f.name}`);
            setFiles((prev) =>
              prev.map((item) => (item.id === fileId ? { ...item, progress: 0 } : item))
            );
          }
        };
        xhr.onerror = () => {
          toast.error(`Upload failed for ${f.name}`);
          setFiles((prev) =>
            prev.map((item) => (item.id === fileId ? { ...item, progress: 0 } : item))
          );
        };

        xhr.open("POST", "/api/v1/documents/upload");
        xhr.setRequestHeader("Authorization", `Bearer ${localStorage.getItem("access_token")}`);
        const formData = new FormData();
        formData.append("file", f);
        formData.append("client_id", client.id);
        if (schemaId) formData.append("schema_id", schemaId);
        xhr.send(formData);
      });
      toast.success(`${accepted.length} file${accepted.length > 1 ? "s" : ""} added to queue`);
    },
  });

  const isProcessing = !!pendingJobId && polledStatus !== "completed" && polledStatus !== "failed";

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Upload documents"
        description={`Files will be processed locally and attached to ${client.name}.`}
      >
        <Button asChild variant="outline" className="gap-2">
          <Link to={`/clients/${client.id}`}>
            <ArrowLeft className="h-4 w-4" /> Back to client
          </Link>
        </Button>
      </PageHeader>

      {isProcessing && (
        <div className="mx-6 mb-0 mt-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/8 px-5 py-3 md:mx-8">
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          <p className="text-sm text-foreground">
            <strong>Processing with gemma4:e2b…</strong> Hang tight, the results page will open automatically.
          </p>
        </div>
      )}

      <div className="grid gap-5 px-6 py-6 md:px-8 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <Card className="border-border/70 bg-card p-5 shadow-elegant">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Client
                </label>
                <Select value={selectedClient || client.id} onValueChange={setSelectedClient}>
                  <SelectTrigger className="mt-1.5 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {serverClients?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Extraction schema
                </label>
                <Select value={schemaId} onValueChange={setSelectedSchema}>
                  <SelectTrigger className="mt-1.5 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {serverSchemas?.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card
            {...getRootProps()}
            className={`relative cursor-pointer overflow-hidden border-2 border-dashed bg-card p-12 text-center transition-all ${
              isDragActive
                ? "border-primary bg-primary/5 shadow-glow"
                : "border-border/70 hover:border-primary/50 hover:bg-muted/20"
            }`}
          >
            <input {...getInputProps()} />
            <div className="pointer-events-none absolute inset-0 bg-gradient-glow opacity-50" />
            <div className="relative">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary shadow-glow">
                <UploadCloud className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold">
                {isDragActive ? "Drop files here" : "Drag & drop documents"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                or <span className="font-semibold text-primary">click to browse</span> · PDF, JPG, PNG up to 50MB
              </p>
              <div className="mt-4 flex justify-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="rounded-full border border-border bg-muted/40 px-2 py-1">GSTR-3B</span>
                <span className="rounded-full border border-border bg-muted/40 px-2 py-1">Form 16</span>
                <span className="rounded-full border border-border bg-muted/40 px-2 py-1">Bank statement</span>
                <span className="rounded-full border border-border bg-muted/40 px-2 py-1">Trial balance</span>
              </div>
            </div>
          </Card>

          {files.length > 0 && (
            <Card className="border-border/70 bg-card shadow-elegant">
              <div className="border-b border-border/60 px-5 py-3">
                <h3 className="font-display text-sm font-bold">Processing queue ({files.length})</h3>
              </div>
              <div className="divide-y divide-border/60">
                {files.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{f.name}</p>
                        <p className="text-[11px] text-muted-foreground num-tabular">{f.size}</p>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/60">
                          <div
                            className={`h-full rounded-full transition-all ${f.done ? "bg-success" : "bg-gradient-primary"}`}
                            style={{ width: `${f.progress}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-[10px] font-semibold num-tabular text-muted-foreground">
                          {f.done ? "Done" : `${Math.round(f.progress)}%`}
                        </span>
                      </div>
                    </div>
                    {f.done ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        {f.documentId && (
                          <Link
                            to={`/documents/${f.documentId}`}
                            className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" /> View
                          </Link>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => setFiles((p) => p.filter((x) => x.id !== f.id))}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <Card className="h-fit border-border/70 bg-card p-5 shadow-elegant">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-bold">What happens next</h3>
          </div>
          <ol className="mt-4 space-y-3">
            {[
              { n: 1, title: "Local OCR", desc: "Files are parsed on your firm's server using Tesseract & layout models." },
              { n: 2, title: "Schema extraction", desc: "gemma4:e2b maps the content to your selected schema fields." },
              { n: 3, title: "Anomaly detection", desc: "Rules engine checks values against your custom thresholds." },
              { n: 4, title: "Ready in client folder", desc: "Documents become searchable and join future reconciliations." },
            ].map((s) => (
              <li key={s.n} className="flex gap-3">
                <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/12 text-[11px] font-bold text-primary">
                  {s.n}
                </div>
                <div>
                  <p className="text-sm font-semibold">{s.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-5 rounded-lg border border-primary/25 bg-primary/8 p-3">
            <p className="text-[11px] leading-relaxed text-foreground">
              <strong>100% private.</strong> Your client data is never sent to a third-party API or cloud.
              Everything runs on the on-premise Ollama instance configured in Settings.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
