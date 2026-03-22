import { Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Building2, Briefcase, ShoppingCart, FileText,
  Settings, ShieldCheck, LogOut, Users,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useGrants } from "@/hooks/useGrants";
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

const mainNav = [
  { title: "Dashboard", url: "/internal/dashboard", icon: LayoutDashboard },
  { title: "Fornitori", url: "/internal/vendors", icon: Building2 },
  { title: "Opportunità", url: "/internal/opportunities", icon: Briefcase },
  { title: "Ordini", url: "/internal/orders", icon: ShoppingCart },
  { title: "Benestare", url: "/internal/billing-approvals", icon: FileText },
];

const configNav = [
  { title: "Tipi Documento", url: "/internal/config/document-types", icon: FileText },
  { title: "Categorie", url: "/internal/config/categories", icon: Settings },
];

const adminNav = [
  { title: "Ruoli", url: "/internal/admin/roles", icon: ShieldCheck },
  { title: "Utenti", url: "/internal/admin/users", icon: Users },
];

function InternalSidebarContent() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { hasGrant } = useGrants();

  const showConfig = hasGrant("manage_document_types");
  const showAdmin = hasGrant("manage_roles") || hasGrant("manage_users");

  const renderItems = (items: typeof mainNav) =>
    items.map((item) => (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={location.pathname.startsWith(item.url)}>
          <NavLink to={item.url} className="hover:bg-muted/50" activeClassName="bg-muted text-primary font-medium">
            <item.icon className="mr-2 h-4 w-4" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-4 py-3">
        {!collapsed && <span className="text-sm font-bold tracking-tight text-primary">VendorHub</span>}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Principale</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(mainNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showConfig && (
          <SidebarGroup>
            <SidebarGroupLabel>Configurazione</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(configNav)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {showAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(adminNav)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

export default function InternalLayout() {
  const { profile, signOut } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <InternalSidebarContent />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b px-4 bg-card">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              {profile && (
                <span className="text-sm font-medium text-muted-foreground hidden sm:inline">
                  {profile.full_name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <Button variant="ghost" size="icon" onClick={signOut} title="Esci">
                <LogOut className="h-4 w-4" />
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
