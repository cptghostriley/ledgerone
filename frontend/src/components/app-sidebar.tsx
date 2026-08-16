import { LayoutDashboard, Users, FileStack, Settings, Activity, FileSearch } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, Link } from "react-router-dom";
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
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, end: true },
  { title: "Clients", url: "/clients", icon: Users, badge: "10" },
  { title: "Schemas", url: "/schemas", icon: FileSearch },
  { title: "Extraction", url: "/extraction", icon: FileStack, badge: "New", badgeVariant: "primary" as const },
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
      <SidebarHeader className={`relative z-10 border-b border-sidebar-border/60 py-4 ${collapsed ? "px-2" : "px-4"}`}>
        <Link to="/dashboard">
          <Logo collapsed={collapsed} />
        </Link>
      </SidebarHeader>

      <SidebarContent className={`relative z-10 py-4 ${collapsed ? "px-2" : "px-3"}`}>
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
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
                        "relative h-10 overflow-hidden rounded-lg transition-colors font-medium text-sidebar-foreground",
                        collapsed ? "!w-10 !p-0 justify-center mx-auto" : "px-3",
                        "hover:bg-muted/70 hover:text-foreground",
                        "data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-semibold",
                      ].join(" ")}
                    >
                      <NavLink to={item.url} end={item.end} className="relative flex items-center w-full gap-2.5">
                        <item.icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2 : 1.75} />
                        {!collapsed && (
                          <>
                            <span className="flex-1 text-[13.5px]">{item.title}</span>
                            {item.badge && (
                              <Badge
                                variant="secondary"
                                className={
                                  item.badgeVariant === "primary"
                                    ? "relative h-5 rounded-full border border-primary/20 bg-primary/10 px-2 text-[10px] font-bold text-primary num-tabular"
                                    : "relative h-5 rounded-full border-0 bg-muted px-2 text-[10px] font-semibold text-muted-foreground num-tabular"
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

        {!collapsed && <div className="mx-3 my-4 h-px bg-sidebar-border/60" />}
        {collapsed && <div className="mx-auto my-4 h-px w-6 bg-sidebar-border/60" />}

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
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
                        "h-10 overflow-hidden rounded-lg transition-colors font-medium text-sidebar-foreground",
                        collapsed ? "!w-10 !p-0 justify-center mx-auto" : "px-3",
                        "hover:bg-muted/70 hover:text-foreground",
                        "data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-semibold",
                      ].join(" ")}
                    >
                      <NavLink to={item.url} className="flex items-center w-full gap-2.5">
                        <item.icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2 : 1.75} />
                        {!collapsed && <span className="text-[13.5px]">{item.title}</span>}
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
            {!collapsed && <div className="mx-3 my-4 h-px bg-sidebar-border/60" />}
            {collapsed && <div className="mx-auto my-4 h-px w-6 bg-sidebar-border/60" />}

            <SidebarGroup>
              {!collapsed && (
                <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
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
                            "h-10 overflow-hidden rounded-lg transition-colors font-medium text-sidebar-foreground",
                            collapsed ? "!w-10 !p-0 justify-center mx-auto" : "px-3",
                            "hover:bg-muted/70 hover:text-foreground",
                            "data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-semibold",
                          ].join(" ")}
                        >
                          <NavLink to={item.url} className="flex items-center w-full gap-2.5">
                            <item.icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2 : 1.75} />
                            {!collapsed && <span className="text-[13.5px]">{item.title}</span>}
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
    </Sidebar>
  );
}
