import { useMemo, useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, Navigate } from "react-router-dom";
import {
  Upload as UploadIcon, FileCheck2, Download, Play, Mic, Send, Sparkles,
  AlertTriangle, CalendarClock, Mail, MessageSquare, FileText, ChevronRight,
  CheckCircle2, XCircle, RefreshCw, Trash2, Filter, Eye, Bot, MapPin, Plus, Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clients, documents, deadlines, reconciliationChecks, missingDocs, chatHistory, recentActivity } from "@/lib/mock-data";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { toast } from "sonner";
import type { Document } from "@/lib/types";

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase();
}

export default function ClientDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [openDoc, setOpenDoc] = useState<Document | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [selectedBankTxnId, setSelectedBankTxnId] = useState<string | null>(null);
  const [selectedLedgerEntryId, setSelectedLedgerEntryId] = useState<string | null>(null);
  const [followUpMessage, setFollowUpMessage] = useState("");
  const [lockMonthYear, setLockMonthYear] = useState(format(new Date(), "yyyy-MM"));

  const { data: serverClient, isLoading: isClientLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      if (!id) return null;
      try {
        const res = await fetch(`/api/v1/clients/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
        });
        if (!res.ok) throw new Error("Failed");
        return res.json().then(d => d.data);
      } catch (e) {
        return null;
      }
    }
  });

  const { data: serverDocs } = useQuery({
    queryKey: ["client-docs", id],
    queryFn: async () => {
      if (!id) return [];
      try {
        const res = await fetch(`/api/v1/documents/client/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
        });
        if (!res.ok) throw new Error("Failed");
        return res.json().then(d => d.data);
      } catch (e) {
        return [];
      }
    }
  });

  const client = serverClient || clients.find((c) => c.id === id);
  const clientDocs = useMemo(() => 
    serverDocs?.length ? serverDocs : documents.filter((d) => d.clientId === id),
    [serverDocs, id]
  );
  const clientDeadlines = useMemo(() => deadlines.filter((d) => d.clientId === id), [id]);

  const avgConfidence = Math.round(
    (clientDocs.reduce((a, d) => a + d.confidence, 0) / Math.max(1, clientDocs.length)) * 100,
  );
  const openFlags = clientDocs.reduce((a, d) => a + d.anomalies, 0);

  // --- QnA: Sessions ---
  const { data: qnaSessions } = useQuery({
    queryKey: ["qna-sessions", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/qna/sessions?client_id=${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id
  });

  // --- QnA: Messages for active session ---
  const { data: qnaMessages, refetch: refetchMessages } = useQuery({
    queryKey: ["qna-messages", activeSessionId],
    queryFn: async () => {
      if (!activeSessionId) return [];
      const res = await fetch(`/api/v1/qna/sessions/${activeSessionId}/messages`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeSessionId
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [qnaMessages]);

  const createSession = async () => {
    const res = await fetch("/api/v1/qna/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      body: JSON.stringify({ client_id: id })
    });
    if (!res.ok) { toast.error("Failed to create session"); return; }
    const session = await res.json();
    setActiveSessionId(session.id);
    qc.invalidateQueries({ queryKey: ["qna-sessions", id] });
  };

  const sendChat = async () => {
    if (!chatInput.trim() || isSending) return;
    if (!activeSessionId) {
      // Auto-create a session first
      const res = await fetch("/api/v1/qna/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access_token")}` },
        body: JSON.stringify({ client_id: id })
      });
      if (!res.ok) { toast.error("Failed to create session"); return; }
      const session = await res.json();
      setActiveSessionId(session.id);
      qc.invalidateQueries({ queryKey: ["qna-sessions", id] });
      // now send to the new session
      await sendMessageToSession(session.id, chatInput);
      return;
    }
    await sendMessageToSession(activeSessionId, chatInput);
  };

  const sendMessageToSession = async (sessionId: string, content: string) => {
    setIsSending(true);
    setChatInput("");
    // Optimistic: add user message locally
    qc.setQueryData(["qna-messages", sessionId], (old: any[] | undefined) => [
      ...(old || []),
      { id: `temp-user-${Date.now()}`, role: "user", content }
    ]);
    try {
      const res = await fetch(`/api/v1/qna/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access_token")}` },
        body: JSON.stringify({ content })
      });
      if (!res.ok) throw new Error("Failed");
      // Refetch to get the real AI response
      await refetchMessages();
      qc.invalidateQueries({ queryKey: ["qna-sessions", id] }); // session name may have changed
    } catch {
      toast.error("Failed to get AI response");
    } finally {
      setIsSending(false);
    }
  };

  // --- Recon: Summary ---
  const { data: reconSummary } = useQuery({
    queryKey: ["recon-summary", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/recon/${id}/summary`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!id
  });

  const { data: reconDetail } = useQuery({
    queryKey: ["recon-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/recon/${id}/unmatched`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
      });
      if (!res.ok) return { bank_transactions: [], ledger_entries: [] };
      return res.json();
    },
    enabled: !!id
  });

  const { data: reconRecommendations } = useQuery({
    queryKey: ["recon-recommendations", id, selectedBankTxnId],
    queryFn: async () => {
      if (!id || !selectedBankTxnId) return { recommendations: [] };
      const res = await fetch(`/api/v1/recon/${id}/recommendations?bank_txn_id=${selectedBankTxnId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
      });
      if (!res.ok) return { recommendations: [] };
      return res.json();
    },
    enabled: !!id && !!selectedBankTxnId
  });

  useEffect(() => {
    const firstBank = reconDetail?.bank_transactions?.[0];
    const firstLedger = reconDetail?.ledger_entries?.[0];

    if (!selectedBankTxnId && firstBank) {
      setSelectedBankTxnId(firstBank.id);
      setFollowUpMessage(`Please clarify this ${firstBank.amount} transaction: ${firstBank.description || "unmatched bank entry"}.`);
    }
    if (!selectedLedgerEntryId && firstLedger) {
      setSelectedLedgerEntryId(firstLedger.id);
    }
  }, [reconDetail, selectedBankTxnId, selectedLedgerEntryId]);

  const runReconMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/recon/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access_token")}` },
        body: JSON.stringify({ client_id: id })
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Reconciliation completed");
      qc.invalidateQueries({ queryKey: ["recon-summary", id] });
      qc.invalidateQueries({ queryKey: ["recon-detail", id] });
      qc.invalidateQueries({ queryKey: ["recon-recommendations", id] });
    },
    onError: () => toast.error("Reconciliation failed")
  });

  const matchMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBankTxnId || !selectedLedgerEntryId) throw new Error("Select both rows first");
      const res = await fetch("/api/v1/recon/match", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access_token")}` },
        body: JSON.stringify({ bank_txn_id: selectedBankTxnId, ledger_entry_id: selectedLedgerEntryId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Transaction matched");
      qc.invalidateQueries({ queryKey: ["recon-summary", id] });
      qc.invalidateQueries({ queryKey: ["recon-detail", id] });
      qc.invalidateQueries({ queryKey: ["recon-recommendations", id] });
      setSelectedBankTxnId(null);
      setSelectedLedgerEntryId(null);
    },
    onError: (error: Error) => toast.error(error.message || "Match failed")
  });

  const askClientMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("Missing client");
      const res = await fetch("/api/v1/recon/ask-client", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access_token")}` },
        body: JSON.stringify({
          client_id: id,
          bank_txn_id: selectedBankTxnId,
          ledger_entry_id: selectedLedgerEntryId,
          message: followUpMessage,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: async (data) => {
      await navigator.clipboard.writeText(data.link || "");
      toast.success("Client follow-up link copied", { description: data.message });
      qc.invalidateQueries({ queryKey: ["recon-detail", id] });
    },
    onError: (error: Error) => toast.error(error.message || "Ask client failed")
  });

  const lockMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("Missing client");
      const res = await fetch("/api/v1/recon/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access_token")}` },
        body: JSON.stringify({ client_id: id, month_year: lockMonthYear }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast.success(`Locked ${lockMonthYear}`);
      qc.invalidateQueries({ queryKey: ["recon-summary", id] });
      qc.invalidateQueries({ queryKey: ["recon-detail", id] });
    },
    onError: (error: Error) => toast.error(error.message || "Lock failed")
  });

  if (!id) {
    return <Navigate to="/clients" replace />;
  }

  if (isClientLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading client details...</div>;
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-muted-foreground">Client not found</p>
        <Button onClick={() => window.location.href = "/clients"}>Back to clients</Button>
      </div>
    );
  }

  const handleDownloadReport = async () => {
    try {
      const res = await fetch(`/api/v1/clients/${client.id}/report`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
      });
      if (!res.ok) throw new Error("Failed to generate report");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${client.name}_Report.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Report downloaded successfully");
    } catch (e) {
      toast.error("Failed to download report");
    }
  };

  return (
    <div className="flex flex-col">
      {/* Custom client header */}
      <div className="border-b border-border/60 bg-gradient-surface px-6 py-6 md:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 border border-border shadow-sm">
              <AvatarFallback className="bg-gradient-primary text-lg font-bold text-primary-foreground">
                {initials(client.name)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight md:text-[28px]">
                  {client.name}
                </h1>
                <StatusBadge status={client.status} />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] font-bold text-foreground">{client.type}</span>
                <span className="font-mono">PAN · {client.pan}</span>
                {client.gstin && <span className="font-mono">GSTIN · {client.gstin}</span>}
                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {client.city}</span>
                <span>Partner · {client.partner}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(client.filings || []).map((f: string) => (
                  <Badge key={f} variant="outline" className="h-5 border-border bg-muted/50 px-1.5 text-[10px] font-bold tracking-wide">
                    {f}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
              <Link to={`/clients/${client.id}/upload`}>
                <UploadIcon className="h-4 w-4" /> Upload documents
              </Link>
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => runReconMutation.mutate()} disabled={runReconMutation.isPending}>
              <Play className="h-4 w-4" /> {runReconMutation.isPending ? "Running..." : "Run reconciliation"}
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleDownloadReport}>
              <Download className="h-4 w-4" /> Report
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 md:px-8">
        <Tabs defaultValue="overview" className="space-y-5">
          <TabsList className="h-auto flex-wrap gap-1 bg-muted/50 p-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="documents">Documents <Badge variant="secondary" className="ml-1.5 h-4 bg-foreground/10 px-1.5 text-[10px]">{clientDocs.length}</Badge></TabsTrigger>
            <TabsTrigger value="recon">Reconciliation</TabsTrigger>
            <TabsTrigger value="deadlines">Deadlines</TabsTrigger>
            <TabsTrigger value="missing">Missing docs <Badge variant="secondary" className="ml-1.5 h-4 bg-destructive/15 px-1.5 text-[10px] text-destructive">{missingDocs.length}</Badge></TabsTrigger>
            <TabsTrigger value="qa"><Sparkles className="mr-1 h-3 w-3" /> Q&amp;A</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Total documents", value: clientDocs.length, sub: `${clientDocs.filter((d: any) => d.status === "processed").length} processed` },
                { label: "Avg. confidence", value: `${avgConfidence}%`, sub: "Across processed docs" },
                { label: "Open flags", value: openFlags, sub: "Need review" },
                { label: "Filings managed", value: (client.filings || []).length, sub: (client.filings || []).join(" · ") },
              ].map((s) => (
                <Card key={s.label} className="border-border/70 bg-card p-5 shadow-elegant">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                  <p className="mt-1.5 font-display text-2xl font-bold num-tabular">{s.value}</p>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">{s.sub}</p>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2 border-border/70 bg-card p-5 shadow-elegant">
                <h3 className="font-display text-base font-bold">Recent activity</h3>
                <div className="mt-4 space-y-3">
                  {recentActivity.map((a) => (
                    <div key={a.id} className="flex gap-3 rounded-lg border border-border/40 bg-muted/20 p-3">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                        <FileCheck2 className="h-3.5 w-3.5" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[13px] font-medium leading-snug">{a.text}</p>
                        <p className="text-[11px] text-muted-foreground">{a.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="border-border/70 bg-card p-5 shadow-elegant">
                <h3 className="font-display text-base font-bold">Quick actions</h3>
                <div className="mt-4 grid gap-2">
                  {[
                    { icon: UploadIcon, label: "Upload documents", to: `/clients/${client.id}/upload` },
                    { icon: Play, label: "Run reconciliation", action: () => toast.success("Reconciliation started") },
                    { icon: Download, label: "Download FY report", action: () => toast.success("Report downloaded successfully") },
                    { icon: Mail, label: "Email missing-doc reminder", action: () => toast.success("Reminder email sent") },
                  ].map((a) => (
                    <Button key={a.label} variant="ghost" className="h-11 justify-between gap-2 border border-border/40 bg-muted/20 px-3 text-left hover:bg-muted/40" {...(a.to ? { asChild: true } : { onClick: a.action })}>
                      {a.to ? (
                        <Link to={a.to}>
                          <span className="flex items-center gap-2.5"><a.icon className="h-4 w-4 text-primary" /> <span className="text-sm font-medium">{a.label}</span></span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </Link>
                      ) : (
                        <>
                          <span className="flex items-center gap-2.5"><a.icon className="h-4 w-4 text-primary" /> <span className="text-sm font-medium">{a.label}</span></span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </>
                      )}
                    </Button>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* DOCUMENTS */}
          <TabsContent value="documents" className="space-y-3">
            <Card className="border-border/70 bg-card shadow-elegant">
              <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-3">
                <Select defaultValue="all">
                  <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="processed">Processed</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="all">
                  <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All doc types</SelectItem>
                    <SelectItem value="gstr">GSTR-3B</SelectItem>
                    <SelectItem value="form16">Form 16</SelectItem>
                    <SelectItem value="bank">Bank Statement</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="2024-25">
                  <SelectTrigger className="h-9 w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024-25">FY 2024-25</SelectItem>
                    <SelectItem value="2023-24">FY 2023-24</SelectItem>
                  </SelectContent>
                </Select>
                <div className="ml-auto flex gap-1.5">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => toast.success("Reprocessing started")}><RefreshCw className="h-3.5 w-3.5" /> Reprocess</Button>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs text-destructive hover:text-destructive" onClick={() => toast.success("Deleted successfully")}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60 hover:bg-transparent">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">File</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">FY</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Confidence</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Flags</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Uploaded</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientDocs.slice(0, 12).map((d) => (
                      <TableRow key={d.id} onClick={() => setOpenDoc(d)} className="cursor-pointer border-border/40 hover:bg-muted/40">
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                              <FileText className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-medium">{d.filename}</p>
                              <p className="text-[10px] text-muted-foreground">{d.size}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-bold">{d.docType}</span></TableCell>
                        <TableCell className="text-xs num-tabular">{d.financialYear}</TableCell>
                        <TableCell><StatusBadge status={d.status} /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-border/60">
                              <div className={`h-full rounded-full ${d.confidence > 0.85 ? "bg-success" : d.confidence > 0.7 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${d.confidence * 100}%` }} />
                            </div>
                            <span className="text-[11px] font-semibold num-tabular">{Math.round(d.confidence * 100)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {d.anomalies > 0 ? (
                            <span className="inline-flex h-5 items-center gap-1 rounded-full bg-destructive/12 px-2 text-[10px] font-bold text-destructive">
                              <AlertTriangle className="h-2.5 w-2.5" /> {d.anomalies}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(d.uploadedAt), { addSuffix: true })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* RECONCILIATION */}
          <TabsContent value="recon" className="space-y-4">
            <Card className="border-border/70 bg-card p-5 shadow-elegant">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reconciliation period</p>
                    <Input value={lockMonthYear} onChange={(e) => setLockMonthYear(e.target.value)} className="mt-1 h-9 w-[130px] font-mono text-xs" />
                  </div>
                  <p className="max-w-xl text-xs text-muted-foreground">Tier 1 exact matching, Tier 2 fuzzy matching, and grouped exception handling for manual review.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="gap-2" onClick={() => toast.success("Create journal flow is a stub for now")}>Create journal</Button>
                  <Button variant="outline" className="gap-2" onClick={handleDownloadReport}><Download className="h-4 w-4" /> Export PDF</Button>
                  <Button variant="outline" className="gap-2" onClick={() => lockMutation.mutate()} disabled={lockMutation.isPending}>
                    {lockMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                    Lock period
                  </Button>
                  <Button className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95" onClick={() => runReconMutation.mutate()} disabled={runReconMutation.isPending}>
                    {runReconMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    {runReconMutation.isPending ? "Running..." : "Run reconciliation"}
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-success/30 bg-success/8 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-success">Matched bank rows</p>
                  <p className="mt-1 font-display text-2xl font-bold num-tabular text-success">{reconSummary?.matched_bank ?? 0}</p>
                </div>
                <div className="rounded-lg border border-destructive/30 bg-destructive/8 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-destructive">Unmatched bank rows</p>
                  <p className="mt-1 font-display text-2xl font-bold num-tabular text-destructive">{reconSummary?.unmatched_bank ?? 0}</p>
                </div>
                <div className="rounded-lg border border-success/30 bg-success/8 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-success">Matched ledger rows</p>
                  <p className="mt-1 font-display text-2xl font-bold num-tabular text-success">{reconSummary?.matched_ledger ?? 0}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Locked month</p>
                  <p className="mt-1 font-display text-2xl font-bold num-tabular">{reconSummary?.latest_lock?.month_year || "—"}</p>
                </div>
              </div>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
              <Card className="border-border/70 bg-card p-0 shadow-elegant overflow-hidden">
                <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                  <div>
                    <h3 className="font-display text-sm font-bold">Unmatched bank transactions</h3>
                    <p className="text-xs text-muted-foreground">Click a row to drive recommendations.</p>
                  </div>
                  <Badge variant="secondary" className="bg-muted/60">{reconDetail?.bank_transactions?.length || 0}</Badge>
                </div>
                <div className="max-h-[420px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/60 hover:bg-transparent">
                        <TableHead className="text-[10px] uppercase tracking-wider">Date</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Description</TableHead>
                        <TableHead className="text-right text-[10px] uppercase tracking-wider">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(reconDetail?.bank_transactions || []).map((row: any) => {
                        const active = selectedBankTxnId === row.id;
                        return (
                          <TableRow
                            key={row.id}
                            className={`cursor-pointer border-border/40 ${active ? "bg-primary/10" : "hover:bg-muted/30"}`}
                            onClick={() => setSelectedBankTxnId(row.id)}
                          >
                            <TableCell className="py-3 text-xs num-tabular">{row.date ? format(new Date(row.date), "dd MMM") : "—"}</TableCell>
                            <TableCell className="py-3">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium">{row.description || "Untitled bank entry"}</p>
                                <p className="text-[10px] text-muted-foreground">{row.type} · {row.status}</p>
                              </div>
                            </TableCell>
                            <TableCell className="py-3 text-right text-xs font-semibold num-tabular">{row.amount}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              <Card className="border-border/70 bg-card p-0 shadow-elegant overflow-hidden">
                <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                  <div>
                    <h3 className="font-display text-sm font-bold">Unmatched ledger entries</h3>
                    <p className="text-xs text-muted-foreground">Select the best ledger candidate for the chosen bank row.</p>
                  </div>
                  <Badge variant="secondary" className="bg-muted/60">{reconDetail?.ledger_entries?.length || 0}</Badge>
                </div>
                <div className="max-h-[420px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/60 hover:bg-transparent">
                        <TableHead className="text-[10px] uppercase tracking-wider">Date</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Description</TableHead>
                        <TableHead className="text-right text-[10px] uppercase tracking-wider">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(reconDetail?.ledger_entries || []).map((row: any) => {
                        const active = selectedLedgerEntryId === row.id;
                        return (
                          <TableRow
                            key={row.id}
                            className={`cursor-pointer border-border/40 ${active ? "bg-primary/10" : "hover:bg-muted/30"}`}
                            onClick={() => setSelectedLedgerEntryId(row.id)}
                          >
                            <TableCell className="py-3 text-xs num-tabular">{row.date ? format(new Date(row.date), "dd MMM") : "—"}</TableCell>
                            <TableCell className="py-3">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium">{row.description || "Untitled ledger entry"}</p>
                                <p className="text-[10px] text-muted-foreground">{row.type} · {row.status}</p>
                              </div>
                            </TableCell>
                            <TableCell className="py-3 text-right text-xs font-semibold num-tabular">{row.amount}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
              <Card className="border-border/70 bg-card p-5 shadow-elegant">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-sm font-bold">Smart recommendations</h3>
                    <p className="text-xs text-muted-foreground">Top matches for the selected bank row.</p>
                  </div>
                  <Badge variant="outline" className="bg-muted/30">{reconRecommendations?.recommendations?.length || 0} suggestions</Badge>
                </div>
                <div className="mt-4 space-y-2">
                  {(reconRecommendations?.recommendations || []).map((item: any) => (
                    <button
                      key={item.ledger_entry_id}
                      onClick={() => setSelectedLedgerEntryId(item.ledger_entry_id)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedLedgerEntryId === item.ledger_entry_id ? "border-primary bg-primary/8" : "border-border/60 bg-muted/20 hover:bg-muted/35"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{item.description || "Ledger match"}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{item.date ? format(new Date(item.date), "dd MMM yyyy") : "—"} · {item.type}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold num-tabular">{item.amount}</p>
                          <p className="text-[11px] text-primary">{Math.round((item.confidence || 0) * 100)}%</p>
                        </div>
                      </div>
                    </button>
                  ))}
                  {(reconRecommendations?.recommendations || []).length === 0 && (
                    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Pick a bank row to surface recommendations.</div>
                  )}
                </div>
              </Card>

              <Card className="border-border/70 bg-card p-5 shadow-elegant">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-sm font-bold">Manual resolution</h3>
                    <p className="text-xs text-muted-foreground">Confirm the mapping or send a follow-up to the client.</p>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => toast.success("Create journal flow is a stub for now")}>Create journal</Button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Selected bank row</p>
                    <p className="mt-1 text-sm font-medium">{reconDetail?.bank_transactions?.find((row: any) => row.id === selectedBankTxnId)?.description || "None"}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Selected ledger row</p>
                    <p className="mt-1 text-sm font-medium">{reconDetail?.ledger_entries?.find((row: any) => row.id === selectedLedgerEntryId)?.description || "None"}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <Input
                    value={followUpMessage}
                    onChange={(e) => setFollowUpMessage(e.target.value)}
                    placeholder="Ask the client about this unmatched row…"
                    className="h-10"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
                      onClick={() => matchMutation.mutate()}
                      disabled={matchMutation.isPending || !selectedBankTxnId || !selectedLedgerEntryId}
                    >
                      {matchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Match selected
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => askClientMutation.mutate()}
                      disabled={askClientMutation.isPending || !selectedBankTxnId}
                    >
                      {askClientMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                      Ask client
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            {reconciliationChecks.length > 0 && !reconSummary?.total_bank && (
              <div className="space-y-3">
                {reconciliationChecks.map((c) => (
                  <Card key={c.id} className={`border-l-4 ${c.passed ? "border-l-success" : c.severity === "critical" ? "border-l-destructive" : "border-l-warning"} border-y-border/70 border-r-border/70 bg-card p-5 shadow-elegant`}>
                    <div className="flex items-start gap-4">
                      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${c.passed ? "bg-success/12 text-success" : c.severity === "critical" ? "bg-destructive/12 text-destructive" : "bg-warning/12 text-warning"}`}>
                        {c.passed ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-sm font-bold">{c.name}</h3>
                          <StatusBadge status={c.passed ? "filed" : c.severity} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{c.message}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* DEADLINES */}
          <TabsContent value="deadlines" className="space-y-4">
            {clientDeadlines.length === 0 && (
              <Card className="border-dashed border-border bg-card p-10 text-center">
                <p className="text-sm text-muted-foreground">No deadlines tracked for this client yet.</p>
              </Card>
            )}
            {Object.entries(
              clientDeadlines.reduce<Record<string, typeof clientDeadlines>>((acc, d) => {
                const k = format(new Date(d.dueDate), "MMMM yyyy");
                (acc[k] ||= []).push(d);
                return acc;
              }, {}),
            ).map(([month, items]) => (
              <Card key={month} className="border-border/70 bg-card shadow-elegant">
                <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
                  <h3 className="font-display text-sm font-bold">{month}</h3>
                  <span className="text-[11px] text-muted-foreground">{items.length} deadlines</span>
                </div>
                <div className="divide-y divide-border/60">
                  {items.map((d) => {
                    const days = differenceInDays(new Date(d.dueDate), new Date());
                    const danger = days < 7;
                    const warn = days < 30 && days >= 7;
                    return (
                      <div key={d.id} className="flex items-center gap-4 px-5 py-3.5">
                        <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border ${danger ? "border-destructive/30 bg-destructive/8 text-destructive" : warn ? "border-warning/30 bg-warning/8 text-warning" : "border-border bg-muted/40 text-muted-foreground"}`}>
                          <span className="text-[10px] font-semibold uppercase">{format(new Date(d.dueDate), "MMM")}</span>
                          <span className="font-display text-base font-bold leading-none num-tabular">{format(new Date(d.dueDate), "dd")}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold">{d.title}</p>
                            <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-bold">{d.type}</span>
                          </div>
                          <p className={`mt-0.5 text-xs ${danger ? "text-destructive" : warn ? "text-warning" : "text-muted-foreground"}`}>
                            {days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? "Due today" : `Due in ${days} days`}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => toast.success("Marked as filed")}>
                          <FileCheck2 className="h-3.5 w-3.5" /> Mark as filed
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </TabsContent>

          {/* MISSING DOCS */}
          <TabsContent value="missing" className="space-y-3">
            {missingDocs.map((m) => (
              <Card key={m.id} className="border-border/70 bg-card p-4 shadow-elegant">
                <div className="flex items-center gap-4">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${m.severity === "blocking" ? "bg-destructive/12 text-destructive" : "bg-warning/12 text-warning"}`}>
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{m.type}</p>
                      <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-bold">{m.requiredFor}</span>
                      <StatusBadge status={m.severity} />
                    </div>
                    {m.note && <p className="mt-0.5 text-xs text-muted-foreground">{m.note}</p>}
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => {
                    navigator.clipboard.writeText(`Hi ${client.name}, please share ${m.type} at your earliest convenience. — ${client.partner}`);
                    toast.success("Reminder copied to clipboard", { description: "Paste it into WhatsApp or email." });
                  }}>
                    <MessageSquare className="h-3.5 w-3.5" /> Generate reminder
                  </Button>
                </div>
              </Card>
            ))}
          </TabsContent>

          {/* Q&A */}
          <TabsContent value="qa">
            <Card className="overflow-hidden border-border/70 bg-card shadow-elegant">
              <div className="border-b border-border/60 bg-muted/30 px-5 py-3">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-sm font-bold">Ask anything about {client.name}</h3>
                  <span className="ml-auto text-[10px] font-medium text-muted-foreground">Powered by Gemma 4:e2b · runs locally</span>
                </div>
              </div>

              <div className="flex h-[520px]">
                {/* Sessions sidebar */}
                <div className="w-48 shrink-0 border-r border-border/60 flex flex-col bg-muted/10">
                  <div className="p-2 border-b border-border/40">
                    <Button size="sm" variant="outline" className="w-full gap-1 text-xs h-8" onClick={createSession}>
                      <Plus className="h-3 w-3" /> New chat
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
                    {(qnaSessions || []).map((s: any) => (
                      <button
                        key={s.id}
                        onClick={() => setActiveSessionId(s.id)}
                        className={`w-full text-left rounded-md px-2.5 py-2 text-[11px] truncate transition-colors ${
                          activeSessionId === s.id
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                        }`}
                      >
                        {s.session_name}
                      </button>
                    ))}
                    {(!qnaSessions || qnaSessions.length === 0) && (
                      <p className="text-[10px] text-muted-foreground text-center py-4">No sessions yet</p>
                    )}
                  </div>
                </div>

                {/* Chat area */}
                <div className="flex-1 flex flex-col">
                  <div className="flex-1 space-y-4 overflow-y-auto p-5">
                    {!activeSessionId && (
                      <div className="grid h-full place-items-center text-center text-muted-foreground">
                        <div>
                          <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" />
                          <p className="text-sm">Start a new chat or select a session.</p>
                          <p className="text-xs mt-1">Ask about filings, anomalies, or trends.</p>
                        </div>
                      </div>
                    )}
                    {activeSessionId && (qnaMessages || []).map((m: any) => (
                      <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                        <Avatar className="h-8 w-8 shrink-0 border border-border">
                          <AvatarFallback className={m.role === "user" ? "bg-muted text-xs" : "bg-gradient-primary text-xs text-primary-foreground"}>
                            {m.role === "user" ? "You" : <Bot className="h-3.5 w-3.5" />}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`max-w-[75%] space-y-2 rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "rounded-tr-md bg-primary text-primary-foreground" : "rounded-tl-md bg-muted/60"}`}>
                          <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                        </div>
                      </div>
                    ))}
                    {isSending && (
                      <div className="flex gap-3">
                        <Avatar className="h-8 w-8 shrink-0 border border-border">
                          <AvatarFallback className="bg-gradient-primary text-xs text-primary-foreground">
                            <Bot className="h-3.5 w-3.5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="rounded-2xl rounded-tl-md bg-muted/60 px-4 py-2.5">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="border-t border-border/60 bg-muted/20 p-3">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {["What's the total ITC for FY 24-25?", "Show GSTR-3B late fees", "Any TDS mismatches?"].map((q) => (
                        <button key={q} onClick={() => setChatInput(q)} className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                          {q}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendChat()}
                        placeholder={`Ask about ${client.name}…`}
                        className="h-10 border-border bg-card"
                        disabled={isSending}
                      />
                      <Button size="icon" onClick={sendChat} disabled={isSending || !chatInput.trim()} className="h-10 w-10 shrink-0 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
                        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Document detail sheet */}
      <Sheet open={!!openDoc} onOpenChange={(o) => !o && setOpenDoc(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {openDoc && (
            <>
              <SheetHeader>
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <SheetTitle className="truncate text-left">{openDoc.filename}</SheetTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">{openDoc.docType} · FY {openDoc.financialYear} · {openDoc.size}</p>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
                    <div className="mt-1.5"><StatusBadge status={openDoc.status} /></div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Confidence</p>
                    <p className="mt-1 font-display text-lg font-bold num-tabular">{Math.round(openDoc.confidence * 100)}%</p>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Extracted fields</h4>
                  <div className="overflow-hidden rounded-lg border border-border">
                    {Object.entries(openDoc.extracted ?? {}).map(([k, v], i, arr) => (
                      <div key={k} className={`flex items-center justify-between px-3 py-2.5 text-sm ${i < arr.length - 1 ? "border-b border-border/60" : ""}`}>
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-mono text-xs font-semibold num-tabular">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {openDoc.anomalies > 0 && (
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Anomalies ({openDoc.anomalies})</h4>
                    <div className="space-y-2">
                      {Array.from({ length: openDoc.anomalies }).map((_, i) => (
                        <div key={i} className="flex gap-3 rounded-lg border border-warning/30 bg-warning/8 p-3">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                          <div>
                            <p className="text-sm font-semibold">CGST + SGST should equal IGST when interstate</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">Detected mismatch of ₹4,220 in row 14.</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 gap-2" onClick={() => toast.success("Opening original document...")}><Eye className="h-4 w-4" /> View original</Button>
                  <Button variant="outline" className="flex-1 gap-2" onClick={() => toast.success("Reprocessing document...")}><RefreshCw className="h-4 w-4" /> Reprocess</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

