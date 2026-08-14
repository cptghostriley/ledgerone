import { Link, useNavigate } from "react-router-dom";
import {
  Users, FileStack, AlertTriangle, CalendarClock, ArrowUpRight,
  TrendingUp, Upload as UploadIcon, Activity, FileCheck2, Zap, ChevronRight,
  Info, ShieldAlert, CheckCircle2, FileSearch, Layers, RefreshCw
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { format, differenceInDays } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface InsightCube {
  id: string;
  category: string;
  icon: any;
  tone: string;
  title: string;
  preview: string;
  fullDetail: string;
  targetUrl?: string;
}

const DEFAULT_CUBES: InsightCube[] = [
  {
    id: "tax-compliance",
    category: "GST & Tax Compliance",
    icon: ShieldAlert,
    tone: "from-purple-500/20 via-violet-500/10 to-transparent border-violet-500/30 text-violet-400",
    title: "GSTR-3B vs 2B Mismatch Scanner",
    preview: "Active tax reconciliation engine cross-examines filed GSTR-3B against auto-populated GSTR-2B statements.",
    fullDetail: "Gemma4 AI engine continuously compares filed Input Tax Credit (ITC) against portal GSTR-2B downloads. Discrepancies exceeding firm tolerance threshold trigger immediate audit notices prior to annual return filing.",
    targetUrl: "/clients"
  },
  {
    id: "bank-recon",
    category: "Banking & Audit",
    icon: CheckCircle2,
    tone: "from-emerald-500/20 via-teal-500/10 to-transparent border-emerald-500/30 text-emerald-400",
    title: "High Confidence Bank Statement Parser",
    preview: "Automated extraction and multi-tier fuzzy matching for HDFC, ICICI, SBI, and Axis PDF statements.",
    fullDetail: "Automated OCR & document extraction pipeline processes bank statements with high confidence. Matches bank debit/credit lines directly against client general ledger entries.",
    targetUrl: "/activity?tab=jobs"
  },
  {
    id: "risk-anomalies",
    category: "Risk Analysis",
    icon: AlertTriangle,
    tone: "from-amber-500/20 via-orange-500/10 to-transparent border-amber-500/30 text-amber-400",
    title: "Duplicate & Math Error Detector",
    preview: "Automated rule engine checks vendor invoice line items for duplicate payments and tax math errors.",
    fullDetail: "Rule engine and Gemma4 model scan all extracted document line items to prevent double payments, illegal tax credit claims, or arithmetic discrepancies.",
    targetUrl: "/extraction"
  },
  {
    id: "filing-status",
    category: "Direct Tax & TDS",
    icon: FileSearch,
    tone: "from-cyan-500/20 via-blue-500/10 to-transparent border-cyan-500/30 text-cyan-400",
    title: "Form 16 & 26AS TDS Verification",
    preview: "TDS certificates compiled and cross-verified against TRACES 26AS records for annual return filing.",
    fullDetail: "Salary and non-salary TDS certificates are reconciled against TRACES Form 26AS figures. All tax credits are verified for smooth ITR-3, ITR-5, and ITR-6 filings.",
    targetUrl: "/clients"
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [insight, setInsight] = useState<string | null>(null);
  const [hoveredCube, setHoveredCube] = useState<InsightCube | null>(null);

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

  const ICON_MAP: Record<string, any> = {
    ShieldAlert,
    CheckCircle2,
    AlertTriangle,
    FileSearch,
    Layers,
    Info
  };

  const totalDocs = (data?.statusBreakdown?.processed || 0) + (data?.statusBreakdown?.review || 0) + (data?.statusBreakdown?.pending || 0) + (data?.statusBreakdown?.failed || 0);

  // Translucent glassmorphed palette: Emerald Teal, Warm Orange, Amethyst Violet, Bright Soft Yellow (no red)
  const pieData = totalDocs > 0 ? [
    { name: "Processed (Verified)", value: data?.statusBreakdown?.processed || 0, color: "rgba(16, 185, 129, 0.80)" },
    { name: "Under Review", value: data?.statusBreakdown?.review || 0, color: "rgba(249, 115, 22, 0.80)" },
    { name: "Pending Extraction", value: data?.statusBreakdown?.pending || 0, color: "rgba(139, 92, 246, 0.80)" },
    { name: "Failed / Flagged", value: data?.statusBreakdown?.failed || 0, color: "rgba(234, 179, 8, 0.85)" },
  ] : [
    { name: "No documents uploaded", value: 1, color: "hsl(var(--muted-foreground) / 0.25)" }
  ];

  const cubesToDisplay: InsightCube[] = (data?.aiCubes ?? DEFAULT_CUBES).map((c: any) => ({
    ...c,
    icon: typeof c.icon === "string" ? (ICON_MAP[c.icon] || Layers) : c.icon
  }));

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Command center"
        description="Mehta & Co. · FY 2025-26 · everything across your practice in one secure workspace."
      >
        <Button asChild variant="outline" className="gap-2">
          <Link to="/activity?tab=jobs">
            <Activity className="h-4 w-4" /> View active jobs
          </Link>
        </Button>
        <Button asChild className="gap-2 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90">
          <Link to="/extraction">
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
          {/* Pie Chart Section - Perfectly Centered Donut with Overlay & 2x2 Grid Legend */}
          <Card className="lg:col-span-1 overflow-hidden border-border/70 bg-card p-5 shadow-elegant flex flex-col justify-between items-center text-center">
            <div className="w-full text-left">
              <h2 className="font-display text-base font-bold">Document Status Breakdown</h2>
              <p className="text-xs text-muted-foreground">Distribution of document extraction statuses</p>
            </div>

            {/* Donut Chart Container */}
            <div className="h-[210px] w-full mt-1 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={82}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
                      if (!value || totalDocs === 0) return null;
                      const RADIAN = Math.PI / 180;
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return (
                        <text x={x} y={y} fill="#ffffff" textAnchor="middle" dominantBaseline="central" className="text-[11px] font-extrabold drop-shadow-md">
                          {value}
                        </text>
                      );
                    }}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover) / 0.95)",
                      backdropFilter: "blur(14px)",
                      border: "1px solid hsl(var(--border) / 0.6)",
                      borderRadius: 12,
                      fontSize: 12,
                      boxShadow: "var(--shadow-lg)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Perfectly Centered Donut Hole Total Counter */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold font-display tracking-tight text-foreground leading-none">
                  {totalDocs}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
                  Total Docs
                </span>
              </div>
            </div>

            {/* Balanced 2x2 Grid Legend matching Cube colors */}
            <div className="grid grid-cols-2 gap-2 text-left w-full mt-2 pt-3 border-t border-border/40">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.color }} />
                  <span className="truncate text-muted-foreground">{item.name}:</span>
                  <strong className="font-mono text-foreground font-bold ml-auto">{totalDocs > 0 ? item.value : 0}</strong>
                </div>
              ))}
            </div>
          </Card>

          {/* AI Insights - Professional Interactive Cubes */}
          <Card className="lg:col-span-2 relative overflow-hidden border-border/70 bg-card p-5 shadow-elegant flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Layers className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold">AI Intelligence Cubes</h2>
                  <p className="text-[11px] text-muted-foreground">Categorized practice insights powered by Gemma4</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs px-3 gap-1.5 font-medium"
                onClick={() => scanMutation.mutate()}
                disabled={scanMutation.isPending}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${scanMutation.isPending ? "animate-spin text-primary" : ""}`} />
                {scanMutation.isPending ? "Scanning..." : "Re-scan"}
              </Button>
            </div>

            {/* Grid of Interactive Insight Cubes */}
            <div className="grid gap-3.5 sm:grid-cols-2 flex-1">
              {cubesToDisplay.map((cube) => {
                const Icon = cube.icon;
                const targetUrl = cube.targetUrl || "/extraction";
                return (
                  <div
                    key={cube.id}
                    onClick={() => navigate(targetUrl)}
                    onMouseEnter={() => setHoveredCube(cube)}
                    onMouseLeave={() => setHoveredCube(null)}
                    className={`group relative flex flex-col justify-between min-h-[155px] overflow-hidden rounded-xl border bg-gradient-to-br p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow cursor-pointer ${cube.tone}`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
                          {cube.category}
                        </span>
                        <Icon className="h-4 w-4 opacity-85" />
                      </div>
                      <h3 className="text-xs font-bold text-foreground leading-snug">{cube.title}</h3>
                      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                        {cube.preview}
                      </p>
                    </div>

                    {/* Non-hovered Default Footer Bar */}
                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/30 text-[10px] font-semibold text-primary/90 opacity-90">
                      <span>Hover for full details</span>
                      <span className="group-hover:translate-x-0.5 transition-transform">Read more →</span>
                    </div>

                    {/* Floating Hover Popover — Perfectly FITTED Inside Container */}
                    {hoveredCube?.id === cube.id && (
                      <div
                        onClick={(e) => { e.stopPropagation(); navigate(targetUrl); }}
                        className="absolute inset-0 z-30 flex flex-col justify-between rounded-xl border border-primary/50 bg-popover/98 p-3.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 cursor-pointer overflow-hidden"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                              {cube.category}
                            </span>
                            <Badge variant="outline" className="text-[9px] h-4 border-primary/30 bg-primary/10 text-primary font-semibold">Gemma4 Verified</Badge>
                          </div>
                          <h4 className="text-xs font-bold text-foreground leading-tight line-clamp-1">{cube.title}</h4>
                          <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-3">
                            {cube.fullDetail}
                          </p>
                        </div>
                        <div className="flex items-center justify-between border-t border-border/40 pt-1.5 text-[11px] font-bold text-primary mt-auto">
                          <span>Open workspace</span>
                          <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
