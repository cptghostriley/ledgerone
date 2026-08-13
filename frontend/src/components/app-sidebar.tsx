import { LayoutDashboard, Users, FileStack, Workflow, Settings, Activity, FileSearch } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";

import { Shield, Database } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, end: true },
  { title: "Clients", url: "/clients", icon: Users, badge: "10" },
  { title: "Schemas", url: "/schemas", icon: FileSearch },
  { title: "Jobs", url: "/jobs", icon: Workflow, badge: "3", badgeVariant: "primary" as const },
];

const userItems = [
  { title: "Activity", url: "/activity", icon: Activity },
];

const firmItems = [
  { title: "Firm Activity", url: "/firm-activity", icon: Database },
  { title: "Admin", url: "/admin", icon: Shield },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();

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

  const isAdmin = meData?.active_role === "Admin/Owner";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Aurora glow within the sidebar */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 80% 30% at 50% 0%, hsl(var(--aurora-1) / 0.25), transparent 60%), radial-gradient(ellipse 80% 30% at 50% 100%, hsl(var(--aurora-2) / 0.18), transparent 60%)",
        }}
      />

      <SidebarHeader className={`relative z-10 border-b border-sidebar-border/60 py-4 ${collapsed ? "px-2" : "px-4"}`}>
        <Logo collapsed={collapsed} />
      </SidebarHeader>

      <SidebarContent className={`relative z-10 py-4 ${collapsed ? "px-2" : "px-3"}`}>
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/45">
              Workspace
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {mainItems.map((item) => {
                const active = item.end ? pathname === item.url : pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={active}
                      className={[
                        "relative h-11 overflow-hidden rounded-xl transition-all",
                        collapsed ? "!w-12 !p-0 justify-center mx-auto" : "px-3",
                        "hover:bg-sidebar-accent/60",
                        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:shadow-[0_0_0_1px_hsl(var(--sidebar-primary)/0.35),0_8px_24px_-8px_hsl(var(--aurora-1)/0.6)]",
                      ].join(" ")}
                    >
                      <NavLink to={item.url} end={item.end} className="relative">
                        {/* Active aurora swatch */}
                        {active && (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 opacity-60"
                            style={{
                              background:
                                "radial-gradient(circle at 0% 50%, hsl(var(--aurora-1) / 0.5), transparent 55%), radial-gradient(circle at 100% 50%, hsl(var(--aurora-2) / 0.45), transparent 55%)",
                            }}
                          />
                        )}
                        <item.icon className="relative h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                        {!collapsed && (
                          <>
                            <span className="relative flex-1 text-[14px] font-medium">{item.title}</span>
                            {item.badge && (
                              <Badge
                                variant="secondary"
                                className={
                                  item.badgeVariant === "primary"
                                    ? "relative h-5 rounded-full border-0 bg-gradient-to-r from-[hsl(var(--aurora-1))] to-[hsl(var(--aurora-2))] px-2 text-[10px] font-bold text-white shadow-glow num-tabular"
                                    : "relative h-5 rounded-full border-0 bg-sidebar-accent/80 px-2 text-[10px] font-semibold text-sidebar-foreground num-tabular"
                                }
                              >
                                {item.badge}
                              </Badge>
                            )}
                          </>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!collapsed && <div className="wave-divider mx-3 my-5 opacity-60" />}
        {collapsed && <div className="mx-auto my-4 h-px w-6 bg-sidebar-border/60" />}

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/45">
              User
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {userItems.map((item) => {
                const active = pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={active}
                      className={[
                        "h-11 overflow-hidden rounded-xl transition-all",
                        collapsed ? "!w-12 !p-0 justify-center mx-auto" : "px-3",
                        "hover:bg-sidebar-accent/60",
                        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
                      ].join(" ")}
                    >
                      <NavLink to={item.url}>
                        <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                        {!collapsed && <span className="text-[14px] font-medium">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <>
            {!collapsed && <div className="wave-divider mx-3 my-5 opacity-60" />}
            {collapsed && <div className="mx-auto my-4 h-px w-6 bg-sidebar-border/60" />}

            <SidebarGroup>
              {!collapsed && (
                <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/45">
                  Firm
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {firmItems.map((item) => {
                    const active = pathname.startsWith(item.url);
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          tooltip={item.title}
                          isActive={active}
                          className={[
                            "h-11 overflow-hidden rounded-xl transition-all",
                            collapsed ? "!w-12 !p-0 justify-center mx-auto" : "px-3",
                            "hover:bg-sidebar-accent/60",
                            "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
                          ].join(" ")}
                        >
                          <NavLink to={item.url}>
                            <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                            {!collapsed && <span className="text-[14px] font-medium">{item.title}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className={`relative z-10 border-t border-sidebar-border/60 ${collapsed ? "p-2" : "p-3"}`}>
        {!collapsed ? (
          <div className="relative overflow-hidden rounded-xl border border-sidebar-border/80 bg-sidebar-accent/40 p-3">
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-4 opacity-60 blur-2xl"
              style={{
                background:
                  "radial-gradient(circle at 70% 30%, hsl(var(--aurora-2) / 0.45), transparent 60%), radial-gradient(circle at 20% 80%, hsl(var(--aurora-1) / 0.4), transparent 60%)",
              }}
            />
            <div className="relative flex items-center gap-2">
              <span className="relative grid h-2 w-2 place-items-center">
                <span className="absolute h-2 w-2 animate-ping rounded-full bg-success opacity-70" />
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-accent-foreground">
                Ollama connected
              </span>
            </div>
            <p className="relative mt-1 text-[11px] leading-relaxed text-sidebar-foreground/70">
              qwen2.5:3b-instruct · running locally on firm server
            </p>
          </div>
        ) : (
          <div className="grid h-9 place-items-center">
            <span className="relative grid h-2 w-2 place-items-center">
              <span className="absolute h-2 w-2 animate-ping rounded-full bg-success opacity-70" />
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
            </span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
