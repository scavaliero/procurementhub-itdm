import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useGrants } from "@/hooks/useGrants";
import { usePurchaseRequests, useSetInPurchase } from "@/hooks/usePurchasing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency, formatDateIT } from "@/utils/formatters";
import { ShoppingCart, Briefcase, CheckCircle } from "lucide-react";
import { useState } from "react";
import type { PurchaseRequest } from "@/types/purchasing";

export default function PurchasePanelPage() {
  const navigate = useNavigate();
  const { hasGrant } = useGrants();
  const inPurchaseMut = useSetInPurchase();

  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data: allRequests = [], isLoading } = usePurchaseRequests();

  const sections = useMemo(() => {
    const list = allRequests as PurchaseRequest[];
    const toPickUp = list.filter((r) => ["approved", "approved_finance"].includes(r.status));
    const inProgress = list.filter((r) => r.status === "in_purchase");
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const completed = list.filter(
      (r) => r.status === "completed" && r.updated_at && new Date(r.updated_at) >= thirtyDaysAgo
    );
    return { toPickUp, inProgress, completed };
  }, [allRequests]);

  const handleConfirmPickUp = async () => {
    if (!confirmId) return;
    await inPurchaseMut.mutateAsync(confirmId);
    setConfirmId(null);
  };

  if (!hasGrant("manage_purchase_operations") && !hasGrant("view_purchase_panel")) {
    return <EmptyState title="Accesso negato" description="Non hai i permessi per visualizzare questa pagina." />;
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const kpiCounts = useMemo(() => ({
    toPickUp: sections.toPickUp.length,
    inProgress: sections.inProgress.length,
    completed: sections.completed.length,
  }), [sections]);

  const kpiCards = [
    { key: "toPickUp", label: "Da prendere in carico", value: kpiCounts.toPickUp, icon: ShoppingCart, color: "text-amber-600", bg: "bg-amber-100", alert: true },
    { key: "inProgress", label: "In lavorazione", value: kpiCounts.inProgress, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-100" },
    { key: "completed", label: "Completate (30gg)", value: kpiCounts.completed, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-100" },
  ];

  return (
    <div className="p-6 space-y-8">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/internal/dashboard" },
          { label: "Pannello Acquisti" },
        ]}
      />
      <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
        <span className="text-base">🛒</span> Pannello Acquisti
      </h2>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card
              key={kpi.key}
              className={`shadow-sm transition-all hover:shadow-md ${
                kpi.alert && kpi.value > 0 ? "border-amber-400/40 bg-amber-50" : ""
              }`}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {kpi.label}
                </CardTitle>
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${kpi.bg}`}>
                  <Icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">{kpi.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Section 1: Da prendere in carico */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Da prendere in carico
        </h3>
        {sections.toPickUp.length === 0 ? (
          <EmptyState title="Nessuna richiesta" description="Nessuna richiesta autorizzata in attesa." />
        ) : (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            {sections.toPickUp.map((r) => (
              <Card key={r.id} className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/internal/purchasing/requests/${r.id}`)}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium">{r.code ?? "—"}</span>
                    <span className="text-lg font-bold">{formatCurrency(r.amount)}</span>
                  </div>
                  <p className="text-sm font-medium truncate">{r.subject}</p>
                  <p className="text-xs text-muted-foreground">{r.requester?.full_name ?? "—"}</p>
                  {hasGrant("manage_purchase_operations") && (
                    <Button
                      size="sm"
                      className="w-full mt-2"
                      disabled={inPurchaseMut.isPending}
                      onClick={(e) => { e.stopPropagation(); setConfirmId(r.id); }}
                    >
                      <ShoppingCart className="h-4 w-4 mr-1" /> Prendi in carico
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: In lavorazione */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          In lavorazione
        </h3>
        {sections.inProgress.length === 0 ? (
          <EmptyState title="Nessun acquisto" description="Nessun acquisto in lavorazione." />
        ) : (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            {sections.inProgress.map((r) => (
              <Card key={r.id} className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/internal/purchasing/requests/${r.id}`)}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium">{r.code ?? "—"}</span>
                    <span className="text-lg font-bold">{formatCurrency(r.amount)}</span>
                  </div>
                  <p className="text-sm font-medium truncate">{r.subject}</p>
                  <p className="text-xs text-muted-foreground">{r.requester?.full_name ?? "—"}</p>
                  {hasGrant("manage_purchase_operations") && (
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" className="flex-1"
                        onClick={(e) => { e.stopPropagation(); navigate(`/internal/opportunities/new?from_request=${r.id}`); }}>
                        <Briefcase className="h-4 w-4 mr-1" /> Opportunità
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1"
                        onClick={(e) => { e.stopPropagation(); navigate(`/internal/purchasing/direct/new/${r.id}`); }}>
                        <ShoppingCart className="h-4 w-4 mr-1" /> Diretto
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Completate */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Completate (ultimi 30 giorni)
        </h3>
        {sections.completed.length === 0 ? (
          <EmptyState title="Nessuna completata" description="Nessuna richiesta completata negli ultimi 30 giorni." />
        ) : (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            {sections.completed.map((r) => (
              <Card key={r.id} className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/internal/purchasing/requests/${r.id}`)}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium">{r.code ?? "—"}</span>
                    <Badge variant="secondary" className={
                      r.outcome === "opportunity" ? "bg-teal-100 text-teal-700" : "bg-blue-100 text-blue-700"
                    }>
                      {r.outcome === "opportunity" ? "Via gara" : "Acquisto diretto"}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium truncate">{r.subject}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{r.requester?.full_name ?? "—"}</span>
                    <span>{formatCurrency(r.amount)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      <Dialog open={!!confirmId} onOpenChange={() => setConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prendi in carico</DialogTitle>
            <DialogDescription>Lo stato passerà a "In acquisto". Confermi?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmId(null)}>Annulla</Button>
            <Button onClick={handleConfirmPickUp} disabled={inPurchaseMut.isPending}>Conferma</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
