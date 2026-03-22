import { useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { billingApprovalService } from "@/services/billingApprovalService";
import { useAuth } from "@/hooks/useAuth";
import { useGrants } from "@/hooks/useGrants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { Plus, Check, X, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  draft: "Bozza",
  pending_approval: "In approvazione",
  approved: "Approvato",
  rejected: "Respinto",
  invoiced: "Fatturato",
  closed: "Chiuso",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_approval: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  invoiced: "bg-blue-100 text-blue-700",
  closed: "bg-teal-100 text-teal-700",
};

export default function InternalBillingApprovals() {
  const { profile } = useAuth();
  const { hasGrant } = useGrants();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [approveDialog, setApproveDialog] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Create form state
  const [selectedContract, setSelectedContract] = useState("");
  const [periodStart, setPeriodStart] = useState<Date | undefined>();
  const [periodEnd, setPeriodEnd] = useState<Date | undefined>();
  const [amount, setAmount] = useState<number>(0);
  const [activityDesc, setActivityDesc] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  const { data: billings = [], isLoading } = useQuery({
    queryKey: ["billing-approvals"],
    queryFn: () => billingApprovalService.list(),
    enabled: !!profile,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["active-contracts"],
    queryFn: () => billingApprovalService.listActiveContracts(),
    enabled: showCreate,
  });

  const selectedContractData = contracts.find((c: any) => c.id === selectedContract);

  const { data: residualData } = useQuery({
    queryKey: ["contract-residual", selectedContract],
    queryFn: () => billingApprovalService.getResidual(selectedContract),
    enabled: !!selectedContract,
  });

  const residualAmount = Number(residualData?.residual_amount ?? 0);
  const pendingAmount = Number(residualData?.pending_approval_amount ?? 0);
  const exceedsResidual = amount > 0 && amount > residualAmount;
  const exceedsPending = amount > 0 && amount > (residualAmount - pendingAmount) && !exceedsResidual;

  const canApprove = hasGrant("approve_billing_approval");
  const canCreate = hasGrant("create_billing_approval");

  const filtered = statusFilter === "all"
    ? billings
    : billings.filter((b: any) => b.status === statusFilter);

  // Metrics
  const metrics = billings.reduce((acc: Record<string, number>, b: any) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!profile || !selectedContractData) throw new Error("Dati mancanti");

      const billing = await billingApprovalService.saveDraft({
        tenantId: profile.tenant_id,
        contractId: selectedContract,
        orderId: selectedContractData.order_id,
        supplierId: selectedContractData.supplier_id,
        periodStart: periodStart ? format(periodStart, "yyyy-MM-dd") : "",
        periodEnd: periodEnd ? format(periodEnd, "yyyy-MM-dd") : "",
        amount,
        activityDescription: activityDesc,
        createdBy: profile.id,
      });

      // Upload attachments
      for (const file of attachments) {
        await billingApprovalService.uploadAttachment(billing.id, file);
      }

      return billing;
    },
    onSuccess: () => {
      toast.success("Benestare salvato come bozza");
      qc.invalidateQueries({ queryKey: ["billing-approvals"] });
      resetCreateForm();
    },
    onError: (err: Error) => toast.error(err.message || "Errore"),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!profile || !selectedContractData) throw new Error("Dati mancanti");

      // 1. Save draft first
      const billing = await billingApprovalService.saveDraft({
        tenantId: profile.tenant_id,
        contractId: selectedContract,
        orderId: selectedContractData.order_id,
        supplierId: selectedContractData.supplier_id,
        periodStart: periodStart ? format(periodStart, "yyyy-MM-dd") : "",
        periodEnd: periodEnd ? format(periodEnd, "yyyy-MM-dd") : "",
        amount,
        activityDescription: activityDesc,
        createdBy: profile.id,
      });

      // 2. Upload attachments
      for (const file of attachments) {
        await billingApprovalService.uploadAttachment(billing.id, file);
      }

      // 3. Submit for approval (includes server-side RB-08 check)
      await billingApprovalService.submitForApproval(billing.id, profile.tenant_id);

      return billing;
    },
    onSuccess: () => {
      toast.success("Benestare inviato per approvazione");
      qc.invalidateQueries({ queryKey: ["billing-approvals"] });
      resetCreateForm();
    },
    onError: (err: Error) => toast.error(err.message || "Errore"),
  });

  const approveMutation = useMutation({
    mutationFn: (billingId: string) =>
      billingApprovalService.approve(billingId, profile!.id, profile!.tenant_id),
    onSuccess: () => {
      toast.success("Benestare approvato");
      qc.invalidateQueries({ queryKey: ["billing-approvals"] });
      setApproveDialog(null);
    },
    onError: (err: Error) => toast.error(err.message || "Errore"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ billingId, reason }: { billingId: string; reason: string }) =>
      billingApprovalService.reject(billingId, profile!.tenant_id, reason),
    onSuccess: () => {
      toast.success("Benestare respinto");
      qc.invalidateQueries({ queryKey: ["billing-approvals"] });
      setRejectDialog(null);
      setRejectReason("");
    },
    onError: (err: Error) => toast.error(err.message || "Errore"),
  });

  function resetCreateForm() {
    setShowCreate(false);
    setSelectedContract("");
    setPeriodStart(undefined);
    setPeriodEnd(undefined);
    setAmount(0);
    setActivityDesc("");
    setAttachments([]);
  }

  if (isLoading) {
    return <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 min-w-0 overflow-hidden">
      <Breadcrumb items={[{ label: "Dashboard", href: "/internal" }, { label: "Benestare" }]} />
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 section-accent-bar-green">
          <span className="text-base">📄</span>
          Benestare di Fatturazione
        </h2>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nuovo benestare
          </Button>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["draft", "pending_approval", "approved", "rejected"] as const).map((s) => (
          <Card key={s} className="cursor-pointer hover:shadow-md transition-shadow card-top-billing" onClick={() => setStatusFilter(s)}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{STATUS_LABELS[s]}</p>
              <p className="text-2xl font-bold">{metrics[s] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState title="Nessun benestare" description="Non ci sono benestare corrispondenti ai filtri." />
      ) : (
        <Card className="card-top-billing">
          <CardContent className="p-0">
            <div className="overflow-x-auto -mx-4 sm:-mx-0">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Fornitore</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead className="text-right">Importo (€)</TableHead>
                  <TableHead>Stato</TableHead>
                  {canApprove && <TableHead className="text-center">Azioni</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((b: any) => (
                  <TableRow key={b.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/internal/billing-approvals/${b.id}`)}>
                    <TableCell className="font-mono text-sm">{b.code ?? "—"}</TableCell>
                    <TableCell className="font-medium">{b.suppliers?.company_name ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {b.period_start && b.period_end
                        ? `${format(new Date(b.period_start), "dd/MM/yy")} – ${format(new Date(b.period_end), "dd/MM/yy")}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      € {Number(b.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_COLORS[b.status] ?? ""}>
                        {STATUS_LABELS[b.status] ?? b.status}
                      </Badge>
                    </TableCell>
                    {canApprove && (
                      <TableCell className="text-center">
                        {b.status === "pending_approval" ? (
                          <div className="flex gap-1 justify-center">
                            <Button size="sm" variant="ghost" className="text-emerald-600" onClick={() => setApproveDialog(b.id)}>
                              <Check className="h-3.5 w-3.5 mr-1" /> Approva
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRejectDialog(b.id)}>
                              <X className="h-3.5 w-3.5 mr-1" /> Respingi
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) resetCreateForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuovo benestare di fatturazione</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Contratto *</Label>
              <Select value={selectedContract} onValueChange={setSelectedContract}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona contratto..." />
                </SelectTrigger>
                <SelectContent>
                  {contracts.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.orders?.code ?? "—"} — {c.suppliers?.company_name ?? "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedContract && residualData && (
              <div className="rounded-md border p-3 text-sm space-y-1">
                <p>Residuo disponibile: <span className="font-bold">€ {residualAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span></p>
                {pendingAmount > 0 && (
                  <p className="text-muted-foreground">In attesa di approvazione: € {pendingAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Periodo inizio *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !periodStart && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {periodStart ? format(periodStart, "dd/MM/yyyy") : "Seleziona data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={periodStart} onSelect={setPeriodStart} locale={it} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Periodo fine *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !periodEnd && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {periodEnd ? format(periodEnd, "dd/MM/yyyy") : "Seleziona data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={periodEnd} onSelect={setPeriodEnd} locale={it} initialFocus className="p-3 pointer-events-auto" disabled={(date) => periodStart ? date < periodStart : false} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Importo (€) *</Label>
              <Input type="number" min={0} step="0.01" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} />
              {exceedsResidual && (
                <p className="text-sm text-destructive font-medium">Supera il residuo contrattuale (RB-08) — invio bloccato</p>
              )}
              {exceedsPending && (
                <p className="text-sm text-amber-600">Attenzione: ci sono benestare in attesa di approvazione che potrebbero ridurre il residuo</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Descrizione attività</Label>
              <Textarea value={activityDesc} onChange={(e) => setActivityDesc(e.target.value)} rows={3} />
            </div>

            <div className="space-y-2">
              <Label>Allegati</Label>
              <Input type="file" multiple onChange={(e) => setAttachments(Array.from(e.target.files || []))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={resetCreateForm}>Annulla</Button>
            <Button
              variant="secondary"
              disabled={!selectedContract || !periodStart || !periodEnd || amount <= 0 || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Salva bozza
            </Button>
            <Button
              disabled={!selectedContract || !periodStart || !periodEnd || amount <= 0 || exceedsResidual || submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              Invia per approvazione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={!!approveDialog} onOpenChange={() => setApproveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma approvazione</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Sei sicuro di voler approvare questo benestare?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(null)}>Annulla</Button>
            <Button
              disabled={approveMutation.isPending}
              onClick={() => { if (approveDialog) approveMutation.mutate(approveDialog); }}
            >
              Conferma approvazione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => { setRejectDialog(null); setRejectReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respingi benestare</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Motivazione *</Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder="Inserisci la motivazione..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialog(null); setRejectReason(""); }}>Annulla</Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              onClick={() => { if (rejectDialog) rejectMutation.mutate({ billingId: rejectDialog, reason: rejectReason }); }}
            >
              Conferma rifiuto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
