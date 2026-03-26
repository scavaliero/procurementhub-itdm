import { Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Building2, Briefcase, ShoppingCart, FileText,
  Settings, ShieldCheck, Users, ScrollText, ClipboardList, CheckSquare, Package, CreditCard,
} from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import { NavLink } from "@/components/NavLink";
import { useGrants } from "@/hooks/useGrants";
import { usePurchaseRequests } from "@/hooks/usePurchasing";
import { NotificationBell } from "@/components/NotificationBell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
  { title: "Audit Log", url: "/internal/admin/audit-logs", icon: ScrollText, grant: "view_audit_logs" },
];

function InternalSidebarContent() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { hasGrant } = useGrants();

  const showConfig = hasGrant("manage_document_types") || hasGrant("manage_categories");
  const showAdmin = hasGrant("manage_roles") || hasGrant("manage_users") || hasGrant("view_audit_logs");

  const renderItems = (items: typeof adminNav) =>
    items
      .filter((item) => !("grant" in item) || !item.grant || hasGrant(item.grant))
      .map((item) => {
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
    });

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
              Procurement Hub
            </span>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40 px-4 mb-1">
            Principale
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(mainNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Ufficio Acquisti */}
        {(hasGrant("create_purchase_request") || hasGrant("view_own_purchase_requests") ||
          hasGrant("validate_purchase_request") || hasGrant("validate_purchase_request_high") ||
          hasGrant("manage_purchase_operations") || hasGrant("view_purchase_panel")) && (
          <PurchasingSidebarSection collapsed={collapsed} hasGrant={hasGrant} />
        )}

        {showConfig && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40 px-4 mb-1 mt-2">
              Configurazione
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(configNav)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {showAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40 px-4 mb-1 mt-2">
              Admin
            </SidebarGroupLabel>
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
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <InternalSidebarContent />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between px-4 bg-primary text-primary-foreground shadow-md">
            <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10" />
            <div className="flex items-center gap-1">
              <NotificationBell />
              <UserMenu basePath="/internal" />
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
