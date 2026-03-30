import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { orderService } from "@/services/orderService";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { Check, X, Search, ShoppingCart, Clock, PlayCircle, CheckCircle } from "lucide-react";
import { format } from "date-fns";

const STATUS_LABELS: Record<string, string> = {
  draft: "Bozza",
  pending_approval: "In approvazione",
  issued: "Emesso",
  accepted: "Accettato",
  rejected: "Rifiutato",
  in_progress: "In corso",
  completed: "Completato",
};

const STATUS_COLORS: Record<string, string> = {
  issued: "bg-blue-100 text-blue-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  in_progress: "bg-purple-100 text-purple-700",
  completed: "bg-teal-100 text-teal-700",
  pending_approval: "bg-amber-100 text-amber-700",
};

const FILTER_STATUS_LABELS: Record<string, string> = {
  issued: "Emesso",
  in_progress: "In corso",
  completed: "Completato",
  rejected: "Rifiutato",
};

export default function SupplierOrders() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [rejectDialog, setRejectDialog] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
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
    queryKey: ["supplier-orders"],
    queryFn: () => orderService.listForSupplier(profile?.supplier_id ?? ""),
    enabled: !!profile?.supplier_id,
  });

  // KPI counts
  const kpiCounts = useMemo(() => {
    let toAction = 0, inProgress = 0, accepted = 0, completed = 0;
    for (const o of orders as any[]) {
      if (o.status === "issued") toAction++;
      if (o.status === "in_progress") inProgress++;
      if (o.status === "accepted") accepted++;
      if (o.status === "completed") completed++;
    }
    return { toAction, inProgress, accepted, completed };
  }, [orders]);

  // Filtered list
  const filteredOrders = useMemo(() => {
    return (orders as any[]).filter((o) => {
      if (statusFilter === "to_action") {
        if (o.status !== "issued") return false;
      } else if (statusFilter !== "all" && o.status !== statusFilter) {
        return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const haystack = `${o.code ?? ""} ${o.subject ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [orders, statusFilter, searchQuery]);

  const acceptMutation = useMutation({
    mutationFn: (orderId: string) => orderService.acceptOrder(orderId, profile!.tenant_id),
    onSuccess: () => {
      toast.success("Ordine accettato");
      qc.invalidateQueries({ queryKey: ["supplier-orders"] });
    },
    onError: (err: any) => toast.error(err.message || "Errore"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      orderService.rejectOrder(orderId, profile!.tenant_id, reason),
    onSuccess: () => {
      toast.success("Ordine rifiutato");
      qc.invalidateQueries({ queryKey: ["supplier-orders"] });
      setRejectDialog(null);
      setRejectReason("");
    },
    onError: (err: any) => toast.error(err.message || "Errore"),
  });

  if (isLoading) {
    return <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  const kpiCards = [
    { key: "to_action", label: "Da gestire", value: kpiCounts.toAction, icon: Clock, color: "text-amber-600", bg: "bg-amber-100", alert: true },
    { key: "in_progress", label: "In corso", value: kpiCounts.inProgress, icon: PlayCircle, color: "text-purple-600", bg: "bg-purple-100" },
    { key: "completed", label: "Completati", value: kpiCounts.completed, icon: CheckCircle, color: "text-teal-600", bg: "bg-teal-100" },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Ordini ricevuti</h1>

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
              } ${kpi.alert && kpi.value > 0 ? "border-amber-400/40 bg-amber-50" : ""}`}
              onClick={() => updateParams({ status: isSelected ? "all" : kpi.key })}
              data-testid={`sup-orders-kpi-${kpi.key}`}
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
            placeholder="Cerca codice, oggetto…"
            value={searchQuery}
            onChange={(e) => updateParams({ q: e.target.value })}
            className="pl-9"
            data-testid="sup-orders-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => updateParams({ status: v })}>
          <SelectTrigger className="w-[200px]" data-testid="sup-orders-status-filter">
            <SelectValue placeholder="Tutti gli stati" />
          </SelectTrigger>
          <SelectContent position="popper" side="bottom" align="start" sideOffset={4} avoidCollisions={false}>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {Object.entries(FILTER_STATUS_LABELS).map(([key, label]) => (
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
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Importo (€)</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-center">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((o: any) => (
                  <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/supplier/orders/${o.id}`)}>
                    <TableCell className="font-mono text-sm">{o.code ?? "—"}</TableCell>
                    <TableCell className="font-medium">{o.subject}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_COLORS[o.status] ?? ""}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      € {Number(o.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.start_date && o.end_date
                        ? `${format(new Date(o.start_date), "dd/MM/yy")} – ${format(new Date(o.end_date), "dd/MM/yy")}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {o.status === "issued" ? (
                        <div className="flex gap-1 justify-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-emerald-600"
                            onClick={() => acceptMutation.mutate(o.id)}
                            disabled={acceptMutation.isPending}
                          >
                            <Check className="h-4 w-4 mr-1" /> Accetta
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setRejectDialog(o.id)}
                          >
                            <X className="h-4 w-4 mr-1" /> Rifiuta
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Reject dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => { setRejectDialog(null); setRejectReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rifiuta ordine</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Motivazione *</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Inserisci la motivazione del rifiuto..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialog(null); setRejectReason(""); }}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              onClick={() => {
                if (rejectDialog) {
                  rejectMutation.mutate({ orderId: rejectDialog, reason: rejectReason });
                }
              }}
            >
              Conferma rifiuto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
