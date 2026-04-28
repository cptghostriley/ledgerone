import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Search, Plus, Filter, ArrowUpDown, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const FILTERS = ["All", "ITR", "GST", "TDS", "ROC", "Audit"] as const;

const authHeader = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("access_token")}`,
});

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase();
}

export default function Clients() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<typeof FILTERS[number]>("All");
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [newClient, setNewClient] = useState({ name: "", pan: "", gstin: "", filing_type: "GST", ay: "" });

  const { data: serverClients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch("/api/v1/clients", { headers: authHeader() });
      if (!res.ok) throw new Error("Failed");
      return res.json().then(d => d.data ?? []);
    },
  });

  const createClient = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/clients", {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify(newClient),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to add client");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Client added successfully");
      qc.invalidateQueries({ queryKey: ["clients"] });
      setAddOpen(false);
      setNewClient({ name: "", pan: "", gstin: "", filing_type: "GST", ay: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteClient = useMutation({
    mutationFn: async (clientId: string) => {
      const res = await fetch(`/api/v1/clients/${clientId}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to delete client");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Client deleted");
      qc.invalidateQueries({ queryKey: ["clients"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clientsData = serverClients || [];

  const filtered = useMemo(() => {
    return clientsData.filter((c: any) => {
      const matchSearch =
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        (c.pan && c.pan.toLowerCase().includes(search.toLowerCase()));
      const matchFilter =
        filter === "All" ||
        c.filing_type === filter ||
        (c.filings && c.filings.includes(filter));
      return matchSearch && matchFilter;
    });
  }, [search, filter, clientsData]);

  return (
    <div className="flex flex-col">
      <PageHeader title="Clients" description={`${clientsData.length} client${clientsData.length !== 1 ? "s" : ""} across ITR, GST, TDS, ROC and Audit filings.`}>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" /> Advanced filters
        </Button>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
              <Plus className="h-4 w-4" /> Add client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">Add new client</DialogTitle>
            </DialogHeader>
            <div className="mt-3 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cname">Client / firm name <span className="text-destructive">*</span></Label>
                <Input id="cname" value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })} placeholder="e.g. Sharma Textiles Pvt Ltd" className="h-10" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cpan">PAN</Label>
                  <Input id="cpan" value={newClient.pan} onChange={e => setNewClient({ ...newClient, pan: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" className="h-10 font-mono" maxLength={10} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cgstin">GSTIN</Label>
                  <Input id="cgstin" value={newClient.gstin} onChange={e => setNewClient({ ...newClient, gstin: e.target.value.toUpperCase() })} placeholder="22ABCDE1234F1Z5" className="h-10 font-mono" maxLength={15} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Filing type</Label>
                  <Select value={newClient.filing_type} onValueChange={v => setNewClient({ ...newClient, filing_type: v })}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["GST", "ITR", "TDS", "ROC", "Audit"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cay">Assessment Year</Label>
                  <Input id="cay" value={newClient.ay} onChange={e => setNewClient({ ...newClient, ay: e.target.value })} placeholder="2025-26" className="h-10" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button
                  disabled={createClient.isPending || !newClient.name.trim()}
                  onClick={() => createClient.mutate()}
                  className="bg-gradient-primary text-primary-foreground hover:opacity-95"
                >
                  {createClient.isPending ? "Saving…" : "Add client"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete client?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong> and all associated documents. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteClient.mutate(deleteTarget.id)}
              disabled={deleteClient.isPending}
            >
              {deleteClient.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-4 px-6 py-6 md:px-8">
        <Card className="border-border/70 bg-card shadow-elegant">
          <div className="flex flex-col gap-3 border-b border-border/60 p-4 md:flex-row md:items-center md:justify-between">
            <div className="relative md:max-w-sm md:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or PAN…"
                className="h-10 border-border bg-muted/30 pl-10"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {FILTERS.map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "default" : "ghost"}
                  onClick={() => setFilter(f)}
                  className={
                    filter === f
                      ? "h-8 rounded-full bg-primary px-4 text-xs text-primary-foreground hover:bg-primary/90"
                      : "h-8 rounded-full px-4 text-xs text-muted-foreground hover:text-foreground"
                  }
                >
                  {f}
                </Button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead className="w-[34%]">
                    <button className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Client <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Filing Type</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">PAN</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">AY</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">Loading clients…</TableCell>
                  </TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      {search ? "No clients match your search." : "No clients yet — add your first client above."}
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((c: any) => (
                  <TableRow
                    key={c.id}
                    className="group cursor-pointer border-border/40 transition-colors hover:bg-muted/40"
                    onClick={() => (window.location.href = `/clients/${c.id}`)}
                  >
                    <TableCell className="py-3.5">
                      <Link to={`/clients/${c.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <Avatar className="h-10 w-10 border border-border">
                          <AvatarFallback className="bg-gradient-primary text-xs font-bold text-primary-foreground">
                            {initials(c.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{c.name}</p>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                            {c.gstin && <span className="font-mono">{c.gstin}</span>}
                          </div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      {c.filing_type && (
                        <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-muted-foreground">
                          {c.filing_type}
                        </span>
                      )}
                    </TableCell>
                    <TableCell><StatusBadge status={c.status || "active"} /></TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{c.pan || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.ay || "—"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                        onClick={() => setDeleteTarget({ id: c.id, name: c.name })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
            <span>Showing {filtered.length} of {clientsData.length} client{clientsData.length !== 1 ? "s" : ""}</span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">Previous</Button>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-xs">1</Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">Next</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
