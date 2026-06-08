import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FileSearch, Calendar, ArrowRight, Trash2, Edit3, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const FIELD_TYPES = ["string", "currency", "date", "number", "boolean", "percentage"];
const authHeader = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access_token")}` });

export default function Schemas() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [schemaName, setSchemaName] = useState("");
  const [docType, setDocType] = useState("");
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

  const createSchema = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/schemas", {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ name: schemaName, doc_type: docType, description, fields }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to save schema");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Schema saved");
      qc.invalidateQueries({ queryKey: ["schemas"] });
      setOpen(false);
      setSchemaName(""); setDocType(""); setDescription("");
      setFields([{ name: "", type: "string", description: "" }]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNewModal = () => {
    setSchemaName("");
    setDocType("");
    setDescription("");
    setFields([
      { name: "gstin", type: "string", description: "15-character GST registration number" },
      { name: "period", type: "date", description: "Return period (month/year)" },
      { name: "total_taxable_value", type: "currency", description: "Aggregate taxable supply" },
    ]);
    setOpen(true);
  };

  const openEditModal = (schema: any) => {
    setSchemaName(schema.name);
    setDocType(schema.doc_type || "");
    setDescription(schema.description || "");
    setFields(schema.fields && schema.fields.length > 0 ? schema.fields : [{ name: "", type: "string", description: "" }]);
    setOpen(true);
  };

  return (
    <div className="flex flex-col">
      <PageHeader title="Extraction schemas" description="Define how AI should structure data from each document type your firm handles.">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95" onClick={(e) => { e.preventDefault(); openNewModal(); }}>
              <Plus className="h-4 w-4" /> New schema
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display">
                <Wand2 className="h-5 w-5 text-primary" /> New extraction schema
              </DialogTitle>
            </DialogHeader>
            <div className="mt-3 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Schema name</Label>
                  <Input value={schemaName} onChange={e => setSchemaName(e.target.value)} placeholder="e.g. GSTR-9 Annual" />
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
                  <Label className="text-sm">Fields</Label>
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
                  disabled={createSchema.isPending || !schemaName.trim()}
                  onClick={() => createSchema.mutate()}
                  className="bg-gradient-primary text-primary-foreground hover:opacity-95"
                >
                  {createSchema.isPending ? "Saving…" : "Save schema"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="grid gap-4 px-6 py-6 md:px-8 lg:grid-cols-2 xl:grid-cols-3">
        {isLoading && (
          <p className="col-span-full text-center text-sm text-muted-foreground py-10">Loading schemas…</p>
        )}
        {!isLoading && schemas.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <Wand2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">No schemas yet — create one to start extracting structured data with Gemma 4:e4b.</p>
          </div>
        )}
        {schemas.map((s: any) => (
          <Card key={s.id} className="group relative overflow-hidden border-border/70 bg-card p-5 shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/12 text-primary">
                  <FileSearch className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold">{s.name}</h3>
                  <p className="text-[11px] text-muted-foreground">{(s.fields ?? []).length} fields</p>
                </div>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100" onClick={() => openEditModal(s)}>
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="mt-4 space-y-1.5">
              {(s.fields ?? []).slice(0, 3).map((f: any) => (
                <div key={f.name} className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/30 px-2 py-1.5">
                  <span className="font-mono text-[11px] font-semibold">{f.name}</span>
                  <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{f.type}</span>
                </div>
              ))}
              {(s.fields ?? []).length > 3 && (
                <p className="pt-1 text-center text-[11px] text-muted-foreground">+{s.fields.length - 3} more fields</p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Created {s.created_at ? formatDistanceToNow(new Date(s.created_at), { addSuffix: true }) : "recently"}</span>
              <button className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" onClick={() => openEditModal(s)}>Open <ArrowRight className="h-3 w-3" /></button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
