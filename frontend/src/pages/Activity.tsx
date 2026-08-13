import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Activity as ActivityIcon, Upload as UploadIcon, AlertTriangle,
  FileCheck2, Sparkles, Download, Search, RefreshCw, Pencil, Workflow,
  CheckCircle2, AlertCircle, Clock, FileStack, Pause, X
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
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

const FILTERS: { key: "all" | string; label: string }[] = [
  { key: "all",        label: "All Events" },
  { key: "upload",     label: "Uploads" },
  { key: "ai",         label: "AI Extractions" },
  { key: "edit",       label: "Manual Edits" },
  { key: "retry",      label: "Retries" },
  { key: "processing", label: "Processing" },
  { key: "alert",      label: "Failed Jobs" },
];

const JOB_FILTERS = ["All", "Active", "Completed", "Failed"] as const;

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("access_token")}` });

export default function Activity() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "jobs" ? "jobs" : "stream";
  const [activeTab, setActiveTab] = useState<"stream" | "jobs">(initialTab);

  const qc = useQueryClient();
  const navigate = useNavigate();

  // Activity Stream State
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportRange, setExportRange] = useState("last_week");

  // Jobs State
  const [jobFilter, setJobFilter] = useState<typeof JOB_FILTERS[number]>("All");

  const { data: feed = [], isLoading: isLoadingFeed } = useQuery<FeedItem[]>({
    queryKey: ["activity-me"],
    queryFn: async () => {
      const res = await fetch("/api/v1/activity/me", { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load activity");
      return res.json().then(d => d.data ?? []);
    },
    refetchInterval: 10_000,
  });

  const { data: serverJobs = [], refetch: refetchJobs } = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const res = await fetch("/api/v1/jobs", { headers: authHeader() });
      if (!res.ok) throw new Error("Failed");
      return res.json().then(d => d.data ?? []);
    },
    refetchInterval: 3000,
  });

  const deleteJob = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`/api/v1/jobs/${jobId}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      if (!res.ok) throw new Error("Failed to delete job");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Job deleted");
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = useMemo(() => {
    return feed.filter((it) => {
      const typeMatch = filter === "all" || it.type === filter;
      if (!typeMatch) return false;
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
  }, [filter, query, feed]);

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

  const filteredJobs = useMemo(() => {
    return serverJobs.filter((j: any) => {
      if (jobFilter === "All") return true;
      if (jobFilter === "Active") return j.status === "processing" || j.status === "queued";
      if (jobFilter === "Completed") return j.status === "completed";
      return j.status === "failed";
    });
  }, [serverJobs, jobFilter]);

  const jobStats = useMemo(() => ({
    active: serverJobs.filter((j: any) => j.status === "processing" || j.status === "queued").length,
    completed: serverJobs.filter((j: any) => j.status === "completed").length,
    failed: serverJobs.filter((j: any) => j.status === "failed").length,
    today: serverJobs.length,
  }), [serverJobs]);

  const handleExport = () => {
    const now = new Date();
    let minDate = new Date(0);
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

    const headers = ["ID", "Event Type", "Event Description", "Timestamp", "Actor", "Client"];
    const rows = filtered.map(it => [
      it.id,
      it.type,
      it.text,
      it.timestamp,
      it.actor || "You",
      it.client || "—"
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `personal_activity_${exportRange}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportOpen(false);
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Activity & Active Jobs"
        description="A live view of system processing jobs and your personal activity stream."
      >
        <div className="flex items-center gap-2">
          {activeTab === "jobs" && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => refetchJobs()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh Jobs
            </Button>
          )}
          {activeTab === "stream" && (
            <Button onClick={() => setExportOpen(true)} className="gap-2 bg-gradient-aurora text-white shadow-glow hover:opacity-95">
              <Download className="h-4 w-4" /> Export log
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="px-6 pt-4 md:px-8">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <button
            onClick={() => setActiveTab("stream")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === "stream"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <ActivityIcon className="h-4 w-4" /> Activity Stream
          </button>

          <button
            onClick={() => setActiveTab("jobs")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === "jobs"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Workflow className="h-4 w-4" /> Active System Jobs
            {jobStats.active > 0 && (
              <Badge className="ml-1 rounded-full bg-info text-white text-[10px] px-1.5 py-0.2">
                {jobStats.active}
              </Badge>
            )}
          </button>
        </div>
      </div>

      <div className="space-y-6 px-6 py-6 md:px-8">
        {activeTab === "stream" ? (
          <>
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
            <Card className="border-border/70 bg-card/60 p-4 shadow-elegant backdrop-blur-xl">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-1.5">
                  {FILTERS.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      className={[
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                        filter === f.key
                          ? "border-transparent bg-gradient-aurora text-white shadow-glow"
                          : "border-border/70 bg-background/60 text-muted-foreground hover:text-foreground hover:border-border",
                      ].join(" ")}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="relative w-full lg:w-72">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search activity, client…"
                    className="h-9 pl-8 text-sm"
                  />
                </div>
              </div>
            </Card>

            {/* Timeline */}
            <Card className="border-border/70 bg-card p-6 shadow-elegant">
              {isLoadingFeed ? (
                <div className="grid place-items-center py-16 text-center">
                  <ActivityIcon className="h-8 w-8 animate-pulse text-muted-foreground/60" />
                  <p className="mt-3 text-sm text-muted-foreground">Loading activity…</p>
                </div>
              ) : groups.length === 0 ? (
                <div className="grid place-items-center py-16 text-center">
                  <ActivityIcon className="h-8 w-8 text-muted-foreground/60" />
                  <p className="mt-3 text-sm text-muted-foreground">No events match your filter.</p>
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
                                    <Badge variant="secondary" className="rounded-full text-[10px] bg-primary/10 text-primary border-primary/20 max-w-[120px] truncate">
                                      {it.actor || "You"}
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
          </>
        ) : (
          /* Active System Jobs View */
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Active Jobs", value: jobStats.active, icon: Workflow, tone: "info" },
                { label: "Completed Today", value: jobStats.completed, icon: CheckCircle2, tone: "success" },
                { label: "Failed Jobs", value: jobStats.failed, icon: AlertCircle, tone: "destructive" },
                { label: "Total Tracked", value: jobStats.today, icon: FileStack, tone: "muted" },
              ].map((s) => (
                <Card key={s.label} className="border-border/70 bg-card p-4 shadow-elegant">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                    <s.icon className={`h-4 w-4 ${
                      s.tone === "info" ? "text-info" :
                      s.tone === "success" ? "text-success" :
                      s.tone === "destructive" ? "text-destructive" :
                      "text-muted-foreground"
                    }`} />
                  </div>
                  <p className="mt-1 font-display text-2xl font-bold num-tabular">{s.value}</p>
                </Card>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              {JOB_FILTERS.map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={jobFilter === f ? "default" : "ghost"}
                  onClick={() => setJobFilter(f)}
                  className={jobFilter === f
                    ? "h-8 rounded-full bg-primary px-4 text-xs text-primary-foreground hover:bg-primary/90"
                    : "h-8 rounded-full px-4 text-xs text-muted-foreground hover:text-foreground"}
                >
                  {f}
                </Button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredJobs.map((j: any) => {
                const active = j.status === "processing";
                return (
                  <Card key={j.id} className={`relative overflow-hidden border-border/70 bg-card p-5 shadow-elegant ${active ? "ring-1 ring-info/30" : ""} ${(j.status === "completed" && j.document_id) ? "cursor-pointer hover:bg-muted/40 transition-colors" : ""}`} onClick={() => {
                    if (j.status === "completed" && j.document_id) navigate(`/documents/${j.document_id}`);
                  }}>
                    {active && (
                      <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden">
                        <div className="h-full w-1/3 animate-[shimmer_2s_linear_infinite] bg-gradient-to-r from-transparent via-info to-transparent" style={{ backgroundSize: "200% 100%" }} />
                      </div>
                    )}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`grid h-10 w-10 place-items-center rounded-lg ${
                          j.status === "completed" ? "bg-success/12 text-success" :
                          j.status === "failed" ? "bg-destructive/12 text-destructive" :
                          j.status === "processing" ? "bg-info/12 text-info" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {j.status === "completed" ? <CheckCircle2 className="h-5 w-5" /> :
                           j.status === "failed" ? <AlertCircle className="h-5 w-5" /> :
                           j.status === "processing" ? <Workflow className="h-5 w-5 animate-pulse" /> :
                           <Clock className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-sm font-bold">{j.type}</h3>
                            <StatusBadge status={j.status} />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{j.clientName} · started {j.created_at ? formatDistanceToNow(new Date(j.created_at), { addSuffix: true }) : 'just now'}</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {active && <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => toast.info("Job paused")}><Pause className="h-3 w-3" /> Pause</Button>}
                        {j.status === "failed" && <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => toast.info("Retrying job...")}><RefreshCw className="h-3 w-3" /> Retry</Button>}
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteJob.mutate(j.id)} disabled={deleteJob.isPending}><X className="h-4 w-4" /></Button>
                      </div>
                    </div>

                    {(j.status === "processing" || j.status === "queued") && (
                      <div className="mt-4">
                        <div className="mb-1 flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">{j.status === "queued" ? "In queue" : `Processing — ${Math.round(j.progress)}%`}</span>
                          <span className="text-muted-foreground num-tabular">ETA {Math.max(1, Math.round((100 - j.progress) / 12))}m</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-border/60">
                          <div
                            className={`h-full rounded-full transition-all ${j.status === "processing" ? "bg-gradient-primary" : "bg-muted-foreground/30"}`}
                            style={{ width: `${j.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {j.status === "completed" && j.durationMs && (
                      <p className="mt-3 text-[11px] text-muted-foreground">
                        Completed in {Math.round(j.durationMs / 1000)}s
                        {j.startedAt && !isNaN(new Date(j.startedAt).getTime()) && ` · finished ${format(new Date(+new Date(j.startedAt) + j.durationMs), "HH:mm")}`}
                      </p>
                    )}
                  </Card>
                );
              })}

              {filteredJobs.length === 0 && (
                <Card className="border-dashed border-border bg-card p-10 text-center">
                  <p className="text-sm text-muted-foreground">No active system jobs match this filter.</p>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Export Dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-md border-border bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Export Activity Log</DialogTitle>
            <DialogDescription>
              Select the timeframe for the activity logs you wish to export as a CSV file.
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
