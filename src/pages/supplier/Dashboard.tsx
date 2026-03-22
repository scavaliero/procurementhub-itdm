import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { dashboardService } from "@/services/dashboardService";
import { useAuth } from "@/hooks/useAuth";
import { SUPPLIER_STATUS_CONFIG } from "@/lib/supplierStatusConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2, FileText, Briefcase, ShoppingCart, FileCheck,
  ArrowRight, Eye,
} from "lucide-react";

const REFETCH_MS = 5 * 60 * 1000;

function KpiCard({
  title, value, icon: Icon, subtitle, to, cardClass,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  subtitle?: string;
  to?: string;
  cardClass?: string;
}) {
  const content = (
    <Card className={`shadow-sm hover:shadow-md transition-shadow ${cardClass ?? ""} ${to ? "cursor-pointer" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-primary/8">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );

  if (to) return <Link to={to}>{content}</Link>;
  return content;
}

function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="shadow-sm">
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SectionHeader({
  icon, title, variant = "default", action,
}: {
  icon: string;
  title: string;
  variant?: "default" | "green";
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${
        variant === "green" ? "section-accent-bar-green" : "section-accent-bar"
      }`}>
        <span className="text-base">{icon}</span>
        {title}
      </h2>
      {action}
    </div>
  );
}

export default function SupplierDashboard() {
  const { profile } = useAuth();
  const supplierId = profile?.supplier_id;

  const { data: supplierInfo, isLoading: loadingStatus } = useQuery({
    queryKey: ["dashboard", "supplier-status", supplierId],
    queryFn: () => dashboardService.supplierStatus(supplierId!),
    enabled: !!supplierId,
    refetchInterval: REFETCH_MS,
  });

  const { data: pendingDocs = 0, isLoading: loadingDocs } = useQuery({
    queryKey: ["dashboard", "supplier-pending-docs", supplierId],
    queryFn: () => dashboardService.supplierPendingDocs(supplierId!),
    enabled: !!supplierId,
    refetchInterval: REFETCH_MS,
  });

  const { data: unseenInvites = 0, isLoading: loadingInvites } = useQuery({
    queryKey: ["dashboard", "supplier-unseen-invites", supplierId],
    queryFn: () => dashboardService.supplierUnseenInvitations(supplierId!),
    enabled: !!supplierId,
    refetchInterval: REFETCH_MS,
  });

  const { data: bidsMonth = 0, isLoading: loadingBids } = useQuery({
    queryKey: ["dashboard", "supplier-bids-month", supplierId],
    queryFn: () => dashboardService.supplierBidsThisMonth(supplierId!),
    enabled: !!supplierId,
    refetchInterval: REFETCH_MS,
  });

  const isLoading = loadingStatus || loadingDocs || loadingInvites || loadingBids;
  const statusInfo = SUPPLIER_STATUS_CONFIG[supplierInfo?.status ?? ""] ?? {
    label: supplierInfo?.status ?? "—",
    variant: "outline" as const,
  };

  return (
    <div className="p-4 sm:p-6 space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">
          Benvenuto, {supplierInfo?.company_name ?? profile?.full_name ?? ""}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Portale Fornitore — ITDM Group
        </p>
      </div>

      {/* ── Stato accreditamento ─── */}
      <section className="space-y-4">
        <SectionHeader icon="🏢" title="Stato Accreditamento" />
        {loadingStatus ? (
          <Skeleton className="h-14 w-48" />
        ) : (
          <Card className="shadow-sm inline-flex card-top-status">
            <CardContent className="py-4 px-6 flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Il tuo stato:</span>
              <Badge variant={statusInfo.variant} className="text-base px-3 py-1">
                {statusInfo.label}
              </Badge>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── KPIs ─── */}
      <section className="space-y-4">
        <SectionHeader icon="📊" title="Riepilogo" variant="green" />
        {isLoading ? (
          <SkeletonCards count={4} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <KpiCard
              title="Documenti non approvati"
              value={pendingDocs}
              icon={FileText}
              to="/supplier/documents"
              subtitle={pendingDocs > 0 ? "Da completare" : "Tutto in ordine"}
              cardClass="card-top-docs"
            />
            <KpiCard
              title="Opportunità da visionare"
              value={unseenInvites}
              icon={Eye}
              to="/supplier/opportunities"
              subtitle={unseenInvites > 0 ? "Nuovi inviti ricevuti" : "Nessun invito in attesa"}
              cardClass="card-top-opportunities"
            />
            <KpiCard
              title="Offerte inviate questo mese"
              value={bidsMonth}
              icon={Briefcase}
              to="/supplier/opportunities"
              cardClass="card-top-procurement"
            />
            <KpiCard
              title="Benestare"
              value="→"
              icon={FileCheck}
              to="/supplier/billing-approvals"
              subtitle="Visualizza benestare approvati"
              cardClass="card-top-billing"
            />
          </div>
        )}
      </section>

      {/* ── App rapide ─── */}
      <section className="space-y-4">
        <SectionHeader icon="⚡" title="App Rapide" />
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { title: "Profilo azienda", to: "/supplier/onboarding", icon: Building2 },
            { title: "Documenti", to: "/supplier/documents", icon: FileText },
            { title: "Opportunità", to: "/supplier/opportunities", icon: Briefcase },
            { title: "Ordini", to: "/supplier/orders", icon: ShoppingCart },
            { title: "Benestare", to: "/supplier/billing-approvals", icon: FileCheck },
          ].map((link) => (
            <Link key={link.to} to={link.to}>
              <Card className="shadow-sm hover:shadow-md transition-shadow text-center py-5 px-3 card-top-quick">
                <CardContent className="p-0 flex flex-col items-center gap-2.5">
                  <div className="h-12 w-12 rounded-xl bg-primary/8 flex items-center justify-center">
                    <link.icon className="h-6 w-6 text-primary" />
                  </div>
                  <span className="text-xs font-semibold leading-tight">{link.title}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
