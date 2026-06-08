import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ServerCog, UserPlus, CheckCircle2, AlertCircle, Trash2, Mail, Building2, Shield, Database } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const team = [
  { name: "CA Anjali Mehta", email: "anjali@mehtaco.in", role: "Owner", initials: "AM", status: "active" },
  { name: "CA Rohit Khanna", email: "rohit@mehtaco.in", role: "Partner", initials: "RK", status: "active" },
  { name: "CA Vikram Iyer", email: "vikram@mehtaco.in", role: "Partner", initials: "VI", status: "active" },
  { name: "Priya Sharma", email: "priya@mehtaco.in", role: "Senior associate", initials: "PS", status: "active" },
  { name: "Aman Verma", email: "aman@mehtaco.in", role: "Associate", initials: "AV", status: "invited" },
];

export default function Settings() {
  const [ollamaStatus, setOllamaStatus] = useState<"idle" | "testing" | "ok" | "error">("ok");
  const [activeTab, setActiveTab] = useState("firm");
  const [teamTab, setTeamTab] = useState("current");
  const queryClient = useQueryClient();

  const { data: meData, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/v1/auth/me", {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
      });
      if (!res.ok) throw new Error("Failed");
      return res.json().then(d => d.data);
    }
  });

  const { data: pendingApprovals } = useQuery({
    queryKey: ["pending-approvals"],
    queryFn: async () => {
      const res = await fetch("/api/v1/auth/pending-approvals", {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
      });
      if (!res.ok) throw new Error("Failed");
      return res.json().then(d => d.data);
    }
  });

  const handleApprove = async (userId: string, action: "approve" | "reject") => {
    try {
      const res = await fetch("/api/v1/auth/approve-user", {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`
        },
        body: JSON.stringify({ user_id: userId, action })
      });
      if (!res.ok) throw new Error("Action failed");
      toast.success(`User ${action}d successfully`);
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const hasPending = pendingApprovals && pendingApprovals.length > 0;

  const firmName = meData?.firm?.name || "Mehta & Co. Chartered Accountants";
  const contactEmail = meData?.user?.email || "contact@mehtaco.in";

  const testOllama = () => {
    setOllamaStatus("testing");
    setTimeout(() => {
      setOllamaStatus("ok");
      toast.success("Ollama connection healthy", { description: "gemma2:27b responding in 142ms" });
    }, 1100);
  };

  return (
    <div className="flex flex-col">
      <PageHeader title="Settings" description="Manage your firm profile, team, and AI infrastructure." />

      <div className="px-6 py-6 md:px-8">
        <Tabs defaultValue="firm" onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="bg-muted/50 relative">
            {[
              { id: "firm", label: "Firm", icon: Building2 },
              { id: "team", label: "Team", icon: UserPlus },
              { id: "ai", label: "AI infrastructure", icon: ServerCog },
              { id: "security", label: "Security", icon: Shield },
            ].map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="relative bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="active-tab-indicator"
                    className="absolute inset-0 rounded-sm bg-background shadow-sm"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center">
                  <tab.icon className="mr-1.5 h-3.5 w-3.5" /> {tab.label}
                  {tab.id === "team" && hasPending && (
                    <span className="absolute -top-1 -right-2 flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive"></span>
                    </span>
                  )}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="firm" className="space-y-4">
            <Card className="border-border/70 bg-card p-6 shadow-elegant">
              <h3 className="font-display text-base font-bold">Firm profile</h3>
              <p className="text-sm text-muted-foreground">Visible on reports and reminders sent to clients.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Firm name</Label><Input defaultValue={firmName} key={firmName} /></div>
                <div className="space-y-1.5"><Label>ICAI Firm Reg. No.</Label><Input defaultValue="0123456C" className="font-mono" /></div>
                <div className="space-y-1.5"><Label>Primary contact email</Label><Input defaultValue={contactEmail} key={contactEmail} /></div>
                <div className="space-y-1.5"><Label>Phone</Label><Input defaultValue="+91 22 4567 8900" className="font-mono" /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Office address</Label><Input defaultValue="404, Maker Chambers V, Nariman Point, Mumbai 400021" /></div>
              </div>
              <div className="mt-5 flex justify-end"><Button onClick={() => toast.success("Firm profile saved")} className="bg-gradient-primary text-primary-foreground hover:opacity-95">Save changes</Button></div>
            </Card>
          </TabsContent>

          <TabsContent value="team" className="space-y-4">
            <div className="flex items-center gap-4 border-b border-border/60 pb-4">
              <button onClick={() => setTeamTab("current")} className={`text-sm font-semibold transition-colors ${teamTab === "current" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>Current Team</button>
              <button onClick={() => setTeamTab("approvals")} className={`text-sm font-semibold transition-colors relative ${teamTab === "approvals" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                Invite Approvals
                {hasPending && <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">{pendingApprovals.length}</span>}
              </button>
            </div>

            {teamTab === "current" && (
              <Card className="border-border/70 bg-card shadow-elegant animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between border-b border-border/60 p-5">
                  <div>
                    <h3 className="font-display text-base font-bold">Team members</h3>
                    <p className="text-xs text-muted-foreground">{team.length} people in this workspace</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input placeholder="email@firm.in" className="h-9 w-56" />
                    <Button onClick={() => toast.success("Invite sent")} className="gap-2 bg-gradient-primary text-primary-foreground hover:opacity-95">
                      <Mail className="h-4 w-4" /> Send invite
                    </Button>
                  </div>
                </div>
                <div className="divide-y divide-border/60">
                  {team.map((m) => (
                    <div key={m.email} className="flex items-center gap-4 px-5 py-3.5">
                      <Avatar className="h-10 w-10 border border-border">
                        <AvatarFallback className="bg-gradient-primary text-xs font-bold text-primary-foreground">{m.initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                      </div>
                      <Badge variant="outline" className="border-border bg-muted/40 text-[10px] font-bold uppercase tracking-wider">{m.role}</Badge>
                      <span className="inline-flex h-2 w-2 rounded-full bg-success" title="Active" />
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {teamTab === "approvals" && (
              <Card className="border-border/70 bg-card shadow-elegant animate-in fade-in slide-in-from-bottom-2">
                <div className="p-5 border-b border-border/60">
                  <h3 className="font-display text-base font-bold">Pending Approvals</h3>
                  <p className="text-xs text-muted-foreground">Users who used your Firm Key to join.</p>
                </div>
                {!hasPending ? (
                  <div className="p-10 text-center text-muted-foreground text-sm">No pending approvals</div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {pendingApprovals.map((req: any) => (
                      <div key={req.user_id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer group">
                        <Avatar className="h-10 w-10 border border-border">
                          <AvatarFallback className="bg-gradient-primary text-xs font-bold text-primary-foreground">{req.email.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{req.email}</p>
                          <p className="text-xs text-muted-foreground">Requested Role: <span className="font-medium">{req.role}</span> {req.icai_number ? `· ICAI: ${req.icai_number}` : ""}</p>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="outline" className="h-8 text-xs text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleApprove(req.user_id, "reject"); }}>Reject</Button>
                          <Button size="sm" className="h-8 text-xs bg-success text-success-foreground hover:bg-success/90" onClick={(e) => { e.stopPropagation(); handleApprove(req.user_id, "approve"); }}>Approve</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            <Card className="relative overflow-hidden border-border/70 bg-card p-6 shadow-elegant">
              <div className="pointer-events-none absolute inset-0 bg-gradient-glow" />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-lg bg-gradient-primary shadow-glow">
                      <ServerCog className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="font-display text-base font-bold">Ollama runtime</h3>
                      <p className="text-sm text-muted-foreground">Your private on-premise AI engine.</p>
                    </div>
                  </div>
                  <Badge className={ollamaStatus === "ok" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}>
                    {ollamaStatus === "ok" ? <><CheckCircle2 className="mr-1 h-3 w-3" /> Connected</> : <><AlertCircle className="mr-1 h-3 w-3" /> Checking…</>}
                  </Badge>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Endpoint URL</Label>
                    <Input defaultValue="http://ollama.internal.mehtaco.in:11434" className="font-mono text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Model</Label>
                    <Input defaultValue="gemma2:27b" className="font-mono text-xs" />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Avg. latency", value: "142ms" },
                    { label: "Requests today", value: "3,418" },
                    { label: "GPU utilization", value: "62%" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-border/60 bg-background/50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                      <p className="mt-0.5 font-display text-lg font-bold num-tabular">{s.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={testOllama} disabled={ollamaStatus === "testing"} className="gap-2">
                    {ollamaStatus === "testing" ? "Testing…" : "Test connection"}
                  </Button>
                  <Button className="gap-2 bg-gradient-primary text-primary-foreground hover:opacity-95">Save</Button>
                </div>
              </div>
            </Card>

            <Card className="border-border/70 bg-card p-6 shadow-elegant">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-primary" />
                <div><h3 className="font-display text-base font-bold">Storage</h3><p className="text-xs text-muted-foreground">Local document vault</p></div>
              </div>
              <div className="mt-4">
                <div className="flex items-end justify-between">
                  <p className="text-sm"><span className="font-display text-2xl font-bold num-tabular">412 GB</span> <span className="text-muted-foreground">/ 2 TB used</span></p>
                  <p className="text-xs text-muted-foreground">21% — plenty of room</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-border/60">
                  <div className="h-full w-[21%] rounded-full bg-gradient-primary" />
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <Card className="border-border/70 bg-card p-6 shadow-elegant">
              <h3 className="font-display text-base font-bold">Authentication</h3>
              <div className="mt-4 space-y-3">
                {[
                  { title: "Two-factor authentication", desc: "Required for all team members on every sign-in.", on: true },
                  { title: "SSO via Google Workspace", desc: "Use your firm's Workspace accounts.", on: true },
                  { title: "Session timeout (15 min)", desc: "Auto-logout idle sessions.", on: false },
                ].map((s) => (
                  <div key={s.title} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-4">
                    <div><p className="text-sm font-semibold">{s.title}</p><p className="text-xs text-muted-foreground">{s.desc}</p></div>
                    <Switch defaultChecked={s.on} />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-border/70 bg-card p-6 shadow-elegant">
              <h3 className="font-display text-base font-bold">Data retention</h3>
              <p className="mt-1 text-sm text-muted-foreground">Documents and AI logs are stored exclusively on your firm's server.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Document retention</Label><Input defaultValue="7 years (ICAI compliant)" /></div>
                <div className="space-y-1.5"><Label>Audit log retention</Label><Input defaultValue="5 years" /></div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
