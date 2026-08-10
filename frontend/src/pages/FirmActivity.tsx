import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity as ActivityIcon, Upload as UploadIcon, AlertTriangle,
  FileCheck2, Sparkles, Download, Search, RefreshCw, Pencil, ShieldAlert
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type FeedItem = {
  id: string;
  type: "upload" | "ai" | "edit" | "retry" | "processing" | "alert" | "system";
  text: string;
  timestamp: string;
  actor?: string;
  client?: string;
};

const TYPE_META: Record<string, { icon: any; label: string; tone: string }> = {
  upload:     { icon: UploadIcon,    label: "Upload",         tone: "bg-info/15 text-info border-info/30" },
  ai:         { icon: Sparkles,      label: "AI Extraction",  tone: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  edit:       { icon: Pencil,        label: "Manual Edit",    tone: "bg-primary/15 text-primary border-primary/30" },
  retry:      { icon: RefreshCw,     label: "Retry",          tone: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  processing: { icon: ActivityIcon,  label: "Processing",     tone: "bg-warning/15 text-warning border-warning/30" },
  alert:      { icon: AlertTriangle, label: "Failed Job",     tone: "bg-destructive/15 text-destructive border-destructive/30" },
  system:     { icon: FileCheck2,    label: "System",         tone: "bg-success/15 text-success border-success/30" },
};

const EVENT_FILTERS: { key: "all" | string; label: string }[] = [
  { key: "all",        label: "All Events" },
  { key: "upload",     label: "Uploads" },
  { key: "ai",         label: "AI Extractions" },
  { key: "edit",       label: "Manual Edits" },
  { key: "retry",      label: "Retries" },
  { key: "processing", label: "Processing" },
  { key: "alert",      label: "Failed Jobs" },
];

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("access_token")}` });

export default function FirmActivity() {
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportRange, setExportRange] = useState("last_week");

  // Fetch current user info for authorization check
  const { data: meData, isLoading: isMeLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/v1/auth/me", { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load user info");
      return res.json().then(d => d.data);
    }
  });

  const { data: feed = [], isLoading: isFeedLoading } = useQuery<FeedItem[]>({
    queryKey: ["activity-firm"],
    queryFn: async () => {
      const res = await fetch("/api/v1/activity/firm", { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load firm activity");
      return res.json().then(d => d.data ?? []);
    },
    enabled: meData?.active_role === "Admin/Owner",
    refetchInterval: 10_000,
  });

  // Extract unique users/actors from the feed for the filters
  const uniqueUsers = useMemo(() => {
    const usersSet = new Set<string>();
    for (const item of feed) {
      if (item.actor) {
        usersSet.add(item.actor);
      }
    }
    return Array.from(usersSet).sort();
  }, [feed]);

  const items = useMemo(() => {
    return feed.filter((it) => {
      const eventMatch = eventFilter === "all" || it.type === eventFilter;
      if (!eventMatch) return false;

      const userMatch = userFilter === "all" || it.actor === userFilter;
      if (!userMatch) return false;

      if (query) {
        const q = query.toLowerCase();
        return (
          it.text?.toLowerCase().includes(q) ||
          it.actor?.toLowerCase().includes(q) ||
          it.client?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [eventFilter, userFilter, query, feed]);

  // Group by day
  const groups = useMemo(() => {
    const map = new Map<string, FeedItem[]>();
    for (const it of items) {
      if (!it.timestamp) continue;
      const key = new Date(it.timestamp).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  const stats = useMemo(() => ({
    total: feed.length,
    today: feed.filter((i) => i.timestamp && new Date(i.timestamp).toDateString() === new Date().toDateString()).length,
    failures: feed.filter((i) => i.type === "alert").length,
    ai: feed.filter((i) => i.type === "ai").length,
  }), [feed]);

  const handleExport = () => {
    const now = new Date();
    let minDate = new Date(0); // Epoch start
    if (exportRange === "today") {
      minDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (exportRange === "last_week") {
      minDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (exportRange === "last_month") {
      minDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    } else if (exportRange === "3_months") {
      minDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    } else if (exportRange === "6_months") {
      minDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    } else if (exportRange === "1_year") {
      minDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    }

    const filtered = feed.filter(it => it.timestamp && new Date(it.timestamp) >= minDate);

    // Build CSV content
    const headers = ["ID", "Event Type", "Event Description", "Timestamp", "Actor", "Client"];
    const rows = filtered.map(it => [
      it.id,
      it.type,
      it.text,
      it.timestamp,
      it.actor || "System",
      it.client || "—"
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `firm_activity_${exportRange}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportOpen(false);
  };

  // If loading user info
  if (isMeLoading) {
    return (
      <div className="grid h-[80vh] place-items-center">
        <div className="flex flex-col items-center gap-2">
          <ActivityIcon className="h-8 w-8 animate-pulse text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Checking permissions…</p>
        </div>
      </div>
    );
  }

  // If not admin, block view
  if (meData?.active_role !== "Admin/Owner") {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center text-center px-4">
        <ShieldAlert className="h-16 w-16 text-destructive animate-bounce" />
        <h3 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground">Access Denied</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          You do not have administrative privileges. Firm Activity dashboards are restricted to administrators only.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Firm Activity stream"
        description="A live audit trail across all firm uploads, AI insights, and pipeline jobs."
      >
        <Button onClick={() => setExportOpen(true)} className="gap-2 bg-gradient-aurora text-white shadow-glow hover:opacity-95">
          <Download className="h-4 w-4" /> Export log
        </Button>
      </PageHeader>

      <div className="space-y-6 px-6 py-6 md:px-8">
        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total events", value: stats.total, tone: "text-primary" },
            { label: "Today", value: stats.today, tone: "text-info" },
            { label: "AI generated", value: stats.ai, tone: "text-violet-400" },
            { label: "Failed jobs", value: stats.failures, tone: "text-destructive" },
          ].map((s) => (
            <Card key={s.label} className="border-border/70 bg-gradient-surface p-5 shadow-elegant">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className={`mt-1 font-display text-3xl font-bold tracking-tight num-tabular ${s.tone}`}>{s.value}</p>
            </Card>
          ))}
        </div>

        {/* Filters & search */}
        <Card className="border-border/70 bg-card/60 p-5 shadow-elegant backdrop-blur-xl space-y-4">
          {/* Event Filters */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Filter by Event Type</span>
            <div className="flex flex-wrap gap-1.5">
              {EVENT_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setEventFilter(f.key)}
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                    eventFilter === f.key
                      ? "border-transparent bg-gradient-aurora text-white shadow-glow"
                      : "border-border/70 bg-background/60 text-muted-foreground hover:text-foreground hover:border-border",
                  ].join(" ")}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* User Filters */}
          <div className="space-y-1.5 border-t border-border/40 pt-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Filter by Team Member</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setUserFilter("all")}
                className={[
                  "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                  userFilter === "all"
                    ? "border-transparent bg-gradient-aurora text-white shadow-glow"
                    : "border-border/70 bg-background/60 text-muted-foreground hover:text-foreground hover:border-border",
                ].join(" ")}
              >
                All Members
              </button>
              {uniqueUsers.map((u) => (
                <button
                  key={u}
                  onClick={() => setUserFilter(u)}
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                    userFilter === u
                      ? "border-transparent bg-gradient-aurora text-white shadow-glow"
                      : "border-border/70 bg-background/60 text-muted-foreground hover:text-foreground hover:border-border",
                  ].join(" ")}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar */}
          <div className="flex justify-end border-t border-border/40 pt-3">
            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search activity, client, actor…"
                className="h-9 pl-8 text-sm"
              />
            </div>
          </div>
        </Card>

        {/* Timeline */}
        <Card className="border-border/70 bg-card p-6 shadow-elegant">
          {isFeedLoading ? (
            <div className="grid place-items-center py-16 text-center">
              <ActivityIcon className="h-8 w-8 animate-pulse text-muted-foreground/60" />
              <p className="mt-3 text-sm text-muted-foreground">Loading activity…</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="grid place-items-center py-16 text-center">
              <ActivityIcon className="h-8 w-8 text-muted-foreground/60" />
              <p className="mt-3 text-sm text-muted-foreground">No events match your filters.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {groups.map(([day, list]) => (
                <div key={day}>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {new Date(day).toDateString() === new Date().toDateString()
                        ? "Today"
                        : new Date(day).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-border/80 to-transparent" />
                    <Badge variant="secondary" className="rounded-full text-[10px]">{list.length} events</Badge>
                  </div>

                  <ol className="relative space-y-3 border-l border-border/60 pl-6">
                    {list.map((it) => {
                      const meta = TYPE_META[it.type] ?? TYPE_META["system"];
                      const Icon = meta.icon;
                      return (
                        <li key={it.id} className="relative">
                          <span className={`absolute -left-[34px] top-1.5 grid h-7 w-7 place-items-center rounded-full border ${meta.tone} backdrop-blur`}>
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <div className="rounded-xl border border-border/60 bg-background/50 p-4 backdrop-blur-sm transition-colors hover:border-border hover:bg-background/70">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 space-y-1">
                                <p className="text-sm font-medium leading-snug">{it.text}</p>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                  {it.client && <span>{it.client}</span>}
                                  {it.timestamp && <span>{formatDistanceToNow(new Date(it.timestamp), { addSuffix: true })}</span>}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <Badge variant="outline" className="rounded-full text-[10px] uppercase tracking-wider">
                                  {meta.label}
                                </Badge>
                                <Badge variant="secondary" className="rounded-full text-[10px] bg-primary/10 text-primary border-primary/20 max-w-[200px] truncate">
                                  {it.actor || "System"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Export Dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-md border-border bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Export Firm Activity Log</DialogTitle>
            <DialogDescription>
              Select the timeframe for the firm activity logs you wish to export as a CSV file.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Timeframe</label>
            <select
              value={exportRange}
              onChange={(e) => setExportRange(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="today">Today</option>
              <option value="last_week">Last Week</option>
              <option value="last_month">Last Month</option>
              <option value="3_months">Last 3 Months</option>
              <option value="6_months">Last 6 Months</option>
              <option value="1_year">Last 1 Year</option>
              <option value="all_time">All Time</option>
            </select>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setExportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport} className="bg-gradient-aurora text-white shadow-glow hover:opacity-95">
              Get .CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
