import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { billingApprovalService } from "@/services/billingApprovalService";
import { useAuth } from "@/hooks/useAuth";
import { useGrants } from "@/hooks/useGrants";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, Check, X, CalendarIcon, Send, ExternalLink, Building2, FileText, MapPin } from "lucide-react";
import { BillingAttachments } from "@/components/billing/BillingAttachments";
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

export default function BillingApprovalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { hasGrant } = useGrants();
  const qc = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [approveDialog, setApproveDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Edit form state
  const [editPeriodStart, setEditPeriodStart] = useState<Date | undefined>();
  const [editPeriodEnd, setEditPeriodEnd] = useState<Date | undefined>();
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editActivity, setEditActivity] = useState("");

  const canApprove = hasGrant("approve_billing_approval");
  const canCreate = hasGrant("create_billing_approval");

  const { data: billing, isLoading } = useQuery({
    queryKey: ["billing-approval", id],
    queryFn: () => billingApprovalService.getById(id!),
    enabled: !!id && !!profile,
  });

  const { data: residualData } = useQuery({
    queryKey: ["contract-residual", billing?.contract_id],
    queryFn: () => billingApprovalService.getResidual(billing!.contract_id),
    enabled: !!billing?.contract_id,
  });

  const isDraft = billing?.status === "draft";
  const isPending = billing?.status === "pending_approval";
  const canEdit = canCreate && isDraft;
  const canDelete = canCreate && (isDraft || billing?.status === "rejected");

  function startEdit() {
    if (!billing) return;
    setEditPeriodStart(billing.period_start ? new Date(billing.period_start) : undefined);
    setEditPeriodEnd(billing.period_end ? new Date(billing.period_end) : undefined);
    setEditAmount(Number(billing.amount));
    setEditActivity(billing.activity_description || "");
    setEditing(true);
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      billingApprovalService.update(id!, {
        period_start: editPeriodStart ? format(editPeriodStart, "yyyy-MM-dd") : undefined,
        period_end: editPeriodEnd ? format(editPeriodEnd, "yyyy-MM-dd") : undefined,
        amount: editAmount,
        activity_description: editActivity || null,
      }),
    onSuccess: () => {
      toast.success("Benestare aggiornato");
      qc.invalidateQueries({ queryKey: ["billing-approval", id] });
      qc.invalidateQueries({ queryKey: ["billing-approvals"] });
      setEditing(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => billingApprovalService.softDelete(id!, profile!.tenant_id),
    onSuccess: () => {
      toast.success("Benestare eliminato");
      qc.invalidateQueries({ queryKey: ["billing-approvals"] });
      navigate("/internal/billing-approvals");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const submitMutation = useMutation({
    mutationFn: () => billingApprovalService.submitForApproval(id!, profile!.tenant_id),
    onSuccess: () => {
      toast.success("Benestare inviato per approvazione");
      qc.invalidateQueries({ queryKey: ["billing-approval", id] });
      qc.invalidateQueries({ queryKey: ["billing-approvals"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const approveMutation = useMutation({
    mutationFn: () => billingApprovalService.approve(id!, profile!.id, profile!.tenant_id),
    onSuccess: () => {
      toast.success("Benestare approvato");
      qc.invalidateQueries({ queryKey: ["billing-approval", id] });
      qc.invalidateQueries({ queryKey: ["billing-approvals"] });
      setApproveDialog(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: () => billingApprovalService.reject(id!, profile!.tenant_id, rejectReason),
    onSuccess: () => {
      toast.success("Benestare respinto");
      qc.invalidateQueries({ queryKey: ["billing-approval", id] });
      qc.invalidateQueries({ queryKey: ["billing-approvals"] });
      setRejectDialog(false);
      setRejectReason("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!billing) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Benestare non trovato.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/internal/billing-approvals")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Torna alla lista
        </Button>
      </div>
    );
  }

  const residualAmount = Number(residualData?.residual_amount ?? 0);

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/internal/dashboard" },
          { label: "Benestare", href: "/internal/billing-approvals" },
          { label: billing.code || "Dettaglio" },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/internal/billing-approvals")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{billing.code || "Benestare"}</h1>
            <p className="text-sm text-muted-foreground">
              {(billing as any).suppliers?.company_name ?? "—"}
            </p>
          </div>
          <Badge variant="secondary" className={STATUS_COLORS[billing.status] ?? ""}>
            {STATUS_LABELS[billing.status] ?? billing.status}
          </Badge>
        </div>

        <div className="flex gap-2 flex-wrap">
          {canEdit && !editing && (
            <>
              <Button variant="outline" size="sm" onClick={startEdit}>
                <Pencil className="h-4 w-4 mr-1.5" /> Modifica
              </Button>
              <Button variant="outline" size="sm" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                <Send className="h-4 w-4 mr-1.5" /> Invia per approvazione
              </Button>
            </>
          )}
          {canDelete && (
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteDialog(true)}>
              <Trash2 className="h-4 w-4 mr-1.5" /> Elimina
            </Button>
          )}
          {canApprove && isPending && (
            <>
              <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => setApproveDialog(true)}>
                <Check className="h-4 w-4 mr-1.5" /> Approva
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setRejectDialog(true)}>
                <X className="h-4 w-4 mr-1.5" /> Respingi
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Detail / Edit */}
      {editing ? (
        <Card className="card-top-billing">
          <CardHeader>
            <CardTitle className="text-base">Modifica benestare</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Periodo inizio *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editPeriodStart && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editPeriodStart ? format(editPeriodStart, "dd/MM/yyyy") : "Seleziona"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={editPeriodStart} onSelect={setEditPeriodStart} locale={it} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Periodo fine *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editPeriodEnd && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editPeriodEnd ? format(editPeriodEnd, "dd/MM/yyyy") : "Seleziona"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={editPeriodEnd} onSelect={setEditPeriodEnd} locale={it} initialFocus className="p-3 pointer-events-auto" disabled={(date) => editPeriodStart ? date < editPeriodStart : false} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Importo (€) *</Label>
              <Input type="number" min={0} step="0.01" value={editAmount || ""} onChange={(e) => setEditAmount(Number(e.target.value))} />
              {editAmount > residualAmount && residualAmount > 0 && (
                <p className="text-sm text-destructive">Supera il residuo contrattuale (€ {residualAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })})</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Descrizione attività</Label>
              <Textarea value={editActivity} onChange={(e) => setEditActivity(e.target.value)} rows={3} />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditing(false)}>Annulla</Button>
              <Button
                disabled={!editPeriodStart || !editPeriodEnd || editAmount <= 0 || updateMutation.isPending}
                onClick={() => updateMutation.mutate()}
              >
                Salva modifiche
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="card-top-billing">
            <CardHeader>
              <CardTitle className="text-base">Dati benestare</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label="Codice" value={billing.code || "—"} />
              <InfoRow label="Fornitore" value={(billing as any).suppliers?.company_name || "—"} />
              <InfoRow
                label="Periodo"
                value={
                  billing.period_start && billing.period_end
                    ? `${format(new Date(billing.period_start), "dd/MM/yyyy")} – ${format(new Date(billing.period_end), "dd/MM/yyyy")}`
                    : "—"
                }
              />
              <InfoRow
                label="Importo"
                value={`€ ${Number(billing.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`}
                bold
              />
              <InfoRow label="Descrizione attività" value={billing.activity_description || "—"} />
              <InfoRow
                label="Creato il"
                value={billing.created_at ? format(new Date(billing.created_at), "dd/MM/yyyy HH:mm", { locale: it }) : "—"}
              />
            </CardContent>
          </Card>

          <Card className="card-top-billing">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Ordine di riferimento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {billing.orders ? (
                <>
                  <InfoRow label="Codice ordine" value={billing.orders.code ?? "—"} />
                  <InfoRow label="Oggetto" value={billing.orders.subject ?? "—"} />
                  <InfoRow
                    label="Importo ordine"
                    value={`€ ${Number(billing.orders.amount ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`}
                    bold
                  />
                  {residualData && (
                    <>
                      <Separator />
                      <InfoRow
                        label="Fatturato approvato"
                        value={`€ ${Number(residualData.approved_billing_total ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`}
                      />
                      <InfoRow
                        label="Residuo disponibile"
                        value={`€ ${residualAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`}
                        bold
                      />
                      {Number(residualData.pending_approval_amount ?? 0) > 0 && (
                        <InfoRow
                          label="In attesa di approvazione"
                          value={`€ ${Number(residualData.pending_approval_amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })} (${residualData.pending_approval_count})`}
                        />
                      )}
                    </>
                  )}
                  <Link to={`/internal/orders/${billing.order_id}`} className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-2">
                    Vai al dettaglio ordine <ExternalLink className="h-3 w-3" />
                  </Link>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Ordine non disponibile</p>
              )}

              {billing.approved_by && billing.approved_at && (
                <>
                  <Separator />
                  <InfoRow
                    label="Approvato il"
                    value={format(new Date(billing.approved_at), "dd/MM/yyyy HH:mm", { locale: it })}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Reference cards: Opportunità, Fornitore */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {billing.orders?.opportunities && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Opportunità collegata
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium text-sm">{billing.orders.opportunities.title}</p>
                <p className="text-xs text-muted-foreground font-mono">{billing.orders.opportunities.code}</p>
                <Link to={`/internal/opportunities/${billing.orders.opportunities.id}`} className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-2">
                  Vai al dettaglio opportunità <ExternalLink className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          )}

          {billing.suppliers && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Fornitore
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium text-sm">{billing.suppliers.company_name}</p>
                <Link to={`/internal/vendors/${billing.supplier_id}`} className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-2">
                  Vai alla scheda fornitore <ExternalLink className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        <BillingAttachments billingId={id!} canEdit={canEdit} />
        </>
      )}

      {/* Delete dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina benestare</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sei sicuro di voler eliminare il benestare <strong>{billing.code}</strong>? L'operazione non è reversibile.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>Annulla</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
              Conferma eliminazione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve dialog */}
      <Dialog open={approveDialog} onOpenChange={setApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma approvazione</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Confermi l'approvazione del benestare <strong>{billing.code}</strong> per un importo di{" "}
            <strong>€ {Number(billing.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(false)}>Annulla</Button>
            <Button disabled={approveMutation.isPending} onClick={() => approveMutation.mutate()}>
              Conferma approvazione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectDialog} onOpenChange={(open) => { if (!open) { setRejectDialog(false); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respingi benestare</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Motivazione *</Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder="Inserisci la motivazione..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialog(false); setRejectReason(""); }}>Annulla</Button>
            <Button variant="destructive" disabled={!rejectReason.trim() || rejectMutation.isPending} onClick={() => rejectMutation.mutate()}>
              Conferma rifiuto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className={cn("text-sm text-right", bold && "font-semibold")}>{value}</span>
    </div>
  );
}
