import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileText, X, CheckCircle2, ArrowLeft, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clients, schemas } from "@/lib/mock-data";
import { toast } from "sonner";

interface UploadedFile { id: string; name: string; size: string; progress: number; done: boolean }

export default function Upload() {
  const { data: serverClients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch("/api/v1/clients", {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
      });
      if (!res.ok) throw new Error("Failed");
      return res.json().then(d => d.data);
    }
  });

  const client = serverClients?.find((c: any) => c.id === id) || serverClients?.[0] || clients[0];
  const [files, setFiles] = useState<UploadedFile[]>([]);

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
            const percentComplete = (e.loaded / e.total) * 100;
            setFiles(prev => prev.map(item => item.id === fileId ? { ...item, progress: percentComplete, done: percentComplete === 100 } : item));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            toast.success(`${f.name} uploaded successfully`);
            setFiles(prev => prev.map(item => item.id === fileId ? { ...item, progress: 100, done: true } : item));
          } else {
            toast.error(`Upload failed for ${f.name}`);
          }
        };
        xhr.onerror = () => toast.error(`Upload failed for ${f.name}`);
        
        xhr.open("POST", "/api/v1/documents/upload");
        xhr.setRequestHeader("Authorization", `Bearer ${localStorage.getItem("access_token")}`);
        const formData = new FormData();
        formData.append("file", f);
        formData.append("client_id", client.id);
        xhr.send(formData);
      });
      toast.success(`${accepted.length} file${accepted.length > 1 ? "s" : ""} added to queue`);
    },
  });

  return (
    <div className="flex flex-col">
      <PageHeader title="Upload documents" description={`Files will be processed locally and attached to ${client.name}.`}>
        <Button asChild variant="outline" className="gap-2">
          <Link to={`/clients/${client.id}`}><ArrowLeft className="h-4 w-4" /> Back to client</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-5 px-6 py-6 md:px-8 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <Card className="border-border/70 bg-card p-5 shadow-elegant">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Client</label>
                <Select defaultValue={client.id}>
                  <SelectTrigger className="mt-1.5 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Extraction schema</label>
                <Select defaultValue={schemas[0].id}>
                  <SelectTrigger className="mt-1.5 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {schemas.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card
            {...getRootProps()}
            className={`relative cursor-pointer overflow-hidden border-2 border-dashed bg-card p-12 text-center transition-all ${
              isDragActive ? "border-primary bg-primary/5 shadow-glow" : "border-border/70 hover:border-primary/50 hover:bg-muted/20"
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
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <button onClick={() => setFiles((p) => p.filter((x) => x.id !== f.id))} className="text-muted-foreground hover:text-destructive">
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
              { n: 2, title: "Schema extraction", desc: "Gemma 2 maps the content to your selected schema fields." },
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
