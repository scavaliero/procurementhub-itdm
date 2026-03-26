import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { billingApprovalService } from "@/services/billingApprovalService";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { format } from "date-fns";
import { ExternalLink, Search, FileCheck, Receipt, CheckCircle2, Lock } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  approved: "Approvato",
  invoiced: "Fatturato",
  closed: "Chiuso",
};

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  invoiced: "bg-blue-100 text-blue-700",
  closed: "bg-teal-100 text-teal-700",
};

export default function SupplierBillingApprovals() {
  const { profile } = useAuth();
  const navigate = useNavigate();
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

  const { data: billings = [], isLoading } = useQuery({
    queryKey: ["supplier-billings"],
    queryFn: () => billingApprovalService.listForSupplierWithOrder(profile?.supplier_id ?? ""),
    enabled: !!profile?.supplier_id,
  });

  // KPI counts
  const kpiCounts = useMemo(() => {
    let total = 0, approved = 0, invoiced = 0, closed = 0;
    for (const b of billings as any[]) {
      total++;
      if (b.status === "approved") approved++;
      if (b.status === "invoiced") invoiced++;
      if (b.status === "closed") closed++;
    }
    return { total, approved, invoiced, closed };
  }, [billings]);

  // Filtered list
  const filteredBillings = useMemo(() => {
    return (billings as any[]).filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const haystack = `${b.code ?? ""} ${b.orders?.code ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [billings, statusFilter, searchQuery]);

  if (isLoading) {
    return <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  const kpiCards = [
    { key: "all", label: "Totale", value: kpiCounts.total, icon: FileCheck, color: "text-blue-600", bg: "bg-blue-100" },
    { key: "approved", label: "Approvati", value: kpiCounts.approved, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100" },
    { key: "invoiced", label: "Fatturati", value: kpiCounts.invoiced, icon: Receipt, color: "text-blue-600", bg: "bg-blue-100" },
    { key: "closed", label: "Chiusi", value: kpiCounts.closed, icon: Lock, color: "text-teal-600", bg: "bg-teal-100" },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 min-w-0 overflow-hidden">
      <h1 className="text-2xl font-bold">Benestare di Fatturazione</h1>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => {
          const isSelected = statusFilter === kpi.key;
          const Icon = kpi.icon;
          return (
            <Card
              key={kpi.key}
              className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${
                isSelected && kpi.key !== "all" ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => updateParams({ status: kpi.key === "all" ? "all" : (statusFilter === kpi.key ? "all" : kpi.key) })}
              data-testid={`sup-billing-kpi-${kpi.key}`}
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
            placeholder="Cerca codice benestare, ordine…"
            value={searchQuery}
            onChange={(e) => updateParams({ q: e.target.value })}
            className="pl-9"
            data-testid="sup-billing-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => updateParams({ status: v })}>
          <SelectTrigger className="w-[200px]" data-testid="sup-billing-status-filter">
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

      {filteredBillings.length === 0 ? (
        <EmptyState title="Nessun benestare" description="Non ci sono benestare che corrispondono ai filtri." />
      ) : (
        <Card className="card-top-billing">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Ordine</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead className="text-right">Importo (€)</TableHead>
                  <TableHead className="text-right">Residuo ordine (€)</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-center">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBillings.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-sm">{b.code ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 h-auto text-xs"
                        onClick={() => navigate(`/supplier/orders`)}
                      >
                        {b.orders?.code ?? "—"}
                      </Button>
                    </TableCell>
                    <TableCell className="text-sm">
                      {b.period_start && b.period_end
                        ? `${format(new Date(b.period_start), "dd/MM/yy")} – ${format(new Date(b.period_end), "dd/MM/yy")}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      € {Number(b.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {b.residual_amount != null
                        ? `€ ${Number(b.residual_amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-700"}>
                        {STATUS_LABELS[b.status] ?? b.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {b.created_at ? format(new Date(b.created_at), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/supplier/billing-approvals/${b.id}`)}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Dettaglio
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
