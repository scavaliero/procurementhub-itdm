import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useAuth } from "@/hooks/useAuth";
import { useGrants } from "@/hooks/useGrants";
import { usePurchaseRequests } from "@/hooks/usePurchasing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency, formatDateIT } from "@/utils/formatters";
import { Plus, Search, Clock, CheckCircle, FileText } from "lucide-react";
import type { PurchaseRequest } from "@/types/purchasing";

const STATUS_LABELS: Record<string, string> = {
  draft: "Bozza",
  submitted: "Inviata",
  pending_validation: "Attesa Finance",
  approved: "Approvata",
  approved_finance: "Approvata Finance",
  rejected: "Respinta",
  in_purchase: "In acquisto",
  completed: "Completata",
  cancelled: "Annullata",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  pending_validation: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  approved_finance: "bg-teal-100 text-teal-700",
  rejected: "bg-red-100 text-red-700",
  in_purchase: "bg-purple-100 text-purple-700",
  completed: "bg-green-200 text-green-800",
  cancelled: "bg-gray-200 text-gray-600",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Bassa",
  normal: "Normale",
  high: "Alta",
  urgent: "Urgente",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  normal: "bg-blue-50 text-blue-600",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export default function PurchaseRequestsPage() {
  const { profile } = useAuth();
  const { hasGrant } = useGrants();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const viewMode = searchParams.get("view") || "";
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

  // Determine query filters based on grants
  const isValidator = hasGrant("validate_purchase_request") || hasGrant("validate_purchase_request_high");
  const isOperator = hasGrant("manage_purchase_operations");
  const isRequester = hasGrant("view_own_purchase_requests") && !isValidator && !isOperator;

  const queryFilters = useMemo(() => {
    if (viewMode === "mine") return { mine: true };
    if (isRequester) return { mine: true };
    return {};
  }, [isRequester, viewMode]);

  const { data: requests = [], isLoading } = usePurchaseRequests(queryFilters);

  // Client-side filtering for operator (show only relevant statuses)
  const visibleRequests = useMemo(() => {
    let list = requests as PurchaseRequest[];

    // view=validate → show only requests pending validation
    if (viewMode === "validate") {
      list = list.filter((r) =>
        ["submitted", "pending_validation"].includes(r.status)
      );
    }
    // Operators only see actionable statuses
    else if (isOperator && !isValidator) {
      list = list.filter((r) =>
        ["approved", "approved_finance", "in_purchase", "completed"].includes(r.status)
      );
    }

    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          (r.code ?? "").toLowerCase().includes(q) ||
          r.subject.toLowerCase().includes(q) ||
          (r.requester?.full_name ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [requests, statusFilter, searchQuery, isOperator, isValidator, viewMode]);

  // KPI counts
  const kpiCounts = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let pending = 0, approvedMonth = 0, totalMonth = 0;

    for (const r of requests as PurchaseRequest[]) {
      if (["submitted", "pending_validation"].includes(r.status)) pending++;
      if (
        ["approved", "approved_finance"].includes(r.status) &&
        r.validated_at && new Date(r.validated_at) >= startOfMonth
      ) {
        approvedMonth++;
        totalMonth += Number(r.amount);
      }
    }
    return { pending, approvedMonth, totalMonth };
  }, [requests]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const showKpi = isValidator || isOperator;

  const kpiCards = [
    { key: "pending", label: "In attesa", value: kpiCounts.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-100" },
    { key: "approved_month", label: "Approvate (mese)", value: kpiCounts.approvedMonth, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-100" },
    { key: "total_month", label: "Importo mese", value: formatCurrency(kpiCounts.totalMonth), icon: FileText, color: "text-blue-600", bg: "bg-blue-100", isText: true },
  ];

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/internal/dashboard" },
          { label: "Richieste di Acquisto" },
        ]}
      />
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
          <span className="text-base">📋</span>
          Richieste di Acquisto
        </h2>
        {hasGrant("create_purchase_request") && (
          <Button onClick={() => navigate("/internal/purchasing/requests/new")}>
            <Plus className="h-4 w-4 mr-1" /> Nuova richiesta
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      {showKpi && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          {kpiCards.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.key} className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {kpi.label}
                  </CardTitle>
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${kpi.bg}`}>
                    <Icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums">
                    {kpi.isText ? kpi.value : kpi.value}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca codice, oggetto, richiedente…"
            value={searchQuery}
            onChange={(e) => updateParams({ q: e.target.value })}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => updateParams({ status: v })}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tutti gli stati" />
          </SelectTrigger>
          <SelectContent position="popper" side="bottom" align="start" sideOffset={4} avoidCollisions={false}>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {visibleRequests.length === 0 ? (
        <EmptyState title="Nessuna richiesta" description="Non ci sono richieste che corrispondono ai filtri." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Oggetto</TableHead>
                  <TableHead className="text-right">Importo</TableHead>
                  <TableHead>Priorità</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Richiedente</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRequests.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/internal/purchasing/requests/${r.id}`)}
                  >
                    <TableCell className="font-mono text-sm">{r.code ?? "—"}</TableCell>
                    <TableCell className="font-medium max-w-[250px] truncate">{r.subject}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(r.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={PRIORITY_COLORS[r.priority] ?? ""}>
                        {PRIORITY_LABELS[r.priority] ?? r.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_COLORS[r.status] ?? ""}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{r.requester?.full_name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateIT(r.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
