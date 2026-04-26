import { Bell, Search, ChevronRight } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Link, useLocation } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const labels: Record<string, string> = {
  "": "Dashboard",
  clients: "Clients",
  schemas: "Schemas",
  jobs: "Jobs",
  settings: "Settings",
  upload: "Upload",
  activity: "Activity",
};

export function AppHeader() {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/60 px-4 backdrop-blur-2xl md:px-6">
      {/* Subtle aurora wash behind the header */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 40% 100% at 0% 50%, hsl(var(--aurora-1) / 0.10), transparent 60%), radial-gradient(ellipse 40% 100% at 100% 50%, hsl(var(--aurora-2) / 0.10), transparent 60%)",
        }}
      />
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
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
          <Input
            placeholder="Search clients, documents…"
            className="h-10 w-72 rounded-full border-border/70 bg-card/60 pl-10 text-sm placeholder:text-muted-foreground/70 backdrop-blur focus-visible:bg-card focus-visible:ring-aurora"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden h-5 -translate-y-1/2 items-center gap-1 rounded-md border border-border/70 bg-muted/60 px-1.5 text-[10px] font-medium text-muted-foreground lg:flex">
            ⌘K
          </kbd>
        </div>

        <ThemeToggle />

        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-lg">
          <Bell className="h-4 w-4" strokeWidth={1.75} />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[hsl(var(--aurora-3))] to-[hsl(var(--aurora-4))]" />
        </Button>

        <Separator orientation="vertical" className="h-6" />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 pl-1 outline-none text-left">
            <div className="relative">
              <span
                aria-hidden
                className="absolute -inset-0.5 rounded-full opacity-80 blur-[3px]"
                style={{ background: "var(--gradient-aurora)" }}
              />
              <Avatar className="relative h-9 w-9 border border-white/20">
                <AvatarFallback className="bg-gradient-primary text-[12px] font-bold text-primary-foreground">
                  AM
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="hidden flex-col leading-tight md:flex">
              <span className="text-[13px] font-semibold">CA Anjali Mehta</span>
              <span className="text-[10px] text-muted-foreground">Mehta &amp; Co. — Partner</span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-2">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">CA Anjali Mehta</p>
                <p className="text-xs leading-none text-muted-foreground">anjali@mehtaco.in</p>
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
