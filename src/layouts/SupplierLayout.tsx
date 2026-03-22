import { Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, Building2, FileText, Briefcase, ShoppingCart, LogOut } from "lucide-react";
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
      <SidebarHeader className="border-b px-4 py-3">
        {!collapsed && (
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold tracking-tight text-primary">ITDM</span>
            <span className="text-[10px] font-medium text-muted-foreground">GROUP</span>
            <span className="ml-0.5 border-l pl-1.5 text-xs font-semibold text-foreground">Fornitori</span>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={location.pathname.startsWith(item.url)}>
                    <NavLink to={item.url} className="hover:bg-muted/50" activeClassName="bg-muted text-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
        <header className="h-14 flex items-center justify-between px-4 bg-primary text-primary-foreground">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight">ITDM</span>
            <span className="text-[10px] font-medium opacity-80">GROUP</span>
            <span className="ml-1 border-l border-primary-foreground/30 pl-2 text-xs font-semibold">
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
          <header className="h-14 flex items-center justify-between px-4 bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10" />
              {profile && (
                <span className="text-sm font-medium opacity-90 hidden sm:inline">
                  {profile.full_name}
                </span>
              )}
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
      </div>
    </SidebarProvider>
  );
}
