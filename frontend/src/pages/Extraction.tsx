import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import {
  UploadCloud, FileText, X, CheckCircle2, Sparkles, Loader2, Plus,
  FileSearch, Calendar, ArrowRight, Trash2, Edit3, AlertTriangle, Hash, RefreshCw, Layers
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { StatusBadge } from "@/components/status-badge";

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  progress: number;
  done: boolean;
  documentId?: string;
  jobId?: string;
}

const CATEGORY_ORDER = [
  "GST Compliance",
  "Direct Tax & Income Tax",
  "Accounting & Banking",
  "Financial Statements & Audit",
  "Other"
];

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("access_token")}` });

export default function Extraction() {
  const qc = useQueryClient();
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(true);

  // Upload Form State
  const [clientId, setClientId] = useState<string>("");
  const [schemaId, setSchemaId] = useState<string>("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});

  // Fetch all clients
  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch("/api/v1/clients", { headers: authHeader() });
      if (!res.ok) throw new Error("Failed");
      return res.json().then((d) => d.data ?? []);
    },
  });

  // Fetch all schemas
  const { data: serverSchemas = [] } = useQuery<any[]>({
    queryKey: ["schemas"],
    queryFn: async () => {
      const res = await fetch("/api/v1/schemas", { headers: authHeader() });
      if (!res.ok) throw new Error("Failed");
      return res.json().then((d) => d.data ?? []);
    },
  });

  // Fetch all extraction sessions / documents
  const { data: documents = [], isLoading: isLoadingDocs } = useQuery<any[]>({
    queryKey: ["documents-all"],
    queryFn: async () => {
      const res = await fetch("/api/v1/documents", { headers: authHeader() });
      if (!res.ok) throw new Error("Failed");
      return res.json().then((d) => d.data ?? []);
    },
    refetchInterval: 4000,
  });

  // Auto-select first document if available and not explicitly creating new
  useEffect(() => {
    if (clients.length > 0 && !clientId) {
      setClientId(clients[0].id);
    }
    if (serverSchemas.length > 0 && !schemaId) {
      setSchemaId(serverSchemas[0].id);
    }
  }, [clients, serverSchemas]);

  // Fetch single active document detail when selected
  const { data: activeDoc, refetch: refetchActiveDoc } = useQuery<any>({
    queryKey: ["document", selectedDocId],
    queryFn: async () => {
      if (!selectedDocId) return null;
      const res = await fetch(`/api/v1/documents/${selectedDocId}`, { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load document");
      return res.json().then((d) => d.data);
    },
    enabled: !!selectedDocId && !isCreatingNew,
    refetchInterval: (query) => {
      const doc = query.state.data;
      return doc?.status === "processing" || doc?.status === "pending" ? 3000 : false;
    },
  });

  const onDrop = (acceptedFiles: File[]) => {
    if (!clientId) {
      toast.error("Please select a client before dropping files.");
      return;
    }
    const newFiles: UploadedFile[] = acceptedFiles.map((f) => ({
      id: Math.random().toString(36).substring(2, 9),
      name: f.name,
      size: `${(f.size / (1024 * 1024)).toFixed(2)} MB`,
      progress: 0,
      done: false,
    }));
    setFiles((prev) => [...prev, ...newFiles]);

    acceptedFiles.forEach((file, index) => {
      const targetId = newFiles[index].id;
      const formData = new FormData();
      formData.append("client_id", clientId);
      if (schemaId) formData.append("schema_id", schemaId);
      formData.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/v1/documents/upload");
      xhr.setRequestHeader("Authorization", `Bearer ${localStorage.getItem("access_token")}`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setFiles((prev) =>
            prev.map((f) => (f.id === targetId ? { ...f, progress: percent } : f))
          );
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const resp = JSON.parse(xhr.responseText);
          const docId = resp.data?.document_id;
          setFiles((prev) =>
            prev.map((f) =>
              f.id === targetId ? { ...f, progress: 100, done: true, documentId: docId } : f
            )
          );
          toast.success(`Uploaded ${file.name}`);
          qc.invalidateQueries({ queryKey: ["documents-all"] });
          if (docId) {
            setSelectedDocId(docId);
            setIsCreatingNew(false);
          }
        } else {
          toast.error(`Upload failed for ${file.name}`);
          setFiles((prev) => prev.filter((f) => f.id !== targetId));
        }
      };

      xhr.onerror = () => {
        toast.error(`Network error uploading ${file.name}`);
        setFiles((prev) => prev.filter((f) => f.id !== targetId));
      };

      xhr.send(formData);
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/tiff": [".tiff"],
    },
  });

  const updateDocumentMutation = useMutation({
    mutationFn: async (updatedData: any) => {
      if (!selectedDocId) return;
      const res = await fetch(`/api/v1/documents/${selectedDocId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access_token")}` },
        body: JSON.stringify({ extractedData: updatedData }),
      });
      if (!res.ok) throw new Error("Failed to update field");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Field updated");
      refetchActiveDoc();
      setEditingField(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reprocessMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDocId) return;
      const res = await fetch(`/api/v1/documents/${selectedDocId}/reprocess`, {
        method: "POST",
        headers: authHeader(),
      });
      if (!res.ok) throw new Error("Failed to restart extraction");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Extraction restarted");
      refetchActiveDoc();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startNewSession = () => {
    setSelectedDocId(null);
    setIsCreatingNew(true);
    setFiles([]);
  };

  const selectSession = (docId: string) => {
    setSelectedDocId(docId);
    setIsCreatingNew(false);
  };

  const extracted = activeDoc?.extractedData || {};
  const anomalies = activeDoc?.anomalies || [];
  const isPending = activeDoc?.status === "processing" || activeDoc?.status === "pending";
  const keyFields = extracted.key_fields || {};
  const dates = extracted.dates || [];

  const handleSaveField = (key: string, isKeyField = false) => {
    const newVal = editedValues[key];
    if (newVal === undefined) {
      setEditingField(null);
      return;
    }
    const currentExtracted = { ...extracted };
    if (isKeyField) {
      currentExtracted.key_fields = { ...keyFields, [key]: newVal };
    } else {
      currentExtracted[key] = newVal;
    }
    updateDocumentMutation.mutate(currentExtracted);
  };

  const handlePromoteField = (key: string, val: any) => {
    const currentExtracted = { ...extracted };
    currentExtracted[key] = val;

    const newKeyFields = { ...keyFields };
    delete newKeyFields[key];
    currentExtracted.key_fields = newKeyFields;

    updateDocumentMutation.mutate(currentExtracted);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <PageHeader
        title="Document Extraction Workspace"
        description="Session-based AI document intelligence powered by Gemma4."
      >
        <Button
          onClick={startNewSession}
          className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
        >
          <Plus className="h-4 w-4" /> New Extraction Session
        </Button>
      </PageHeader>

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-12 overflow-hidden border-t border-border/60">
        {/* Left Sidebar - Sessions History */}
        <div className="lg:col-span-3 border-r border-border/60 bg-card/40 flex flex-col overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" /> Extraction Sessions
            </span>
            <Badge variant="outline" className="text-[10px] rounded-full num-tabular">
              {documents.length}
            </Badge>
          </div>

          <Button
            variant={isCreatingNew ? "default" : "outline"}
            onClick={startNewSession}
            className="w-full justify-start gap-2 h-10 border-dashed"
          >
            <Plus className="h-4 w-4" /> Start New Upload
          </Button>

          <div className="space-y-2 mt-2">
            {isLoadingDocs && (
              <p className="text-xs text-muted-foreground py-4 text-center">Loading sessions…</p>
            )}
            {!isLoadingDocs && documents.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center italic">No extraction sessions yet.</p>
            )}
            {documents.map((doc: any) => {
              const active = selectedDocId === doc.id && !isCreatingNew;
              return (
                <div
                  key={doc.id}
                  onClick={() => selectSession(doc.id)}
                  className={`group relative cursor-pointer rounded-xl border p-3 transition-all ${
                    active
                      ? "border-primary/40 bg-primary/10 shadow-sm"
                      : "border-border/60 bg-background/50 hover:bg-muted/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate text-foreground">{doc.filename}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {doc.uploadedAt ? formatDistanceToNow(new Date(doc.uploadedAt), { addSuffix: true }) : "Recently"}
                      </p>
                    </div>
                    <StatusBadge status={doc.status} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Main Workspace */}
        <div className="lg:col-span-9 flex flex-col overflow-y-auto p-6">
          {isCreatingNew ? (
            /* Upload Mode */
            <div className="max-w-4xl mx-auto w-full space-y-6">
              <Card className="border-border/70 bg-card p-6 shadow-elegant">
                <h3 className="font-display text-base font-bold mb-4">Start New Extraction</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Target client
                    </label>
                    <Select value={clientId} onValueChange={setClientId}>
                      <SelectTrigger className="mt-1.5 h-10">
                        <SelectValue placeholder="Select client…" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.pan || "No PAN"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Extraction schema
                    </label>
                    <Select value={schemaId} onValueChange={setSchemaId}>
                      <SelectTrigger className="mt-1.5 h-10">
                        <SelectValue placeholder="Select extraction schema…" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_ORDER.map((cat) => {
                          const schemasInCat = serverSchemas?.filter(
                            (s: any) => (s.category || "Other") === cat
                          );
                          if (!schemasInCat || schemasInCat.length === 0) return null;
                          return (
                            <SelectGroup key={cat}>
                              <SelectLabel className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/40">
                                {cat}
                              </SelectLabel>
                              {schemasInCat.map((s: any) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>

              {/* Dropzone */}
              <Card
                {...getRootProps()}
                className={`relative cursor-pointer overflow-hidden border-2 border-dashed bg-card p-10 text-center transition-all ${
                  isDragActive
                    ? "border-primary bg-primary/5 shadow-glow"
                    : "border-border/70 hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                <input {...getInputProps()} />
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/12 text-primary">
                  <UploadCloud className="h-7 w-7" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold">
                  Drop documents here to extract
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Supports PDF, PNG, JPG, TIFF · Max 50 MB per file
                </p>
                <Button className="mt-4 gap-2 bg-gradient-primary text-primary-foreground shadow-glow">
                  Browse files
                </Button>
              </Card>

              {/* Uploaded Files Progress */}
              {files.length > 0 && (
                <Card className="border-border/70 bg-card p-5 shadow-elegant">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    Uploaded Batch ({files.length})
                  </h4>
                  <div className="space-y-3">
                    {files.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/50 p-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-5 w-5 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">{f.name}</p>
                            <p className="text-[10px] text-muted-foreground">{f.size}</p>
                          </div>
                        </div>
                        {f.done ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-success">
                            <CheckCircle2 className="h-4 w-4" /> Ready
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            <span className="text-xs font-mono">{f.progress}%</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          ) : (
            /* Results View Mode */
            <div className="space-y-6">
              {/* Top Banner & Status */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/70 bg-card p-5 shadow-elegant">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-lg font-bold">{activeDoc?.filename}</h2>
                    {activeDoc?.status && <StatusBadge status={activeDoc.status} />}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Uploaded {activeDoc?.uploadedAt ? formatDistanceToNow(new Date(activeDoc.uploadedAt), { addSuffix: true }) : "recently"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => reprocessMutation.mutate()}
                    disabled={reprocessMutation.isPending}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${reprocessMutation.isPending ? "animate-spin" : ""}`} />
                    Reprocess
                  </Button>
                </div>
              </div>

              {isPending && (
                <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/8 px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                  <p className="text-sm text-foreground">
                    <strong>Processing in progress.</strong> gemma4 is analyzing your document.
                  </p>
                </div>
              )}

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
                    {anomalies.map((a: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-background/50 px-3 py-2.5">
                        <span className="font-mono text-[11px] font-bold text-destructive uppercase tracking-wider mt-0.5">{a.type?.replace(/_/g, " ")}</span>
                        <span className="text-xs text-muted-foreground">{a.detail}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Extracted Fields */}
              {(() => {
                // Combine standard fields, root fields, and key_fields (schema fields) into Main Result
                const mainEntries: [string, any][] = [];
                const addedKeys = new Set<string>();

                // 1. Standard core fields first if present
                const coreOrder = ["document_type", "entity_name", "pan", "gstin", "financial_year", "total_amount", "tax_amount", "summary"];
                coreOrder.forEach((k) => {
                  if (extracted[k] !== undefined) {
                    mainEntries.push([k, extracted[k]]);
                    addedKeys.add(k);
                  }
                });

                // 2. Add all schema/key fields extracted by gemma4
                if (extracted.key_fields && typeof extracted.key_fields === "object") {
                  Object.entries(extracted.key_fields).forEach(([k, v]) => {
                    if (!addedKeys.has(k)) {
                      mainEntries.push([k, v]);
                      addedKeys.add(k);
                    }
                  });
                }

                // 3. Add remaining root keys
                Object.entries(extracted).forEach(([k, v]) => {
                  if (!addedKeys.has(k) && !["line_items", "dates", "raw_response", "key_fields", "schema_id", "schema_name"].includes(k)) {
                    mainEntries.push([k, v]);
                    addedKeys.add(k);
                  }
                });

                return (
                  <div className="grid gap-5 lg:grid-cols-2">
                    <Card className="border-border/70 bg-card p-5 shadow-elegant">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <h3 className="font-display text-sm font-bold">Main Extraction Result</h3>
                      </div>
                      {!isPending && mainEntries.length === 0 && (
                        <p className="text-sm text-muted-foreground">No data extracted yet.</p>
                      )}
                      <div className="space-y-2.5">
                        {mainEntries.map(([k, v]) => {
                          const isEditing = editingField === k;
                          const displayVal = v != null && v !== "" ? String(v) : "Not Found";
                          return (
                            <div key={k} className="flex items-center justify-between border-b border-border/40 pb-2 text-xs hover:bg-muted/20 px-1.5 py-1 rounded">
                              <span className="font-mono text-muted-foreground uppercase text-[11px] min-w-[130px]">
                                {k.replace(/_/g, " ")}
                              </span>
                              {isEditing ? (
                                <div className="flex items-center gap-1.5">
                                  <Input
                                    value={editedValues[k] !== undefined ? editedValues[k] : v || ""}
                                    onChange={(e) => setEditedValues({ ...editedValues, [k]: e.target.value })}
                                    className="h-7 w-44 text-xs font-mono"
                                  />
                                  <Button size="xs" onClick={() => handleSaveField(k, extracted.key_fields && k in extracted.key_fields)}>Save</Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 max-w-[65%] text-right">
                                  <span className={`font-semibold ${displayVal === "Not Found" ? "text-muted-foreground italic font-normal" : "text-foreground"}`}>
                                    {displayVal}
                                  </span>
                                  <Button size="icon" variant="ghost" className="h-6 w-6 opacity-60 hover:opacity-100 shrink-0" onClick={() => { setEditingField(k); setEditedValues({ [k]: v }); }}>
                                    <Edit3 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </Card>

                    {/* AI Discoveries */}
                    <Card className="border-border/70 bg-card p-5 shadow-elegant">
                      <div className="flex items-center gap-2 mb-4">
                        <Hash className="h-4 w-4 text-primary" />
                        <h3 className="font-display text-sm font-bold">AI Discoveries & Dates</h3>
                      </div>
                      {dates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">All extracted schema fields are rendered in Main Extraction Result.</p>
                      ) : (
                        <div className="space-y-4">
                          {dates.length > 0 && (
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Important Dates Discovered</p>
                              <div className="flex flex-wrap gap-1.5">
                                {dates.map((d: string, i: number) => (
                                  <Badge key={i} variant="outline" className="text-xs font-mono bg-primary/5 text-primary border-primary/20">{d}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
