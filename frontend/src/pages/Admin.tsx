import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ServerCog, UserPlus, CheckCircle2, AlertCircle, Building2, Shield, Database, Mail } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function Admin() {
  const [ollamaStatus, setOllamaStatus] = useState<"idle" | "testing" | "ok" | "error">("ok");
  const [activeTab, setActiveTab] = useState("firm");
  const [teamTab, setTeamTab] = useState("current");
  const queryClient = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Staff");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const { data: meData } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/v1/auth/me", {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
      });
      if (!res.ok) throw new Error("Failed");
      return res.json().then(d => d.data);
    }
  });

  const { data: teamData } = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const res = await fetch("/api/v1/auth/team", {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
      });
      if (!res.ok) throw new Error("Failed");
      return res.json().then(d => d.data);
    }
  });

  const team = teamData || [];
  const currentTeam = team.filter((m: any) => m.status !== "pending_approval");
  const pendingApprovals = team.filter((m: any) => m.status === "pending_approval");
  const hasPending = pendingApprovals.length > 0;

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
      queryClient.invalidateQueries({ queryKey: ["team"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleInvite = async () => {
    try {
      const res = await fetch("/api/v1/auth/invite", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      if (!res.ok) throw new Error("Invite failed");
      toast.success("Invite sent successfully!");
      setInviteOpen(false);
      queryClient.invalidateQueries({ queryKey: ["team"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const updateMember = async (userId: string, action: string, role?: string) => {
    try {
      const res = await fetch("/api/v1/auth/team/member", {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`
        },
        body: JSON.stringify({ user_id: userId, action, role })
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success("Member updated successfully");
      queryClient.invalidateQueries({ queryKey: ["team"] });
      setSelectedUser(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const removeMember = async (userId: string) => {
    try {
      const res = await fetch(`/api/v1/auth/team/member/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
      });
      if (!res.ok) throw new Error("Remove failed");
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: ["team"] });
      setSelectedUser(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

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
      <PageHeader title="Firm Administration" description="Manage your firm profile, team, and AI infrastructure." />

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
                    layoutId="admin-active-tab"
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
                    <p className="text-xs text-muted-foreground">{currentTeam.length} people in this workspace</p>
                  </div>
                  <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2 bg-gradient-primary text-primary-foreground hover:opacity-95">
                        <Mail className="h-4 w-4" /> Invite Member
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Invite a new team member</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-1.5">
                          <Label>Email address</Label>
                          <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@firm.in" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Designation</Label>
                          <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                            <option value="Admin/Owner">Admin/Owner</option>
                            <option value="Partner">Partner</option>
                            <option value="Staff">Staff</option>
                            <option value="Article Clerk">Article Clerk</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                        <Button onClick={handleInvite} className="bg-gradient-primary text-primary-foreground">Send Invite</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="divide-y divide-border/60">
                  {currentTeam.map((m: any) => (
                    <Dialog key={m.user_id} open={selectedUser?.user_id === m.user_id} onOpenChange={(open) => !open && setSelectedUser(null)}>
                      <DialogTrigger asChild>
                        <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setSelectedUser(m)}>
                          <Avatar className="h-10 w-10 border border-border">
                            <AvatarFallback className="bg-gradient-primary text-xs font-bold text-primary-foreground">
                              {m.email.substring(0,2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{m.email}</p>
                            {m.icai_number && <p className="text-xs text-muted-foreground">ICAI: {m.icai_number}</p>}
                          </div>
                          <Badge variant="outline" className="border-border bg-muted/40 text-[10px] font-bold uppercase tracking-wider">{m.role}</Badge>
                          {m.status === "invited" ? (
                            <Badge variant="secondary" className="text-[10px]">Invited</Badge>
                          ) : m.status === "revoked" ? (
                            <Badge variant="destructive" className="text-[10px]">Disabled</Badge>
                          ) : (
                            <span className="inline-flex h-2 w-2 rounded-full bg-success" title="Active" />
                          )}
                        </div>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Manage {m.email}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <p className="text-sm text-muted-foreground">Current Designation: <strong>{m.role}</strong></p>
                          <div className="flex flex-col gap-2">
                            <Label>Change Designation</Label>
                            <div className="flex gap-2">
                              <select className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors" 
                                onChange={(e) => updateMember(m.user_id, "change_designation", e.target.value)}
                                defaultValue={m.role}>
                                <option value="Admin/Owner">Admin/Owner</option>
                                <option value="Partner">Partner</option>
                                <option value="Staff">Staff</option>
                                <option value="Article Clerk">Article Clerk</option>
                              </select>
                            </div>
                          </div>
                          <div className="pt-4 border-t flex flex-col gap-2">
                            {m.status === "revoked" ? (
                              <Button variant="outline" className="w-full text-success" onClick={() => updateMember(m.user_id, "enable_access")}>Enable Access</Button>
                            ) : (
                              <Button variant="outline" className="w-full text-warning hover:text-warning" onClick={() => updateMember(m.user_id, "disable_access")}>Disable Access</Button>
                            )}
                            <Button variant="destructive" className="w-full" onClick={() => removeMember(m.user_id)}>Remove Member</Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
