import { Bell, Search, ChevronRight, X, FileText, Users, Workflow } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

const labels: Record<string, string> = {
  "": "Dashboard",
  clients: "Clients",
  schemas: "Schemas",
  jobs: "Jobs",
  settings: "Settings",
  upload: "Upload",
  activity: "Activity",
};

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("access_token")}` });

export function AppHeader() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const segments = pathname.split("/").filter(Boolean);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Global search
  const { data: searchResults } = useQuery({
    queryKey: ["global-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) return { clients: [], jobs: [] };
      const [cRes, jRes] = await Promise.all([
        fetch("/api/v1/clients", { headers: authHeader() }),
        fetch("/api/v1/jobs", { headers: authHeader() }),
      ]);
      const clients = cRes.ok ? (await cRes.json()).data ?? [] : [];
      const jobs = jRes.ok ? (await jRes.json()).data ?? [] : [];
      const q = searchQuery.toLowerCase();
      return {
        clients: clients.filter((c: any) =>
          c.name?.toLowerCase().includes(q) || c.pan?.toLowerCase().includes(q) || c.gstin?.toLowerCase().includes(q)
        ).slice(0, 5),
        jobs: jobs.filter((j: any) =>
          j.type?.toLowerCase().includes(q) || j.status?.toLowerCase().includes(q)
        ).slice(0, 3),
      };
    },
    enabled: searchQuery.length >= 2,
  });

  // Notifications feed
  const { data: notifData } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/v1/activity", { headers: authHeader() });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data ?? []).slice(0, 8);
    },
    refetchInterval: 30_000,
  });

  const notifications: any[] = notifData ?? [];
  const unread = notifications.length;

  // Keyboard shortcut ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const hasResults = searchResults && (searchResults.clients.length > 0 || searchResults.jobs.length > 0);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl md:px-6">
      <SidebarTrigger className="h-9 w-9 shrink-0 rounded-lg" />
      <Separator orientation="vertical" className="h-6" />

      <nav className="flex items-center gap-1.5 text-sm">
        <Link to="/" className="font-medium text-muted-foreground transition-colors hover:text-foreground">
          Workspace
        </Link>
        {segments.length === 0 ? (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="font-semibold text-foreground">Dashboard</span>
          </>
        ) : (
          segments.map((seg, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className={i === segments.length - 1 ? "font-semibold text-foreground" : "font-medium text-muted-foreground"}>
                {labels[seg] ?? seg}
              </span>
            </span>
          ))
        )}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        {/* Global search */}
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
          <Input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search clients, documents…"
            className="h-10 w-72 rounded-full border-border/70 bg-card/60 pl-10 text-sm placeholder:text-muted-foreground/70 backdrop-blur focus-visible:bg-card focus-visible:ring-aurora"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden h-5 -translate-y-1/2 items-center gap-1 rounded-md border border-border/70 bg-muted/60 px-1.5 text-[10px] font-medium text-muted-foreground lg:flex">
            ⌘K
          </kbd>

          {/* Search results dropdown */}
          {searchOpen && searchQuery.length >= 2 && (
            <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-full min-w-[360px] rounded-xl border border-border/70 bg-popover/95 shadow-xl backdrop-blur-xl">
              {!hasResults && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">No results for "{searchQuery}"</div>
              )}
              {searchResults?.clients && searchResults.clients.length > 0 && (
                <div>
                  <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Clients</p>
                  {searchResults.clients.map((c: any) => (
                    <button
                      key={c.id}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors"
                      onClick={() => { navigate(`/clients/${c.id}`); setSearchOpen(false); setSearchQuery(""); }}
                    >
                      <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.name}</p>
                        {c.pan && <p className="text-[11px] text-muted-foreground font-mono">{c.pan}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {searchResults?.jobs && searchResults.jobs.length > 0 && (
                <div className="border-t border-border/60">
                  <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Jobs</p>
                  {searchResults.jobs.map((j: any) => (
                    <button
                      key={j.id}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors"
                      onClick={() => { navigate("/jobs"); setSearchOpen(false); setSearchQuery(""); }}
                    >
                      <Workflow className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="font-medium truncate">{j.type} <span className="text-muted-foreground text-xs">· {j.status}</span></p>
                    </button>
                  ))}
                </div>
              )}
              <div className="border-t border-border/60 px-3 py-2 text-right">
                <button className="text-[11px] text-muted-foreground hover:text-foreground" onClick={() => setSearchOpen(false)}>
                  Press Esc to close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Click-outside close for search */}
        {searchOpen && (
          <div className="fixed inset-0 z-40" onClick={() => setSearchOpen(false)} />
        )}

        <ThemeToggle />

        {/* Notifications bell */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-lg">
              <Bell className="h-4 w-4" strokeWidth={1.75} />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-2 w-2 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aurora-3 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[hsl(var(--aurora-3))] to-[hsl(var(--aurora-4))]" />
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 shadow-xl" sideOffset={8}>
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <p className="font-display text-sm font-bold">Notifications</p>
              {unread > 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{unread} new</span>}
            </div>
            <div className="divide-y divide-border/50 max-h-80 overflow-y-auto">
              {notifications.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">All caught up!</div>
              )}
              {notifications.map((n: any) => (
                <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors cursor-default">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium leading-snug truncate">{n.text}</p>
                    {n.timestamp && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border/60 px-4 py-2">
              <Link to="/activity" className="text-[11px] font-semibold text-primary hover:underline">View all activity →</Link>
            </div>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="h-6" />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-lg px-2 py-1 outline-none text-left transition-colors hover:bg-muted/60">
            <Avatar className="h-8 w-8 border border-primary/20 bg-primary/10">
              <AvatarFallback className="bg-primary/10 text-[11px] font-bold text-primary">
                CA
              </AvatarFallback>
            </Avatar>
            <div className="hidden flex-col leading-tight md:flex">
              <span className="text-[13px] font-semibold text-foreground">My Account</span>
              <span className="text-[10px] text-muted-foreground">Workspace Owner</span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-2">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">LedgerOne</p>
                <p className="text-xs leading-none text-muted-foreground">Workspace</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">Profile settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:bg-destructive focus:text-destructive-foreground cursor-pointer"
              onClick={() => {
                localStorage.removeItem("access_token");
                window.location.href = "/auth";
              }}
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
