import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Workflow, RefreshCw, Pause, X, CheckCircle2, AlertCircle, Clock, FileStack } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { jobs } from "@/lib/mock-data";
import { formatDistanceToNow, format } from "date-fns";

const FILTERS = ["All", "Active", "Completed", "Failed"] as const;

export default function Jobs() {
  const [filter, setFilter] = useState<typeof FILTERS[number]>("All");

  const { data: serverJobs, refetch } = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const res = await fetch("/api/v1/jobs", {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
      });
      if (!res.ok) throw new Error("Failed");
      return res.json().then(d => d.data);
    },
    refetchInterval: 3000
  });

  const jobsData = serverJobs?.length ? serverJobs : jobs;

  const filtered = jobsData.filter((j: any) => {
    if (filter === "All") return true;
    if (filter === "Active") return j.status === "processing" || j.status === "queued";
    if (filter === "Completed") return j.status === "completed";
    return j.status === "failed";
  });

  const stats = {
    active: jobsData.filter((j: any) => j.status === "processing" || j.status === "queued").length,
    completed: jobsData.filter((j: any) => j.status === "completed").length,
    failed: jobsData.filter((j: any) => j.status === "failed").length,
    today: jobsData.length,
  };

  return (
    <div className="flex flex-col">
      <PageHeader title="Processing jobs" description="Real-time queue · polling every 3 seconds for active jobs.">
        <Button variant="outline" className="gap-2"><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </PageHeader>

      <div className="space-y-5 px-6 py-6 md:px-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Active", value: stats.active, icon: Workflow, tone: "info" },
            { label: "Completed today", value: stats.completed, icon: CheckCircle2, tone: "success" },
            { label: "Failed", value: stats.failed, icon: AlertCircle, tone: "destructive" },
            { label: "Total today", value: stats.today, icon: FileStack, tone: "muted" },
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
          {FILTERS.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "ghost"}
              onClick={() => setFilter(f)}
              className={filter === f
                ? "h-8 rounded-full bg-primary px-4 text-xs text-primary-foreground hover:bg-primary/90"
                : "h-8 rounded-full px-4 text-xs text-muted-foreground hover:text-foreground"}
            >
              {f}
            </Button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.map((j) => {
            const active = j.status === "processing";
            return (
              <Card key={j.id} className={`relative overflow-hidden border-border/70 bg-card p-5 shadow-elegant ${active ? "ring-1 ring-info/30" : ""}`}>
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
                        <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                          {j.filesCount} {j.filesCount === 1 ? "file" : "files"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{j.clientName} · started {j.startedAt ? formatDistanceToNow(new Date(j.startedAt), { addSuffix: true }) : 'just now'}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {active && <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs"><Pause className="h-3 w-3" /> Pause</Button>}
                    {j.status === "failed" && <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs"><RefreshCw className="h-3 w-3" /> Retry</Button>}
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></Button>
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
                    Completed in {Math.round(j.durationMs / 1000)}s · finished {format(new Date(+new Date(j.startedAt) + j.durationMs), "HH:mm")}
                  </p>
                )}
              </Card>
            );
          })}

          {filtered.length === 0 && (
            <Card className="border-dashed border-border bg-card p-10 text-center">
              <p className="text-sm text-muted-foreground">No jobs match this filter.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
