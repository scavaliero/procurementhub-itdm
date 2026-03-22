import { Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, Building2, FileText, Briefcase, ShoppingCart, LogOut } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { NotificationBell } from "@/components/NotificationBell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const fullNav = [
  { title: "Dashboard", url: "/supplier/dashboard", icon: LayoutDashboard },
  { title: "Profilo", url: "/supplier/onboarding", icon: Building2 },
  { title: "Documenti", url: "/supplier/documents", icon: FileText },
  { title: "Opportunità", url: "/supplier/opportunities", icon: Briefcase },
  { title: "Ordini", url: "/supplier/orders", icon: ShoppingCart },
  { title: "Benestare", url: "/supplier/billing-approvals", icon: FileText },
];

const enabledNav = [
  { title: "Documenti", url: "/supplier/documents", icon: FileText },
  { title: "Profilo", url: "/supplier/onboarding", icon: Building2 },
];

function SupplierSidebarContent({ navItems }: { navItems: typeof fullNav }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold tracking-tight text-white">ITDM</span>
            <span className="text-[9px] font-semibold text-sidebar-foreground/60 uppercase leading-none -ml-0.5">
              Group
            </span>
            <span className="border-l border-sidebar-foreground/30 pl-2 ml-0.5 text-sm font-bold text-white">
              Fornitori
            </span>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40 px-4 mb-1">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const active = location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-primary transition-colors"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                        {!collapsed && <span className="text-sm">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export default function SupplierLayout() {
  const { profile, signOut } = useAuth();

  const { data: supplier } = useQuery({
    queryKey: ["my-supplier"],
    queryFn: () => vendorService.getMySupplier(),
    enabled: !!profile,
  });

  const status = supplier?.status;

  // pre_registered: NO sidebar, just onboarding
  if (status === "pre_registered") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="h-14 flex items-center justify-between px-4 bg-primary text-primary-foreground shadow-md">
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold tracking-tight">ITDM</span>
            <span className="text-[9px] font-semibold opacity-60 uppercase leading-none">Group</span>
            <span className="border-l border-primary-foreground/30 pl-2 ml-0.5 text-sm font-bold">
              Procurement Hub
            </span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              title="Esci"
              className="text-primary-foreground hover:bg-primary-foreground/10 gap-1.5"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline text-sm">Logout</span>
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    );
  }

  const navItems = status === "enabled" ? enabledNav : fullNav;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <SupplierSidebarContent navItems={navItems} />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between px-4 bg-primary text-primary-foreground shadow-md">
            <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10" />
            <div className="flex items-center gap-1">
              <NotificationBell />
              <UserMenu basePath="/supplier" />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
