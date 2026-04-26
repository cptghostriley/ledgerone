import { useMemo, useState } from "react";
import {
  Activity as ActivityIcon, Upload as UploadIcon, MessageSquare, AlertTriangle,
  FileCheck2, Sparkles, Filter, Download, Search,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { recentActivity, clients, jobs } from "@/lib/mock-data";
import { formatDistanceToNow } from "date-fns";

type FeedItem = {
  id: string;
  type: "recon" | "upload" | "comment" | "extract" | "flag" | "ai" | "job";
  text: string;
  timestamp: string;
  actor?: string;
  client?: string;
};

// Build a richer in-memory feed from existing mock data
const FEED: FeedItem[] = [
  ...recentActivity.map((a, i): FeedItem => ({
    id: a.id,
    type: a.type as FeedItem["type"],
    text: a.text,
    timestamp: new Date(Date.now() - 1000 * 60 * (12 + i * 27)).toISOString(),
    actor: ["Anjali Mehta", "Rohan Shah", "System", "Gemma 2"][i % 4],
    client: clients[i % clients.length]?.name,
  })),
  ...jobs.slice(0, 6).map((j, i): FeedItem => ({
    id: `job-${j.id}`,
    type: "job",
    text: `${j.type} · ${j.status} (${j.progress}%)`,
    timestamp: new Date(Date.now() - 1000 * 60 * (45 + i * 53)).toISOString(),
    actor: "Pipeline",
    client: clients[(i + 2) % clients.length]?.name,
  })),
  {
    id: "ai-1",
    type: "ai" as const,
    text: "AI insight generated: ITC mismatch flagged on Sharma Textiles (₹48,210)",
    timestamp: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
    actor: "Gemma 2",
    client: "Sharma Textiles Pvt Ltd",
  },
  {
    id: "ai-2",
    type: "ai" as const,
    text: "Reconciliation summary drafted for Greenleaf Organics",
    timestamp: new Date(Date.now() - 1000 * 60 * 88).toISOString(),
    actor: "Gemma 2",
    client: "Greenleaf Organics",
  },
].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));

const TYPE_META: Record<FeedItem["type"], { icon: typeof ActivityIcon; label: string; tone: string }> = {
  recon: { icon: FileCheck2, label: "Reconciliation", tone: "bg-success/15 text-success border-success/30" },
  upload: { icon: UploadIcon, label: "Upload", tone: "bg-info/15 text-info border-info/30" },
  comment: { icon: MessageSquare, label: "Comment", tone: "bg-aurora-3/15 text-aurora-3 border-aurora-3/30" },
  extract: { icon: Sparkles, label: "Extraction", tone: "bg-primary/15 text-primary border-primary/30" },
  flag: { icon: AlertTriangle, label: "Anomaly", tone: "bg-destructive/15 text-destructive border-destructive/30" },
  ai: { icon: Sparkles, label: "AI", tone: "bg-aurora-1/15 text-aurora-1 border-aurora-1/30" },
  job: { icon: ActivityIcon, label: "Job", tone: "bg-warning/15 text-warning border-warning/30" },
};

const FILTERS: { key: "all" | FeedItem["type"]; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ai", label: "AI" },
  { key: "upload", label: "Uploads" },
  { key: "recon", label: "Reconciliation" },
  { key: "flag", label: "Anomalies" },
  { key: "job", label: "Jobs" },
  { key: "comment", label: "Comments" },
];

export default function Activity() {
  const [filter, setFilter] = useState<"all" | FeedItem["type"]>("all");
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    return FEED.filter((it) => {
      if (filter !== "all" && it.type !== filter) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          it.text.toLowerCase().includes(q) ||
          it.actor?.toLowerCase().includes(q) ||
          it.client?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [filter, query]);

  // Group by day
  const groups = useMemo(() => {
    const map = new Map<string, FeedItem[]>();
    for (const it of items) {
      const d = new Date(it.timestamp);
      const key = d.toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  const stats = useMemo(() => ({
    total: FEED.length,
    today: FEED.filter((i) => new Date(i.timestamp).toDateString() === new Date().toDateString()).length,
    anomalies: FEED.filter((i) => i.type === "flag").length,
    ai: FEED.filter((i) => i.type === "ai").length,
  }), []);

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Activity stream"
        description="A live audit trail across uploads, AI insights, reconciliations and pipeline jobs."
      >
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" /> Filters
        </Button>
        <Button className="gap-2 bg-gradient-aurora text-white shadow-glow hover:opacity-95">
          <Download className="h-4 w-4" /> Export log
        </Button>
      </PageHeader>

      <div className="space-y-6 px-6 py-6 md:px-8">
        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Events (30d)", value: stats.total, tone: "text-primary" },
            { label: "Today", value: stats.today, tone: "text-info" },
            { label: "AI generated", value: stats.ai, tone: "text-aurora-1" },
            { label: "Open anomalies", value: stats.anomalies, tone: "text-destructive" },
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
                placeholder="Search activity, client, actor…"
                className="h-9 pl-8 text-sm"
              />
            </div>
          </div>
        </Card>

        {/* Timeline */}
        <Card className="border-border/70 bg-card p-6 shadow-elegant">
          {groups.length === 0 ? (
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
                      const meta = TYPE_META[it.type];
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
                                  {it.actor && <span>by <span className="text-foreground/80">{it.actor}</span></span>}
                                  {it.client && <span>· {it.client}</span>}
                                  <span>· {formatDistanceToNow(new Date(it.timestamp), { addSuffix: true })}</span>
                                </div>
                              </div>
                              <Badge variant="outline" className="shrink-0 rounded-full text-[10px] uppercase tracking-wider">
                                {meta.label}
                              </Badge>
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
    </div>
  );
}
