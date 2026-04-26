import { useState } from "react";
import { Plus, FileSearch, Calendar, ArrowRight, Trash2, Edit3, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { schemas } from "@/lib/mock-data";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const FIELD_TYPES = ["string", "currency", "date", "number", "boolean", "percentage"];

export default function Schemas() {
  const [fields, setFields] = useState([
    { name: "gstin", type: "string", description: "15-character GST registration number" },
    { name: "period", type: "date", description: "Return period (month/year)" },
    { name: "total_taxable_value", type: "currency", description: "Aggregate taxable supply" },
  ]);

  return (
    <div className="flex flex-col">
      <PageHeader title="Extraction schemas" description="Define how AI should structure data from each document type your firm handles.">
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
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
                  <Input placeholder="e.g. GSTR-9 Annual" />
                </div>
                <div className="space-y-1.5">
                  <Label>Document type</Label>
                  <Select>
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
                <Textarea rows={2} placeholder="What should this schema extract? Be specific so the AI gets it right." />
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
                      <Input placeholder="field_name" defaultValue={f.name} className="h-9 font-mono text-xs" />
                      <Select defaultValue={f.type}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input placeholder="Description" defaultValue={f.description} className="h-9 text-xs" />
                      <Button size="icon" variant="ghost" onClick={() => setFields(fields.filter((_, idx) => idx !== i))} className="h-9 w-9 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm">Anomaly rules</Label>
                <p className="mb-2 mt-1 text-xs text-muted-foreground">Optional checks that flag values for review.</p>
                <Textarea rows={3} placeholder={"e.g.\ntotal_taxable_value > 0\ncgst + sgst == igst when interstate"} className="font-mono text-xs" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline">Cancel</Button>
                <Button onClick={() => toast.success("Schema saved")} className="bg-gradient-primary text-primary-foreground hover:opacity-95">
                  Save schema
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="grid gap-4 px-6 py-6 md:px-8 lg:grid-cols-2 xl:grid-cols-3">
        {schemas.map((s) => (
          <Card key={s.id} className="group relative overflow-hidden border-border/70 bg-card p-5 shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/12 text-primary">
                  <FileSearch className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold">{s.name}</h3>
                  <p className="text-[11px] text-muted-foreground">{s.fieldCount} fields · {s.uses.toLocaleString()} uses</p>
                </div>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100">
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>

            <div className="mt-4 space-y-1.5">
              {s.fields.slice(0, 3).map((f) => (
                <div key={f.name} className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/30 px-2 py-1.5">
                  <span className="font-mono text-[11px] font-semibold">{f.name}</span>
                  <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{f.type}</span>
                </div>
              ))}
              {s.fields.length > 3 && (
                <p className="pt-1 text-center text-[11px] text-muted-foreground">+{s.fields.length - 3} more fields</p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Used {formatDistanceToNow(new Date(s.lastUsed), { addSuffix: true })}</span>
              <button className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">Open <ArrowRight className="h-3 w-3" /></button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
