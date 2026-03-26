import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { contractService } from "@/services/contractService";
import { useAuth } from "@/hooks/useAuth";
import { useGrants } from "@/hooks/useGrants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle, CheckCircle, XCircle, ExternalLink, Receipt } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  planned: "Pianificato",
  active: "Attivo",
  completed: "Completato",
  terminated: "Terminato",
};

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-gray-100 text-gray-700",
  active: "bg-emerald-100 text-emerald-700",
  completed: "bg-blue-100 text-blue-700",
  terminated: "bg-red-100 text-red-700",
};

function formatCurrency(v: number | null | undefined) {
  return `€ ${Number(v ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;
}

export default function InternalContractDetail() {
  const { id: contractId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { hasGrant } = useGrants();
  const qc = useQueryClient();

  const [terminateDialog, setTerminateDialog] = useState(false);
  const [terminateReason, setTerminateReason] = useState("");
  const [completeDialog, setCompleteDialog] = useState(false);

  const canManage = hasGrant("manage_orders");

  const { data: contract, isLoading: cLoading } = useQuery({
    queryKey: ["contract", contractId],
    queryFn: () => contractService.getById(contractId!),
    enabled: !!contractId,
  });

  const { data: summary, isLoading: sLoading } = useQuery({
    queryKey: ["contract-summary", contractId],
    queryFn: () => contractService.getEconomicSummary(contractId!),
    enabled: !!contractId,
  });

  const completeMutation = useMutation({
    mutationFn: () => contractService.completeContract(contractId!, profile!.tenant_id),
    onSuccess: () => {
      toast.success("Contratto completato");
      qc.invalidateQueries({ queryKey: ["contract", contractId] });
      setCompleteDialog(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const terminateMutation = useMutation({
    mutationFn: () => contractService.terminateContract(contractId!, profile!.tenant_id, terminateReason),
    onSuccess: () => {
      toast.success("Contratto terminato");
      qc.invalidateQueries({ queryKey: ["contract", contractId] });
      setTerminateDialog(false);
      setTerminateReason("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isLoading = cLoading || sLoading;

  if (isLoading) {
    return <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  if (!contract) {
    return <EmptyState title="Contratto non trovato" />;
  }

  const usedPct = summary ? Math.round(100 - (summary.residual_pct ?? 100)) : 0;
  const residualPct = summary?.residual_pct ?? 100;
  const barColor = usedPct >= 90 ? "bg-destructive" : usedPct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  const isActive = contract.status === "active";
  const isClosed = contract.status === "completed" || contract.status === "terminated";

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <Breadcrumb items={[{ label: "Dashboard", href: "/internal/dashboard" }, { label: "Ordini", href: "/internal/orders" }, { label: `Contratto — ${contract.orders?.code ?? "—"}` }]} />
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            Contratto — {contract.orders?.code ?? "—"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {contract.suppliers?.company_name ?? "—"} ·{" "}
            <Badge variant="secondary" className={STATUS_COLORS[contract.status] ?? ""}>
              {STATUS_LABELS[contract.status] ?? contract.status}
            </Badge>
          </p>
        </div>
      </div>

      {/* Action buttons */}
      {canManage && isActive && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setCompleteDialog(true)} className="gap-2">
            <CheckCircle className="h-4 w-4" /> Completa contratto
          </Button>
          <Button variant="destructive" onClick={() => setTerminateDialog(true)} className="gap-2">
            <XCircle className="h-4 w-4" /> Termina anticipatamente
          </Button>
          <Link to="/internal/billing-approvals">
            <Button variant="outline" className="gap-2">
              <Receipt className="h-4 w-4" /> Vai ai benestare
            </Button>
          </Link>
        </div>
      )}

      {residualPct < 10 && !isClosed && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Budget quasi esaurito — residuo inferiore al 10%</span>
        </div>
      )}

      {/* Metrics cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-top-economic">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground font-normal">Importo autorizzato</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatCurrency(summary?.current_authorized_amount)}</p>
          </CardContent>
        </Card>
        <Card className="card-top-economic">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground font-normal">Fatturato approvato</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatCurrency(summary?.approved_billing_total)}</p>
          </CardContent>
        </Card>
        <Card className="card-top-economic">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground font-normal">Residuo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatCurrency(summary?.residual_amount)}</p>
          </CardContent>
        </Card>
        <Card className="card-top-economic">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground font-normal">In approvazione</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">
              {formatCurrency(summary?.pending_approval_amount)}
              {summary?.pending_approval_count ? (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  ({summary.pending_approval_count})
                </span>
              ) : null}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage bar */}
      <Card className="card-top-economic">
        <CardHeader><CardTitle className="text-sm">Utilizzo budget</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Utilizzato: {usedPct}%</span>
            <span>Residuo: {residualPct?.toFixed(1)}%</span>
          </div>
          <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${Math.min(usedPct, 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Contract details */}
      <Card className="card-top-economic">
        <CardHeader><CardTitle className="text-sm">Dettagli</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Oggetto ordine</dt>
              <dd className="font-medium">{contract.orders?.subject ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Importo ordine</dt>
              <dd className="font-medium">{formatCurrency(contract.orders?.amount)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Periodo</dt>
              <dd className="font-medium">{contract.start_date} — {contract.end_date}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Importo contratto</dt>
              <dd className="font-medium">{formatCurrency(contract.total_amount)}</dd>
            </div>
            {contract.progress_notes && (
              <div className="col-span-2">
                <dt className="text-muted-foreground">Note</dt>
                <dd className="font-medium whitespace-pre-wrap">{contract.progress_notes}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Complete Dialog */}
      <Dialog open={completeDialog} onOpenChange={setCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Completa contratto</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Confermi di voler chiudere questo contratto come completato? 
            Questa azione è irreversibile.
          </p>
          {summary && Number(summary.pending_approval_count) > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Ci sono ancora {summary.pending_approval_count} benestare in attesa di approvazione.</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialog(false)}>Annulla</Button>
            <Button disabled={completeMutation.isPending} onClick={() => completeMutation.mutate()}>
              Conferma completamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Terminate Dialog */}
      <Dialog open={terminateDialog} onOpenChange={(open) => { if (!open) { setTerminateDialog(false); setTerminateReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Termina contratto anticipatamente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Motivazione *</Label>
            <Textarea
              value={terminateReason}
              onChange={(e) => setTerminateReason(e.target.value)}
              rows={3}
              placeholder="Inserisci la motivazione della terminazione..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTerminateDialog(false); setTerminateReason(""); }}>Annulla</Button>
            <Button
              variant="destructive"
              disabled={!terminateReason.trim() || terminateMutation.isPending}
              onClick={() => terminateMutation.mutate()}
            >
              Conferma terminazione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
