import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orderService } from "@/services/orderService";
import { contractService } from "@/services/contractService";
import { billingApprovalService } from "@/services/billingApprovalService";
import { useAuth } from "@/hooks/useAuth";
import { useGrants } from "@/hooks/useGrants";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft, CheckCircle, XCircle, Building2, Calendar, FileText,
  MapPin, ExternalLink, AlertTriangle, Receipt,
} from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "Bozza", pending_approval: "In approvazione", issued: "Emesso",
  accepted: "Accettato", rejected: "Rifiutato", in_progress: "In corso",
  completed: "Completato", cancelled: "Annullato",
};
const ORDER_STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground", pending_approval: "bg-amber-100 text-amber-700",
  issued: "bg-blue-100 text-blue-700", accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700", in_progress: "bg-purple-100 text-purple-700",
  completed: "bg-teal-100 text-teal-700", cancelled: "bg-gray-100 text-gray-500",
};
const CONTRACT_STATUS_LABELS: Record<string, string> = {
  planned: "Pianificato", active: "Attivo", completed: "Completato", terminated: "Terminato",
};
const CONTRACT_STATUS_COLORS: Record<string, string> = {
  planned: "bg-gray-100 text-gray-700", active: "bg-emerald-100 text-emerald-700",
  completed: "bg-blue-100 text-blue-700", terminated: "bg-red-100 text-red-700",
};

function fmtCurrency(v: number | null | undefined) {
  return `€ ${Number(v ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return format(new Date(d), "dd/MM/yyyy");
}

interface Milestone { date: string; description: string; }

export default function InternalOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { hasGrant } = useGrants();
  const qc = useQueryClient();

  const [terminateDialog, setTerminateDialog] = useState(false);
  const [terminateReason, setTerminateReason] = useState("");
  const [completeDialog, setCompleteDialog] = useState(false);

  const { data: order, isLoading: oLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => orderService.getById(id!),
    enabled: !!id,
  });

  const { data: contract, isLoading: cLoading } = useQuery({
    queryKey: ["contract-by-order", id],
    queryFn: async () => {
      try { return await contractService.getByOrderId(id!); }
      catch { return null; }
    },
    enabled: !!id,
  });

  const { data: summary } = useQuery({
    queryKey: ["contract-summary-by-order", id],
    queryFn: () => contractService.getEconomicSummaryByOrderId(id!),
    enabled: !!id,
  });

  const { data: billingApprovals = [] } = useQuery({
    queryKey: ["billing-by-order", id],
    queryFn: () => billingApprovalService.listByOrderId(id!),
    enabled: !!id,
  });

  const canManage = hasGrant("manage_orders");

  // Order mutations
  const approveMutation = useMutation({
    mutationFn: () => orderService.approveOrder(id!, profile!.tenant_id, profile!.id),
    onSuccess: () => { toast.success("Ordine approvato e emesso"); qc.invalidateQueries({ queryKey: ["order", id] }); },
    onError: (err: Error) => toast.error(err.message),
  });
  const rejectMutation = useMutation({
    mutationFn: () => orderService.rejectOrderByAdmin(id!, profile!.tenant_id),
    onSuccess: () => { toast.success("Ordine rifiutato"); qc.invalidateQueries({ queryKey: ["order", id] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  // Contract mutations
  const completeMutation = useMutation({
    mutationFn: () => contractService.completeContract(contract!.id, profile!.tenant_id),
    onSuccess: () => {
      toast.success("Contratto completato");
      qc.invalidateQueries({ queryKey: ["contract-by-order", id] });
      setCompleteDialog(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const terminateMutation = useMutation({
    mutationFn: () => contractService.terminateContract(contract!.id, profile!.tenant_id, terminateReason),
    onSuccess: () => {
      toast.success("Contratto terminato");
      qc.invalidateQueries({ queryKey: ["contract-by-order", id] });
      setTerminateDialog(false);
      setTerminateReason("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (oLoading || cLoading) {
    return (
      <div className="p-6 space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!order) {
    return <EmptyState title="Ordine non trovato" description="L'ordine richiesto non esiste." />;
  }

  const milestones = (order.milestones as unknown as Milestone[]) ?? [];
  const usedPct = summary ? Math.round(100 - (summary.residual_pct ?? 100)) : 0;
  const residualPct = summary?.residual_pct ?? 100;
  const barColor = usedPct >= 90 ? "bg-destructive" : usedPct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  const isContractActive = contract?.status === "active";
  const isContractClosed = contract?.status === "completed" || contract?.status === "terminated";

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/internal" },
          { label: "Ordini", href: "/internal/orders" },
          { label: order.code ?? order.subject },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold truncate">{order.subject}</h1>
            <Badge variant="secondary" className={ORDER_STATUS_COLORS[order.status] ?? ""}>
              {ORDER_STATUS_LABELS[order.status] ?? order.status}
            </Badge>
            {contract && (
              <Badge variant="outline" className={CONTRACT_STATUS_COLORS[contract.status] ?? ""}>
                Contratto: {CONTRACT_STATUS_LABELS[contract.status] ?? contract.status}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1 font-mono">{order.code ?? "Codice non assegnato"}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold tabular-nums">{fmtCurrency(order.amount)}</p>
          <p className="text-xs text-muted-foreground">Importo ordine</p>
        </div>
      </div>

      {/* Admin order approval actions */}
      {canManage && order.status === "pending_approval" && (
        <div className="flex gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50">
          <div className="flex-1">
            <p className="font-medium text-amber-800">Ordine in attesa di approvazione</p>
            <p className="text-sm text-amber-600">Approva per emetterlo o rifiuta per annullarlo.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" disabled={approveMutation.isPending || rejectMutation.isPending} onClick={() => approveMutation.mutate()}>
              <CheckCircle className="h-4 w-4 mr-1" /> Approva
            </Button>
            <Button size="sm" variant="destructive" disabled={approveMutation.isPending || rejectMutation.isPending} onClick={() => rejectMutation.mutate()}>
              <XCircle className="h-4 w-4 mr-1" /> Rifiuta
            </Button>
          </div>
        </div>
      )}

      {/* Tabs: Ordine | Contratto */}
      <Tabs defaultValue="order">
        <TabsList>
          <TabsTrigger value="order">
            <FileText className="h-4 w-4 mr-1.5" /> Ordine
          </TabsTrigger>
          <TabsTrigger value="contract">
            <Calendar className="h-4 w-4 mr-1.5" /> Contratto
          </TabsTrigger>
          <TabsTrigger value="billing">
            <Receipt className="h-4 w-4 mr-1.5" /> Benestare {billingApprovals.length > 0 && <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">{billingApprovals.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB ORDINE ===== */}
        <TabsContent value="order" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Dettagli ordine
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  {order.description && (
                    <div>
                      <dt className="text-muted-foreground">Descrizione</dt>
                      <dd className="mt-0.5">{order.description}</dd>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div><dt className="text-muted-foreground">Data inizio</dt><dd className="font-medium">{fmtDate(order.start_date)}</dd></div>
                    <div><dt className="text-muted-foreground">Data fine</dt><dd className="font-medium">{fmtDate(order.end_date)}</dd></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><dt className="text-muted-foreground">Creato il</dt><dd className="font-medium">{fmtDate(order.created_at)}</dd></div>
                    <div><dt className="text-muted-foreground">Aggiornato il</dt><dd className="font-medium">{fmtDate(order.updated_at)}</dd></div>
                  </div>
                  {order.supplier_accepted_at && (
                    <div><dt className="text-muted-foreground">Accettato dal fornitore</dt><dd className="font-medium text-emerald-600">{fmtDate(order.supplier_accepted_at)}</dd></div>
                  )}
                  {order.supplier_rejected_at && (
                    <div><dt className="text-muted-foreground">Rifiutato dal fornitore</dt><dd className="font-medium text-red-600">{fmtDate(order.supplier_rejected_at)}</dd></div>
                  )}
                </dl>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Fornitore</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">{order.suppliers?.company_name ?? "—"}</p>
                  {order.suppliers?.id && (
                    <Link to={`/internal/vendors/${order.suppliers.id}`} className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1">
                      Vedi scheda fornitore <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </CardContent>
              </Card>

              {order.opportunities && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4" /> Opportunità collegata</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{order.opportunities.title}</p>
                    <p className="text-xs text-muted-foreground font-mono">{order.opportunities.code}</p>
                    <Link to={`/internal/opportunities/${order.opportunities.id}`} className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1">
                      Vedi opportunità <ExternalLink className="h-3 w-3" />
                    </Link>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {order.contract_conditions && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Condizioni contrattuali</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{order.contract_conditions}</p></CardContent>
            </Card>
          )}

          {milestones.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Milestones</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {milestones.map((m, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{m.description}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(m.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== TAB CONTRATTO ===== */}
        <TabsContent value="contract" className="space-y-6 mt-4">
          {!contract ? (
            <EmptyState title="Contratto non disponibile" description="Il contratto verrà generato dopo l'emissione dell'ordine." />
          ) : (
            <>
              {/* Contract action buttons */}
              {canManage && isContractActive && (
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

              {residualPct < 10 && !isContractClosed && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Budget quasi esaurito — residuo inferiore al 10%</span>
                </div>
              )}

              {/* Economic metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-normal">Importo autorizzato</CardTitle></CardHeader>
                  <CardContent><p className="text-xl font-bold">{fmtCurrency(summary?.current_authorized_amount)}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-normal">Fatturato approvato</CardTitle></CardHeader>
                  <CardContent><p className="text-xl font-bold">{fmtCurrency(summary?.approved_billing_total)}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-normal">Residuo</CardTitle></CardHeader>
                  <CardContent><p className="text-xl font-bold">{fmtCurrency(summary?.residual_amount)}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-normal">In approvazione</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">
                      {fmtCurrency(summary?.pending_approval_amount)}
                      {summary?.pending_approval_count ? (
                        <span className="text-sm font-normal text-muted-foreground ml-1">({summary.pending_approval_count})</span>
                      ) : null}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Usage bar */}
              <Card>
                <CardHeader><CardTitle className="text-sm">Utilizzo budget</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Utilizzato: {usedPct}%</span>
                    <span>Residuo: {residualPct?.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(usedPct, 100)}%` }} />
                  </div>
                </CardContent>
              </Card>

              {/* Contract details */}
              <Card>
                <CardHeader><CardTitle className="text-sm">Dettagli contratto</CardTitle></CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Stato contratto</dt>
                      <dd><Badge variant="secondary" className={CONTRACT_STATUS_COLORS[contract.status] ?? ""}>{CONTRACT_STATUS_LABELS[contract.status] ?? contract.status}</Badge></dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Importo contratto</dt>
                      <dd className="font-medium">{fmtCurrency(contract.total_amount)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Periodo contratto</dt>
                      <dd className="font-medium">{fmtDate(contract.start_date)} — {fmtDate(contract.end_date)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Creato il</dt>
                      <dd className="font-medium">{fmtDate(contract.created_at)}</dd>
                    </div>
                    {contract.progress_notes && (
                      <div className="sm:col-span-2">
                        <dt className="text-muted-foreground">Note</dt>
                        <dd className="font-medium whitespace-pre-wrap">{contract.progress_notes}</dd>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Complete Dialog */}
      <Dialog open={completeDialog} onOpenChange={setCompleteDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Completa contratto</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Confermi di voler chiudere questo contratto come completato? Questa azione è irreversibile.</p>
          {summary && Number(summary.pending_approval_count) > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Ci sono ancora {summary.pending_approval_count} benestare in attesa di approvazione.</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialog(false)}>Annulla</Button>
            <Button disabled={completeMutation.isPending} onClick={() => completeMutation.mutate()}>Conferma completamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Terminate Dialog */}
      <Dialog open={terminateDialog} onOpenChange={(open) => { if (!open) { setTerminateDialog(false); setTerminateReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Termina contratto anticipatamente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Motivazione *</Label>
            <Textarea value={terminateReason} onChange={(e) => setTerminateReason(e.target.value)} rows={3} placeholder="Inserisci la motivazione della terminazione..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTerminateDialog(false); setTerminateReason(""); }}>Annulla</Button>
            <Button variant="destructive" disabled={!terminateReason.trim() || terminateMutation.isPending} onClick={() => terminateMutation.mutate()}>Conferma terminazione</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
