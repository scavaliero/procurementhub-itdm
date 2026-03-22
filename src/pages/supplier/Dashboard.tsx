import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { dashboardService } from "@/services/dashboardService";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2, FileText, Briefcase, ShoppingCart, FileCheck,
  ArrowRight, Eye,
} from "lucide-react";

const REFETCH_MS = 5 * 60 * 1000;

const supplierStatusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pre_registered: { label: "Pre-registrato", variant: "outline" },
  enabled: { label: "Abilitato", variant: "secondary" },
  in_accreditation: { label: "In accreditamento", variant: "secondary" },
  in_approval: { label: "In approvazione", variant: "secondary" },
  pending_review: { label: "In revisione", variant: "secondary" },
  accredited: { label: "Accreditato", variant: "default" },
  suspended: { label: "Sospeso", variant: "destructive" },
  rejected: { label: "Respinto", variant: "destructive" },
  revoked: { label: "Revocato", variant: "destructive" },
};

function KpiCard({
  title, value, icon: Icon, subtitle, to,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  subtitle?: string;
  to?: string;
}) {
  const content = (
    <Card className={to ? "hover:shadow-md transition-shadow cursor-pointer" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
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
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
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
  const statusInfo = supplierStatusLabels[supplierInfo?.status ?? ""] ?? {
    label: supplierInfo?.status ?? "—",
    variant: "outline" as const,
  };

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Fornitore</h1>
        <p className="text-muted-foreground mt-1">
          Benvenuto, {supplierInfo?.company_name ?? profile?.full_name ?? ""}
        </p>
      </div>

      {/* ── Stato accreditamento ─── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="h-5 w-5" /> Stato Accreditamento
        </h2>
        {loadingStatus ? (
          <Skeleton className="h-14 w-48" />
        ) : (
          <Card className="inline-flex">
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
      {isLoading ? (
        <SkeletonCards count={4} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <KpiCard
            title="Documenti non approvati"
            value={pendingDocs}
            icon={FileText}
            to="/supplier/documents"
            subtitle={pendingDocs > 0 ? "Da completare" : "Tutto in ordine"}
          />
          <KpiCard
            title="Opportunità da visionare"
            value={unseenInvites}
            icon={Eye}
            to="/supplier/opportunities"
            subtitle={unseenInvites > 0 ? "Nuovi inviti ricevuti" : "Nessun invito in attesa"}
          />
          <KpiCard
            title="Offerte inviate questo mese"
            value={bidsMonth}
            icon={Briefcase}
            to="/supplier/opportunities"
          />
          <KpiCard
            title="Benestare"
            value="→"
            icon={FileCheck}
            to="/supplier/billing-approvals"
            subtitle="Visualizza benestare approvati"
          />
        </div>
      )}

      {/* ── Link rapidi ─── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Accesso rapido</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "Profilo azienda", to: "/supplier/onboarding", icon: Building2 },
            { title: "Documenti", to: "/supplier/documents", icon: FileText },
            { title: "Opportunità", to: "/supplier/opportunities", icon: Briefcase },
            { title: "Ordini", to: "/supplier/orders", icon: ShoppingCart },
            { title: "Benestari", to: "/supplier/billing-approvals", icon: FileCheck },
          ].map((link) => (
            <Link key={link.to} to={link.to}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="py-4 px-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <link.icon className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium">{link.title}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
