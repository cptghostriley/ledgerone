import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Search, Plus, Filter, ArrowUpDown, MapPin } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { clients } from "@/lib/mock-data";
import type { FilingType } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

const FILTERS: (FilingType | "All")[] = ["All", "ITR", "GST", "TDS", "ROC", "Audit"];

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase();
}

export default function Clients() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<typeof FILTERS[number]>("All");

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

  const clientsData = serverClients?.length ? serverClients : clients;

  const filtered = useMemo(() => {
    return clientsData.filter((c: any) => {
      const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || (c.pan && c.pan.toLowerCase().includes(search.toLowerCase()));
      const matchFilter = filter === "All" || (c.filings && c.filings.includes(filter));
      return matchSearch && matchFilter;
    });
  }, [search, filter, clientsData]);

  return (
    <div className="flex flex-col">
      <PageHeader title="Clients" description={`${clients.length} clients across ITR, GST, TDS, ROC and Audit filings.`}>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" /> Advanced filters
        </Button>
        <Button className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
          <Plus className="h-4 w-4" /> Add client
        </Button>
      </PageHeader>

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
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Filings</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Documents</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Flags</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Last activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const pct = Math.round((c.docsProcessed / Math.max(1, c.docsTotal)) * 100);
                  return (
                    <TableRow key={c.id} className="group cursor-pointer border-border/40 transition-colors hover:bg-muted/40" onClick={() => (window.location.href = `/clients/${c.id}`)}>
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
                                <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold">{c.type || 'Standard'}</span>
                                <span className="font-mono">{c.pan || 'N/A'}</span>
                                <span className="hidden items-center gap-0.5 lg:inline-flex">
                                  <MapPin className="h-2.5 w-2.5" /> {c.city}
                                </span>
                              </div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(c.filings || []).map((f: string) => (
                              <span key={f} className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-muted-foreground">
                                {f}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell><StatusBadge status={c.status} /></TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-baseline gap-1">
                              <span className="text-sm font-semibold num-tabular">{c.docsProcessed}</span>
                              <span className="text-[11px] text-muted-foreground">/ {c.docsTotal}</span>
                            </div>
                            <div className="h-1 w-24 overflow-hidden rounded-full bg-border/60">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {c.flags > 0 ? (
                            <span className="inline-flex h-6 items-center justify-center rounded-full bg-destructive/12 px-2.5 text-[11px] font-bold text-destructive num-tabular">
                              {c.flags}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.lastActivity ? formatDistanceToNow(new Date(c.lastActivity), { addSuffix: true }) : 'Just now'}
                        </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
            <span>Showing {filtered.length} of {clients.length} clients</span>
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
