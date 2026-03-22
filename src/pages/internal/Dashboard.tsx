import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { dashboardService } from "@/services/dashboardService";
import { useGrants } from "@/hooks/useGrants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SUPPLIER_STATUS_LABELS_PLURAL } from "@/lib/supplierStatusConfig";
import {
  Building2, FileWarning, Briefcase, ShoppingCart, FileText,
  AlertTriangle, ArrowRight, UserCheck, Unlock, Clock, ClipboardCheck, PauseCircle,
  Eye,
} from "lucide-react";

const REFETCH_MS = 5 * 60 * 1000;

const oppStatusLabels: Record<string, string> = {
  draft: "Bozza",
  pending_approval: "In approvazione",
  open: "Aperte",
  collecting_bids: "Raccolta offerte",
  evaluating: "In valutazione",
  awarded: "Aggiudicate",
  closed: "Chiuse",
  cancelled: "Annullate",
};

function KpiCard({
  title, value, icon: Icon, alert, subtitle,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  alert?: boolean;
  subtitle?: string;
}) {
  return (
    <Card className={alert ? "border-destructive/50 bg-destructive/5" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${alert ? "text-destructive" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

export default function InternalDashboard() {
  const { hasGrant } = useGrants();

  const { data: supplierStats, isLoading: loadingSuppliers } = useQuery({
    queryKey: ["dashboard", "suppliers-by-status"],
    queryFn: () => dashboardService.suppliersByStatus(),
    refetchInterval: REFETCH_MS,
  });

  const { data: expiringDocs = 0, isLoading: loadingDocs } = useQuery({
    queryKey: ["dashboard", "expiring-docs"],
    queryFn: () => dashboardService.expiringDocuments(30),
    refetchInterval: REFETCH_MS,
  });

  const { data: oppStats, isLoading: loadingOpp } = useQuery({
    queryKey: ["dashboard", "opportunities-by-status"],
    queryFn: () => dashboardService.opportunitiesByStatus(),
    enabled: hasGrant("view_bids"),
    refetchInterval: REFETCH_MS,
  });

  const { data: activeContracts = 0 } = useQuery({
    queryKey: ["dashboard", "active-contracts"],
    queryFn: () => dashboardService.activeContracts(),
    enabled: hasGrant("view_orders"),
    refetchInterval: REFETCH_MS,
  });

  const { data: pendingBillings = 0 } = useQuery({
    queryKey: ["dashboard", "pending-billings"],
    queryFn: () => dashboardService.pendingBillingApprovals(),
    enabled: hasGrant("view_orders"),
    refetchInterval: REFETCH_MS,
  });

  const { data: lowBudget = 0 } = useQuery({
    queryKey: ["dashboard", "low-budget"],
    queryFn: () => dashboardService.lowBudgetContracts(),
    enabled: hasGrant("view_orders"),
    refetchInterval: REFETCH_MS,
  });

  const { data: recentOpps = [] } = useQuery({
    queryKey: ["dashboard", "recent-opportunities"],
    queryFn: () => dashboardService.recentOpportunities(5),
    refetchInterval: REFETCH_MS,
  });

  const { data: recentBillings = [] } = useQuery({
    queryKey: ["dashboard", "recent-billings"],
    queryFn: () => dashboardService.recentPendingBillings(5),
    enabled: hasGrant("approve_billing_approval"),
    refetchInterval: REFETCH_MS,
  });

  const totalSuppliers = supplierStats?.reduce((s, r) => s + r.count, 0) ?? 0;
  const getCount = (status: string) => supplierStats?.find((r) => r.status === status)?.count ?? 0;

  const supplierKpis: {
    key: string; title: string; icon: React.ElementType; alert?: boolean; subtitle?: string;
  }[] = [
    { key: "_total", title: "Fornitori totali", icon: Building2 },
    { key: "pre_registered", title: "Pre-registrati", icon: Clock },
    { key: "enabled", title: "Abilitati", icon: Unlock },
    { key: "in_accreditation", title: "In accreditamento", icon: ClipboardCheck },
    { key: "in_approval", title: "In approvazione", icon: ClipboardCheck },
    { key: "accredited", title: "Accreditati", icon: UserCheck },
    { key: "suspended", title: "Sospesi", icon: PauseCircle, alert: true },
    { key: "_docs", title: "Documenti in scadenza", icon: FileWarning, alert: expiringDocs > 0, subtitle: "Prossimi 30 giorni" },
  ];

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* ── Albo Fornitori ─── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="h-5 w-5" /> Albo Fornitori
        </h2>
        {loadingSuppliers || loadingDocs ? (
          <SkeletonCards count={6} />
        ) : (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {supplierKpis.map((kpi) => {
              const value = kpi.key === "_total"
                ? totalSuppliers
                : kpi.key === "_docs"
                ? expiringDocs
                : getCount(kpi.key);
              return (
                <KpiCard
                  key={kpi.key}
                  title={kpi.title}
                  value={value}
                  icon={kpi.icon}
                  alert={kpi.alert && value > 0}
                  subtitle={kpi.subtitle}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* ── Procurement ─── */}
      {hasGrant("view_bids") && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Briefcase className="h-5 w-5" /> Procurement
          </h2>
          {loadingOpp ? (
            <SkeletonCards count={4} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(oppStats ?? []).map((r) => (
                <KpiCard
                  key={r.status}
                  title={statusLabels[r.status] ?? r.status}
                  value={r.count}
                  icon={Briefcase}
                />
              ))}
              {(!oppStats || oppStats.length === 0) && (
                <p className="text-sm text-muted-foreground col-span-full">
                  Nessuna opportunità registrata.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Economici ─── */}
      {hasGrant("view_orders") && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Indicatori Economici
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard title="Contratti attivi" value={activeContracts} icon={ShoppingCart} />
            <KpiCard
              title="Benestare in approvazione"
              value={pendingBillings}
              icon={FileText}
              alert={pendingBillings > 0}
            />
            <KpiCard
              title="Contratti budget < 10%"
              value={lowBudget}
              icon={AlertTriangle}
              alert={lowBudget > 0}
              subtitle="Residuo quasi esaurito"
            />
          </div>
        </section>
      )}

      {/* ── Liste recenti ─── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Ultime opportunità</CardTitle>
            <Link
              to="/internal/opportunities"
              className="text-xs text-primary flex items-center gap-1 hover:underline"
            >
              Vedi tutte <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentOpps.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna opportunità.</p>
            ) : (
              <ul className="divide-y">
                {recentOpps.map((o) => (
                  <li key={o.id} className="py-2">
                    <Link
                      to={`/internal/opportunities/${o.id}`}
                      className="flex items-center justify-between hover:bg-muted/50 -mx-2 px-2 py-1 rounded transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{o.title}</p>
                        <p className="text-xs text-muted-foreground">{o.code}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 ml-2 text-[11px]">
                        {statusLabels[o.status] ?? o.status}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {hasGrant("approve_billing_approval") && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Benestare da approvare</CardTitle>
              <Link
                to="/internal/billing-approvals"
                className="text-xs text-primary flex items-center gap-1 hover:underline"
              >
                Vedi tutti <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {recentBillings.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun benestare in attesa.</p>
              ) : (
                <ul className="divide-y">
                  {recentBillings.map((b: any) => (
                    <li key={b.id} className="py-2">
                      <Link
                        to="/internal/billing-approvals"
                        className="flex items-center justify-between hover:bg-muted/50 -mx-2 px-2 py-1 rounded transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{b.code ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {b.suppliers?.company_name ?? "—"}
                          </p>
                        </div>
                        <span className="text-sm font-medium tabular-nums shrink-0 ml-2">
                          €{Number(b.amount).toLocaleString("it-IT", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
