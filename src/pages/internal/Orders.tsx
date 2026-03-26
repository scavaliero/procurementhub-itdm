import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useNavigate, useSearchParams } from "react-router-dom";
import { orderService } from "@/services/orderService";
import { useAuth } from "@/hooks/useAuth";
import { useGrants } from "@/hooks/useGrants";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle, XCircle, Search, ShoppingCart, Clock, FileEdit, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CardHeader, CardTitle } from "@/components/ui/card";

const ACTIVE_STATUSES = ["issued", "accepted", "in_progress"];

const STATUS_LABELS: Record<string, string> = {
  active: "Attivi",
  low_budget: "Budget < 10%",
  draft: "Bozza",
  pending_approval: "In approvazione",
  issued: "Emesso",
  accepted: "Accettato",
  rejected: "Rifiutato",
  in_progress: "In corso",
  completed: "Completato",
  cancelled: "Annullato",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_approval: "bg-amber-100 text-amber-700",
  issued: "bg-blue-100 text-blue-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  in_progress: "bg-purple-100 text-purple-700",
  completed: "bg-teal-100 text-teal-700",
};

export default function InternalOrders() {
  const { profile } = useAuth();
  const { hasGrant } = useGrants();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const statusFilter = searchParams.get("status") || "all";
  const searchQuery = searchParams.get("q") || "";

  const updateParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v && v !== "all") next.set(k, v);
      else next.delete(k);
    });
    setSearchParams(next, { replace: true });
  };

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["internal-orders"],
    queryFn: () => orderService.listWithBillingInfo(profile?.tenant_id ?? ""),
    enabled: !!profile,
  });

  const filteredOrders = useMemo(() => {
    const isEffectivelyCompleted = (o: any) => {
      const billedTotal = o.billed_total ?? 0;
      return billedTotal >= Number(o.amount) && ["accepted", "in_progress"].includes(o.status);
    };

    return orders.filter((o: any) => {
      if (statusFilter === "active") {
        if (!ACTIVE_STATUSES.includes(o.status)) return false;
        // Exclude orders that are effectively completed (fully billed)
        if (isEffectivelyCompleted(o)) return false;
      } else if (statusFilter === "low_budget") {
        const billedTotal = o.billed_total ?? 0;
        const amount = Number(o.amount);
        if (amount <= 0) return false;
        const residualPct = ((amount - billedTotal) / amount) * 100;
        if (residualPct >= 10) return false;
        if (!ACTIVE_STATUSES.includes(o.status)) return false;
        if (isEffectivelyCompleted(o)) return false;
      } else if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const haystack = `${o.code ?? ""} ${o.subject ?? ""} ${o.suppliers?.company_name ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [orders, statusFilter, searchQuery]);

  // KPI counts computed from loaded orders
  const kpiCounts = useMemo(() => {
    const isEffectivelyCompleted = (o: any) => {
      const billedTotal = o.billed_total ?? 0;
      return billedTotal >= Number(o.amount) && ["accepted", "in_progress"].includes(o.status);
    };
    let active = 0, pendingApproval = 0, draft = 0, lowBudget = 0;
    for (const ord of orders as any[]) {
      if (ACTIVE_STATUSES.includes(ord.status) && !isEffectivelyCompleted(ord)) {
        active++;
        const billedTotal = ord.billed_total ?? 0;
        const amount = Number(ord.amount);
        if (amount > 0 && ((amount - billedTotal) / amount) * 100 < 10) lowBudget++;
      }
      if (ord.status === "pending_approval") pendingApproval++;
      if (ord.status === "draft") draft++;
    }
    return { active, pendingApproval, draft, lowBudget };
  }, [orders]);

  const approveMutation = useMutation({
    mutationFn: (orderId: string) => orderService.approveOrder(orderId, profile!.tenant_id, profile!.id),
    onSuccess: () => {
      toast.success("Ordine approvato e emesso");
      qc.invalidateQueries({ queryKey: ["internal-orders"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: (orderId: string) => orderService.rejectOrderByAdmin(orderId, profile!.tenant_id),
    onSuccess: () => {
      toast.success("Ordine rifiutato");
      qc.invalidateQueries({ queryKey: ["internal-orders"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canManage = hasGrant("manage_orders");

  if (isLoading) {
    return <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  const kpiCards = [
    { key: "active", label: "Attivi", value: kpiCounts.active, icon: ShoppingCart, color: "text-emerald-600", bg: "bg-emerald-100" },
    { key: "pending_approval", label: "In approvazione", value: kpiCounts.pendingApproval, icon: Clock, color: "text-amber-600", bg: "bg-amber-100" },
    { key: "draft", label: "Bozze", value: kpiCounts.draft, icon: FileEdit, color: "text-muted-foreground", bg: "bg-muted" },
    { key: "low_budget", label: "Budget < 10%", value: kpiCounts.lowBudget, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", alert: true },
  ];

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: "Dashboard", href: "/internal" }, { label: "Ordini" }]} />
      <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 section-accent-bar-green">
        <span className="text-base">🛒</span>
        Ordini
      </h2>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => {
          const isSelected = statusFilter === kpi.key;
          const Icon = kpi.icon;
          return (
            <Card
              key={kpi.key}
              className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${
                isSelected ? "ring-2 ring-primary" : ""
              } ${kpi.alert && kpi.value > 0 ? "border-destructive/40 bg-destructive/5" : ""}`}
              onClick={() => updateParams({ status: isSelected ? "all" : kpi.key })}
              data-testid={`orders-kpi-${kpi.key}`}
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

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca codice, oggetto, fornitore…"
            value={searchQuery}
            onChange={(e) => updateParams({ q: e.target.value })}
            className="pl-9"
            data-testid="orders-search"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => updateParams({ status: v })}
        >
          <SelectTrigger className="w-[200px]" data-testid="orders-status-filter">
            <SelectValue placeholder="Tutti gli stati" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredOrders.length === 0 ? (
        <EmptyState title="Nessun ordine" description="Non ci sono ordini che corrispondono ai filtri." />
      ) : (
        <Card className="card-top-orders">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Oggetto</TableHead>
                  <TableHead>Fornitore</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Importo (€)</TableHead>
                  <TableHead className="text-right">Fatturato (€)</TableHead>
                  <TableHead className="text-right">Residuo (€)</TableHead>
                  <TableHead>Data</TableHead>
                  {canManage && <TableHead className="text-center">Azioni</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((o: any) => {
                  const billedTotal = o.billed_total ?? 0;
                  const residual = Number(o.amount) - billedTotal;
                  const effectiveStatus = (billedTotal >= Number(o.amount) && ["accepted", "in_progress"].includes(o.status))
                    ? "completed"
                    : o.status;

                  return (
                    <TableRow
                      key={o.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/internal/orders/${o.id}`)}
                    >
                      <TableCell className="font-mono text-sm">{o.code ?? "—"}</TableCell>
                      <TableCell className="font-medium">{o.subject}</TableCell>
                      <TableCell>{o.suppliers?.company_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={STATUS_COLORS[effectiveStatus] ?? ""}>
                          {STATUS_LABELS[effectiveStatus] ?? effectiveStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        € {Number(o.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        € {billedTotal.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${residual <= 0 ? "text-emerald-600" : ""}`}>
                        € {residual.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {o.created_at ? format(new Date(o.created_at), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          {o.status === "pending_approval" ? (
                            <div className="flex gap-1 justify-center">
                              <Button
                                size="sm"
                                variant="default"
                                disabled={approveMutation.isPending || rejectMutation.isPending}
                                onClick={() => approveMutation.mutate(o.id)}
                              >
                                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approva
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={approveMutation.isPending || rejectMutation.isPending}
                                onClick={() => rejectMutation.mutate(o.id)}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Rifiuta
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
