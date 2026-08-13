import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FileSearch, Calendar, ArrowRight, Trash2, Edit3, Wand2, RefreshCw, Folder } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const FIELD_TYPES = ["string", "currency", "date", "number", "boolean", "percentage"];
const CATEGORIES = [
  "GST Compliance",
  "Direct Tax & Income Tax",
  "Accounting & Banking",
  "Financial Statements & Audit",
  "Other"
];

const authHeader = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access_token")}` });

export default function Schemas() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>("All");

  const [schemaName, setSchemaName] = useState("");
  const [docType, setDocType] = useState("other");
  const [category, setCategory] = useState("GST Compliance");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState([
    { name: "gstin", type: "string", description: "15-character GST registration number" },
    { name: "period", type: "date", description: "Return period (month/year)" },
    { name: "total_taxable_value", type: "currency", description: "Aggregate taxable supply" },
  ]);

  const updateField = (i: number, key: string, val: string) =>
    setFields(fields.map((f, idx) => (idx === i ? { ...f, [key]: val } : f)));

  const { data: schemas = [], isLoading } = useQuery<any[]>({
    queryKey: ["schemas"],
    queryFn: async () => {
      const res = await fetch("/api/v1/schemas", { headers: authHeader() });
      if (!res.ok) throw new Error("Failed");
      return res.json().then(d => d.data ?? []);
    },
  });

  const saveSchemaMutation = useMutation({
    mutationFn: async () => {
      const isEdit = !!editingId;
      const url = isEdit ? `/api/v1/schemas/${editingId}` : "/api/v1/schemas";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: authHeader(),
        body: JSON.stringify({ name: schemaName, doc_type: docType, category, description, fields }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to save schema");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(editingId ? "Schema updated" : "Schema created");
      qc.invalidateQueries({ queryKey: ["schemas"] });
      setOpen(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSchemaMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/schemas/${id}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      if (!res.ok) throw new Error("Failed to delete schema");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Schema deleted");
      qc.invalidateQueries({ queryKey: ["schemas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetDefaultsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/schemas/reset-defaults", {
        method: "POST",
        headers: authHeader(),
      });
      if (!res.ok) throw new Error("Failed to reset standard schemas");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message || "Standard schemas restored");
      qc.invalidateQueries({ queryKey: ["schemas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => {
    setEditingId(null);
    setSchemaName("");
    setDocType("other");
    setCategory("GST Compliance");
    setDescription("");
    setFields([
      { name: "gstin", type: "string", description: "15-character GST registration number" },
      { name: "period", type: "date", description: "Return period (month/year)" },
      { name: "total_taxable_value", type: "currency", description: "Aggregate taxable supply" },
    ]);
  };

  const openNewModal = () => {
    resetForm();
    setOpen(true);
  };

  const openEditModal = (schema: any) => {
    setEditingId(schema.id);
    setSchemaName(schema.name);
    setDocType(schema.doc_type || "other");
    setCategory(schema.category || "GST Compliance");
    setDescription(schema.description || "");
    setFields(schema.fields && schema.fields.length > 0 ? schema.fields : [{ name: "", type: "string", description: "" }]);
    setOpen(true);
  };

  const filteredSchemas = schemas.filter((s) => {
    if (selectedCategoryTab === "All") return true;
    return (s.category || "Other") === selectedCategoryTab;
  });

  return (
    <div className="flex flex-col">
      <PageHeader title="Extraction schemas" description="Define how AI should structure data from each document type your firm handles.">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetDefaultsMutation.mutate()}
            disabled={resetDefaultsMutation.isPending}
            className="gap-1.5"
            title="Restore standard tax & audit schemas"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resetDefaultsMutation.isPending ? "animate-spin" : ""}`} />
            {resetDefaultsMutation.isPending ? "Seeding…" : "Restore Defaults"}
          </Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95" onClick={(e) => { e.preventDefault(); openNewModal(); }}>
                <Plus className="h-4 w-4" /> New schema
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-display">
                  <Wand2 className="h-5 w-5 text-primary" /> {editingId ? "Edit extraction schema" : "New extraction schema"}
                </DialogTitle>
              </DialogHeader>
              <div className="mt-3 space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5 sm:col-span-1">
                    <Label>Schema name</Label>
                    <Input value={schemaName} onChange={e => setSchemaName(e.target.value)} placeholder="e.g. GSTR-3B Summary" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Document type</Label>
                    <Select value={docType} onValueChange={setDocType}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gstr">GSTR returns</SelectItem>
                        <SelectItem value="bank">Bank statements</SelectItem>
                        <SelectItem value="form16">Form 16 / 16A</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="What should this schema extract? Be specific so the AI gets it right." />
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <Label className="text-sm">Fields ({fields.length})</Label>
                    <Button size="sm" variant="outline" onClick={() => setFields([...fields, { name: "", type: "string", description: "" }])} className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> Add field
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {fields.map((f, i) => (
                      <div key={i} className="grid grid-cols-[1.1fr_140px_2fr_auto] gap-2 rounded-lg border border-border/60 bg-muted/20 p-2">
                        <Input placeholder="field_name" value={f.name} onChange={e => updateField(i, "name", e.target.value)} className="h-9 font-mono text-xs" />
                        <Select value={f.type} onValueChange={v => updateField(i, "type", v)}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input placeholder="Description" value={f.description} onChange={e => updateField(i, "description", e.target.value)} className="h-9 text-xs" />
                        <Button size="icon" variant="ghost" onClick={() => setFields(fields.filter((_, idx) => idx !== i))} className="h-9 w-9 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button
                    disabled={saveSchemaMutation.isPending || !schemaName.trim()}
                    onClick={() => saveSchemaMutation.mutate()}
                    className="bg-gradient-primary text-primary-foreground hover:opacity-95"
                  >
                    {saveSchemaMutation.isPending ? "Saving…" : "Save schema"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      <div className="px-6 pt-4 md:px-8">
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-border/60 pb-3">
          {["All", ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategoryTab(cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                selectedCategoryTab === cat
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 px-6 py-6 md:px-8 lg:grid-cols-2 xl:grid-cols-3">
        {isLoading && (
          <p className="col-span-full text-center text-sm text-muted-foreground py-10">Loading schemas…</p>
        )}
        {!isLoading && filteredSchemas.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <Wand2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">No schemas found in this category.</p>
            <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => resetDefaultsMutation.mutate()}>
              <RefreshCw className="h-3.5 w-3.5" /> Restore Standard Schemas
            </Button>
          </div>
        )}
        {filteredSchemas.map((s: any) => (
          <Card key={s.id} className="group relative flex flex-col justify-between overflow-hidden border-border/70 bg-card p-5 shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-elevated">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
                    <FileSearch className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold leading-tight">{s.name}</h3>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] font-medium border-primary/20 bg-primary/5 text-primary">
                        {s.category || "General"}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">{(s.fields ?? []).length} fields</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditModal(s)} title="Edit schema">
                    <Edit3 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteSchemaMutation.mutate(s.id)} title="Delete schema">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {s.description && (
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                  {s.description}
                </p>
              )}

              <div className="mt-4 space-y-1.5">
                {(s.fields ?? []).slice(0, 4).map((f: any) => (
                  <div key={f.name} className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/30 px-2 py-1.5">
                    <span className="font-mono text-[11px] font-semibold text-foreground">{f.name}</span>
                    <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{f.type}</span>
                  </div>
                ))}
                {(s.fields ?? []).length > 4 && (
                  <p className="pt-1 text-center text-[11px] font-medium text-muted-foreground">+{s.fields.length - 4} more fields</p>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Created {s.created_at ? formatDistanceToNow(new Date(s.created_at), { addSuffix: true }) : "recently"}</span>
              <button className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" onClick={() => openEditModal(s)}>Edit Schema <ArrowRight className="h-3 w-3" /></button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
