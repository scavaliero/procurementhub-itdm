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
  title, value, icon: Icon, alert, subtitle, cardClass,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  alert?: boolean;
  subtitle?: string;
  cardClass?: string;
}) {
  return (
    <Card className={`shadow-sm hover:shadow-md transition-shadow ${cardClass ?? ""} ${alert ? "border-destructive/40 bg-destructive/5" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${alert ? "bg-destructive/10" : "bg-primary/8"}`}>
          <Icon className={`h-4 w-4 ${alert ? "text-destructive" : "text-primary"}`} />
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
}

function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
  icon, title, variant = "default",
}: {
  icon: string;
  title: string;
  variant?: "default" | "green";
}) {
  return (
    <h2 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${
      variant === "green" ? "section-accent-bar-green" : "section-accent-bar"
    }`}>
      <span className="text-base">{icon}</span>
      {title}
    </h2>
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
    { key: "pending_review", title: "In revisione", icon: Eye },
    { key: "enabled", title: "Abilitati", icon: Unlock },
    { key: "in_accreditation", title: "In accreditamento", icon: ClipboardCheck },
    { key: "accredited", title: "Accreditati", icon: UserCheck },
    { key: "suspended", title: "Sospesi", icon: PauseCircle, alert: true },
    { key: "_docs", title: "Documenti in scadenza", icon: FileWarning, alert: expiringDocs > 0, subtitle: "Prossimi 30 giorni" },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-8">
      {/* ── Albo Fornitori ─── */}
      <section className="space-y-4">
        <SectionHeader icon="🏢" title="Albo Fornitori" />
        {loadingSuppliers || loadingDocs ? (
          <SkeletonCards count={6} />
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
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
                  cardClass="card-top-suppliers"
                />
              );
            })}
          </div>
        )}
      </section>

      {/* ── Procurement ─── */}
      {hasGrant("view_bids") && (
        <section className="space-y-4">
          <SectionHeader icon="📋" title="Procurement" variant="green" />
          {loadingOpp ? (
            <SkeletonCards count={4} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(oppStats ?? []).map((r) => (
                <KpiCard
                  key={r.status}
                  title={oppStatusLabels[r.status] ?? r.status}
                  value={r.count}
                  icon={Briefcase}
                  cardClass="card-top-procurement"
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
        <section className="space-y-4">
          <SectionHeader icon="💰" title="Indicatori Economici" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard title="Contratti attivi" value={activeContracts} icon={ShoppingCart} cardClass="card-top-economic" />
            <KpiCard
              title="Benestare in approvazione"
              value={pendingBillings}
              icon={FileText}
              alert={pendingBillings > 0}
              cardClass="card-top-economic"
            />
            <KpiCard
              title="Contratti budget < 10%"
              value={lowBudget}
              icon={AlertTriangle}
              alert={lowBudget > 0}
              subtitle="Residuo quasi esaurito"
              cardClass="card-top-economic"
            />
          </div>
        </section>
      )}

      {/* ── Liste recenti ─── */}
      <section className="space-y-4">
        <SectionHeader icon="📌" title="Attività Recenti" variant="green" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30">
              <CardTitle className="text-sm font-semibold">Ultime opportunità</CardTitle>
              <Link
                to="/internal/opportunities"
                className="text-xs text-primary flex items-center gap-1 hover:underline font-medium"
              >
                Vedi tutte <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="pt-3">
              {recentOpps.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nessuna opportunità.</p>
              ) : (
                <ul className="divide-y">
                  {recentOpps.map((o) => (
                    <li key={o.id} className="py-2.5 first:pt-0 last:pb-0">
                      <Link
                        to={`/internal/opportunities/${o.id}`}
                        className="flex items-center justify-between hover:bg-muted/50 -mx-2 px-2 py-1 rounded-md transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{o.title}</p>
                          <p className="text-xs text-muted-foreground">{o.code}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0 ml-2 text-[11px]">
                          {oppStatusLabels[o.status] ?? o.status}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {hasGrant("approve_billing_approval") && (
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30">
                <CardTitle className="text-sm font-semibold">Benestare da approvare</CardTitle>
                <Link
                  to="/internal/billing-approvals"
                  className="text-xs text-primary flex items-center gap-1 hover:underline font-medium"
                >
                  Vedi tutti <ArrowRight className="h-3 w-3" />
                </Link>
              </CardHeader>
              <CardContent className="pt-3">
                {recentBillings.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nessun benestare in attesa.</p>
                ) : (
                  <ul className="divide-y">
                    {recentBillings.map((b: any) => (
                      <li key={b.id} className="py-2.5 first:pt-0 last:pb-0">
                        <Link
                          to="/internal/billing-approvals"
                          className="flex items-center justify-between hover:bg-muted/50 -mx-2 px-2 py-1 rounded-md transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{b.code ?? "—"}</p>
                            <p className="text-xs text-muted-foreground">
                              {b.suppliers?.company_name ?? "—"}
                            </p>
                          </div>
                          <span className="text-sm font-semibold tabular-nums shrink-0 ml-2">
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
      </section>
    </div>
  );
}
