import { Link } from "react-router-dom";
import {
  Users, FileStack, AlertTriangle, CalendarClock, ArrowUpRight,
  TrendingUp, Upload as UploadIcon, Sparkles, Activity, FileCheck2, Zap, ChevronRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { format, differenceInDays } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

const ICON_MAP: Record<string, any> = {
  AlertTriangle,
  Zap,
  TrendingUp,
  Sparkles,
};

export default function Dashboard() {
  const [insight, setInsight] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/v1/dashboard/stats", {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json().then(d => d.data);
    }
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/insights/scan", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
      });
      if (!res.ok) throw new Error("Failed to scan");
      return res.json();
    },
    onSuccess: (data) => {
      setInsight(data.insight);
      localStorage.setItem("last_insight", data.insight);
    }
  });

  useEffect(() => {
    const saved = localStorage.getItem("last_insight");
    if (saved) {
      setInsight(saved);
    } else {
      scanMutation.mutate();
    }
  }, []);

  const STAT_DEFS = [
    { key: "clients", label: "Active clients", value: data?.clients ?? 0, delta: "Total active", icon: Users, tone: "primary" },
    { key: "docs", label: "Documents processed", value: data?.docs ?? 0, delta: "Lifetime processed", icon: FileStack, tone: "info" },
    { key: "flagged", label: "Flagged clients", value: data?.flagged ?? 0, delta: "Needs review", icon: AlertTriangle, tone: "destructive" },
    { key: "deadlines", label: "Upcoming deadlines (30d)", value: data?.deadlines ?? 0, delta: "Within next 30 days", icon: CalendarClock, tone: "warning" },
  ] as const;

  const upcoming = data?.upcomingDeadlines ?? [];
  const activeJobs = data?.activeJobs ?? [];
  const recentAct = data?.recentActivity ?? [];
  const aiInsights = data?.aiInsights ?? [];
  const chartData = data?.chartData ?? [];

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Command center"
        description="Mehta & Co. · FY 2025-26 · everything across your practice in one secure workspace."
      >
        <Button asChild variant="outline" className="gap-2">
          <Link to="/jobs">
            <Activity className="h-4 w-4" /> View jobs
          </Link>
        </Button>
        <Button asChild className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
          <Link to="/clients/c-001/upload">
            <UploadIcon className="h-4 w-4" /> Upload documents
          </Link>
        </Button>
      </PageHeader>

      <div className="space-y-6 px-6 py-6 md:px-8">
        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STAT_DEFS.map((s) => (
            <Card key={s.key} className="group relative overflow-hidden border-border/70 bg-gradient-surface p-5 shadow-elegant transition-all hover:shadow-elevated hover:-translate-y-0.5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </p>
                  <p className="font-display text-3xl font-bold tracking-tight num-tabular">
                    {s.value}
                  </p>
                </div>
                <div className={`grid h-10 w-10 place-items-center rounded-lg ${
                  s.tone === "primary" ? "bg-primary/12 text-primary" :
                  s.tone === "info" ? "bg-info/12 text-info" :
                  s.tone === "destructive" ? "bg-destructive/12 text-destructive" :
                  "bg-warning/12 text-warning"
                }`}>
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">{s.delta}</p>
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Chart */}
          <Card className="lg:col-span-2 overflow-hidden border-border/70 bg-card p-5 shadow-elegant">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="font-display text-base font-bold">Document processing</h2>
                <p className="text-xs text-muted-foreground">Last 6 months · volume across all clients</p>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-medium">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--info))]" /> Processed</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--aurora-3))]" /> Review</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--destructive))]" /> Failed</span>
              </div>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <defs>
                    <linearGradient id="colorProcessed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--info))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--info))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorReview" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--aurora-3))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--aurora-3))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" vertical={false} />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover) / 0.85)",
                      backdropFilter: "blur(14px)",
                      border: "1px solid hsl(var(--border) / 0.6)",
                      borderRadius: 12,
                      fontSize: 12,
                      boxShadow: "var(--shadow-lg)",
                    }}
                  />
                  <Area type="monotone" dataKey="processed" stroke="hsl(var(--info))" strokeWidth={3} fillOpacity={1} fill="url(#colorProcessed)" />
                  <Area type="monotone" dataKey="review" stroke="hsl(var(--aurora-3))" strokeWidth={3} fillOpacity={1} fill="url(#colorReview)" />
                  <Area type="monotone" dataKey="failed" stroke="hsl(var(--destructive))" strokeWidth={2} fillOpacity={0.1} fill="hsl(var(--destructive))" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* AI insights */}
          <Card className="relative overflow-hidden border-border/70 bg-card p-5 shadow-elegant flex flex-col">
            <div className="pointer-events-none absolute inset-0 bg-gradient-glow opacity-50" />
            <div className="relative flex-1 flex flex-col">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-primary">
                    <Sparkles className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <h2 className="font-display text-base font-bold">AI insights</h2>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-7 text-xs px-2 gap-1"
                  onClick={() => scanMutation.mutate()}
                  disabled={scanMutation.isPending}
                >
                  <Sparkles className="h-3 w-3" />
                  {scanMutation.isPending ? "Scanning..." : "Re-scan"}
                </Button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Gemma 4:e2b analysis of your active clients
              </p>

              <div className="mt-4 flex-1 rounded-lg border border-border/60 bg-background/40 p-4 text-sm leading-relaxed overflow-y-auto custom-scrollbar">
                {insight ? (
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown>{insight}</ReactMarkdown>
                  </div>
                ) : scanMutation.isPending ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 animate-pulse" /> Scanning clients...
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Upcoming deadlines */}
          <Card className="lg:col-span-2 border-border/70 bg-card shadow-elegant">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
              <div>
                <h2 className="font-display text-base font-bold">Upcoming deadlines</h2>
                <p className="text-xs text-muted-foreground">Sorted by due date</p>
              </div>
              <Button variant="ghost" size="sm" className="text-xs">
                View all <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
            <div className="divide-y divide-border/60">
              {upcoming.length === 0 && (
                <div className="px-5 py-6 text-center text-sm text-muted-foreground">No upcoming deadlines.</div>
              )}
              {upcoming.map((d: any) => {
                const days = differenceInDays(new Date(d.dueDate), new Date());
                const danger = days < 7;
                const warn = days < 30 && days >= 7;
                return (
                  <Link key={d.id} to={`/clients/${d.clientId}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/40">
                    <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border ${
                      danger ? "border-destructive/30 bg-destructive/8 text-destructive" :
                      warn ? "border-warning/30 bg-warning/8 text-warning" :
                      "border-border bg-muted/40 text-muted-foreground"
                    }`}>
                      <span className="text-[10px] font-semibold uppercase">{format(new Date(d.dueDate), "MMM")}</span>
                      <span className="font-display text-base font-bold leading-none num-tabular">{format(new Date(d.dueDate), "dd")}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{d.title}</p>
                        <span className="text-[11px] text-muted-foreground">·</span>
                        <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{d.type}</span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{d.clientName}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-semibold num-tabular ${danger ? "text-destructive" : warn ? "text-warning" : "text-muted-foreground"}`}>
                        {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `in ${days}d`}
                      </p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground/60" />
                  </Link>
                );
              })}
            </div>
          </Card>

          {/* Active jobs + activity */}
          <div className="space-y-4">
            <Card className="border-border/70 bg-card shadow-elegant">
              <div className="border-b border-border/60 px-5 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-bold">Active jobs</h2>
                  <span className="rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-bold text-info">
                    {activeJobs.length} running
                  </span>
                </div>
              </div>
              <div className="space-y-3 p-4">
                {activeJobs.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-2">No active jobs.</div>
                )}
                {activeJobs.map((j: any) => (
                  <div key={j.id} className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold leading-snug">{j.type}</p>
                      <StatusBadge status={j.status} />
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">{j.clientName}</p>
                    <div className="h-1.5 overflow-hidden rounded-full bg-border/60">
                      <div className="h-full rounded-full bg-gradient-primary transition-all" style={{ width: `${j.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-border/70 bg-card shadow-elegant">
              <div className="border-b border-border/60 px-5 py-4">
                <h2 className="font-display text-base font-bold">Recent activity</h2>
              </div>
              <div className="space-y-3 p-4">
                {recentAct.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-2">No recent activity.</div>
                )}
                {recentAct.map((a: any) => (
                  <div key={a.id} className="flex gap-3">
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                      <FileCheck2 className="h-3.5 w-3.5" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[12px] leading-snug">{a.text}</p>
                      <p className="text-[10px] text-muted-foreground">{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

