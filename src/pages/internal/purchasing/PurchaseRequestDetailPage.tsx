import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useAuth } from "@/hooks/useAuth";
import { useGrants } from "@/hooks/useGrants";
import {
  usePurchaseRequest,
  usePurchaseHistory,
  useApprovalThreshold,
  useSubmitRequest,
  useApproveRequest,
  useEscalateToFinance,
  useApproveFinance,
  useRejectRequest,
  useSetInPurchase,
  useCancelRequest,
} from "@/hooks/usePurchasing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency, formatDateIT } from "@/utils/formatters";
import {
  ArrowLeft, Pencil, Send, XCircle, CheckCircle,
  ArrowUpRight, ShoppingCart, Briefcase, AlertTriangle, Clock,
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  draft: "Bozza", submitted: "Inviata", pending_validation: "Attesa Finance",
  approved: "Approvata", approved_finance: "Approvata Finance",
  rejected: "Respinta", in_purchase: "In acquisto",
  completed: "Completata", cancelled: "Annullata",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700", submitted: "bg-blue-100 text-blue-700",
  pending_validation: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700", approved_finance: "bg-teal-100 text-teal-700",
  rejected: "bg-red-100 text-red-700", in_purchase: "bg-purple-100 text-purple-700",
  completed: "bg-green-200 text-green-800", cancelled: "bg-gray-200 text-gray-600",
};

const PRIORITY_LABELS: Record<string, string> = { low: "Bassa", normal: "Normale", high: "Alta", urgent: "Urgente" };

type ConfirmAction = "submit" | "cancel" | "escalate" | "in_purchase" | "opportunity" | null;

export default function PurchaseRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasGrant } = useGrants();

  const { data: pr, isLoading } = usePurchaseRequest(id);
  const { data: history = [] } = usePurchaseHistory(id);
  const { data: threshold } = useApprovalThreshold();

  const submitMut = useSubmitRequest();
  const approveMut = useApproveRequest();
  const escalateMut = useEscalateToFinance();
  const approveFinanceMut = useApproveFinance();
  const rejectMut = useRejectRequest();
  const inPurchaseMut = useSetInPurchase();
  const cancelMut = useCancelRequest();

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showApproveFinanceDialog, setShowApproveFinanceDialog] = useState(false);
  const [approveNotes, setApproveNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!pr) {
    return <EmptyState title="Richiesta non trovata" description="La richiesta non esiste o non hai i permessi." />;
  }

  const isOwner = pr.requested_by === user?.id;
  const amt = Number(pr.amount);
  const aboveThreshold = threshold != null && amt > threshold;
  const isPending = submitMut.isPending || approveMut.isPending || escalateMut.isPending
    || approveFinanceMut.isPending || rejectMut.isPending || inPurchaseMut.isPending || cancelMut.isPending;

  // Terminal states: no action buttons should appear
  const isTerminal = ["completed", "cancelled", "rejected"].includes(pr.status)
    || !!pr.outcome || !!pr.linked_opportunity_id;

  const handleConfirm = async () => {
    if (!id) return;
    switch (confirmAction) {
      case "submit": await submitMut.mutateAsync(id); break;
      case "cancel": await cancelMut.mutateAsync(id); break;
      case "escalate": await escalateMut.mutateAsync(id); break;
      case "in_purchase": await inPurchaseMut.mutateAsync(id); break;
      case "opportunity": navigate(`/internal/opportunities/new?from_request=${id}`); break;
    }
    setConfirmAction(null);
  };

  const confirmLabels: Record<string, { title: string; desc: string }> = {
    submit: { title: "Conferma invio", desc: "Una volta inviata, la richiesta non potrà più essere modificata." },
    cancel: { title: "Annulla richiesta", desc: "Questa azione è irreversibile. La bozza sarà annullata." },
    escalate: { title: "Inoltra a Finance", desc: "L'importo supera la soglia. La richiesta sarà inoltrata al Responsabile Finance." },
    in_purchase: { title: "Prendi in carico", desc: "Lo stato passerà a 'In acquisto'. Confermi?" },
    opportunity: { title: "Crea opportunità", desc: "Verrai reindirizzato alla creazione di una nuova opportunità collegata a questa RDA." },
  };

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/internal/dashboard" },
          { label: "Richieste di Acquisto", href: "/internal/purchasing/requests" },
          { label: pr.code ?? "Dettaglio" },
        ]}
      />

      <Button variant="ghost" size="sm" onClick={() => navigate("/internal/purchasing/requests")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Torna alla lista
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold font-mono">{pr.code ?? "—"}</h1>
                  <Badge variant="secondary" className={STATUS_COLORS[pr.status] ?? ""}>
                    {STATUS_LABELS[pr.status] ?? pr.status}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{formatCurrency(amt)}</p>
                  <Badge variant="secondary" className="mt-1">
                    {PRIORITY_LABELS[pr.priority] ?? pr.priority}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Oggetto</p>
                <p className="font-medium">{pr.subject}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Motivazione</p>
                <p>{pr.justification}</p>
              </div>
              {pr.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Descrizione</p>
                  <p>{pr.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Richiedente</p>
                  <p className="font-medium">{pr.requester?.full_name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Data richiesta</p>
                  <p>{formatDateIT(pr.created_at)}</p>
                </div>
                {pr.needed_by && (
                  <div>
                    <p className="text-muted-foreground">Necessaria entro</p>
                    <p>{formatDateIT(pr.needed_by)}</p>
                  </div>
                )}
                {pr.validator && (
                  <div>
                    <p className="text-muted-foreground">Validata da</p>
                    <p className="font-medium">{pr.validator.full_name}</p>
                    {pr.validated_at && <p className="text-xs text-muted-foreground">{formatDateIT(pr.validated_at)}</p>}
                  </div>
                )}
              </div>
              {pr.validation_notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Note validazione</p>
                  <p className="text-sm">{pr.validation_notes}</p>
                </div>
              )}
              {pr.rejection_reason && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <strong>Motivo del rifiuto:</strong> {pr.rejection_reason}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-4 w-4" /> Storico
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun evento registrato.</p>
              ) : (
                <div className="space-y-3">
                  {history.map((h) => (
                    <div key={h.id} className="flex items-start gap-3 border-l-2 border-muted pl-4 pb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          {h.from_status && (
                            <>
                              <Badge variant="outline" className="text-xs">
                                {STATUS_LABELS[h.from_status] ?? h.from_status}
                              </Badge>
                              <span>→</span>
                            </>
                          )}
                          <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[h.to_status] ?? ""}`}>
                            {STATUS_LABELS[h.to_status] ?? h.to_status}
                          </Badge>
                        </div>
                        {h.reason && <p className="text-sm mt-1">{h.reason}</p>}
                        {h.notes && <p className="text-xs text-muted-foreground mt-0.5">{h.notes}</p>}
                        <p className="text-xs text-muted-foreground mt-1">{formatDateIT(h.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-4">
          {/* BLOCK 1: Owner + draft */}
          {isOwner && pr.status === "draft" && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Azioni</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full" onClick={() => navigate(`/internal/purchasing/requests/new?draft=${pr.id}`)}>
                  <Pencil className="h-4 w-4 mr-1" /> Modifica
                </Button>
                <Button className="w-full" disabled={isPending} onClick={() => setConfirmAction("submit")}>
                  <Send className="h-4 w-4 mr-1" /> Invia
                </Button>
                <Button variant="destructive" className="w-full" disabled={isPending} onClick={() => setConfirmAction("cancel")}>
                  <XCircle className="h-4 w-4 mr-1" /> Annulla
                </Button>
              </CardContent>
            </Card>
          )}

          {/* BLOCK 2: Manager validator + submitted */}
          {hasGrant("validate_purchase_request") && pr.status === "submitted" && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Validazione</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Alert>
                  <AlertDescription className="text-sm">
                    Soglia: <strong>{formatCurrency(threshold ?? 5000)}</strong> | Importo: <strong>{formatCurrency(amt)}</strong>
                  </AlertDescription>
                </Alert>

                {!aboveThreshold ? (
                  <>
                    <Button className="w-full" disabled={isPending} onClick={() => setShowApproveDialog(true)}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Approva
                    </Button>
                    <Button variant="destructive" className="w-full" disabled={isPending} onClick={() => setShowRejectDialog(true)}>
                      <XCircle className="h-4 w-4 mr-1" /> Respingi
                    </Button>
                  </>
                ) : (
                  <>
                    <Alert className="border-amber-300 bg-amber-50">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-sm text-amber-800">
                        Importo sopra soglia. Deve passare a Finance.
                      </AlertDescription>
                    </Alert>
                    <Button className="w-full" disabled={isPending} onClick={() => setConfirmAction("escalate")}>
                      <ArrowUpRight className="h-4 w-4 mr-1" /> Inoltra a Finance
                    </Button>
                    <Button variant="destructive" className="w-full" disabled={isPending} onClick={() => setShowRejectDialog(true)}>
                      <XCircle className="h-4 w-4 mr-1" /> Respingi
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* BLOCK 3: Finance approver */}
          {hasGrant("validate_purchase_request_high") && (
            <>
              {pr.status === "pending_validation" && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Validazione Finance</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <Button className="w-full" disabled={isPending} onClick={() => setShowApproveFinanceDialog(true)}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Approva (Finance)
                    </Button>
                    <Button variant="destructive" className="w-full" disabled={isPending} onClick={() => setShowRejectDialog(true)}>
                      <XCircle className="h-4 w-4 mr-1" /> Respingi
                    </Button>
                  </CardContent>
                </Card>
              )}
              {pr.status === "submitted" && !hasGrant("validate_purchase_request") && (
                <Card>
                  <CardContent className="py-4">
                    <p className="text-sm text-muted-foreground text-center">In attesa del Responsabile Acquisti</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* BLOCK 4: Purchase operator */}
          {hasGrant("manage_purchase_operations") && (
            <>
              {["approved", "approved_finance"].includes(pr.status) && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Operazioni Acquisto</CardTitle></CardHeader>
                  <CardContent>
                    <Button className="w-full" disabled={isPending} onClick={() => setConfirmAction("in_purchase")}>
                      <ShoppingCart className="h-4 w-4 mr-1" /> Prendi in carico
                    </Button>
                  </CardContent>
                </Card>
              )}
              {pr.status === "in_purchase" && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Esito acquisto</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <Button className="w-full" disabled={isPending} onClick={() => setConfirmAction("opportunity")}>
                      <Briefcase className="h-4 w-4 mr-1" /> Innesca opportunità
                    </Button>
                    <Button variant="outline" className="w-full" disabled={isPending}
                      onClick={() => navigate(`/internal/purchasing/direct/new/${pr.id}`)}>
                      <ShoppingCart className="h-4 w-4 mr-1" /> Acquisto diretto
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {/* Confirm dialog */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmAction ? confirmLabels[confirmAction]?.title : ""}</DialogTitle>
            <DialogDescription>{confirmAction ? confirmLabels[confirmAction]?.desc : ""}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Annulla</Button>
            <Button onClick={handleConfirm} disabled={isPending}>Conferma</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approva richiesta</DialogTitle>
            <DialogDescription>Inserisci eventuali note di approvazione.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Note (facoltativo)"
            value={approveNotes}
            onChange={(e) => setApproveNotes(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>Annulla</Button>
            <Button disabled={isPending} onClick={async () => {
              await approveMut.mutateAsync({ id: id!, notes: approveNotes || undefined });
              setShowApproveDialog(false);
              setApproveNotes("");
            }}>Approva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Finance dialog */}
      <Dialog open={showApproveFinanceDialog} onOpenChange={setShowApproveFinanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approva (Finance)</DialogTitle>
            <DialogDescription>Inserisci eventuali note di approvazione finance.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Note (facoltativo)"
            value={approveNotes}
            onChange={(e) => setApproveNotes(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveFinanceDialog(false)}>Annulla</Button>
            <Button disabled={isPending} onClick={async () => {
              await approveFinanceMut.mutateAsync({ id: id!, notes: approveNotes || undefined });
              setShowApproveFinanceDialog(false);
              setApproveNotes("");
            }}>Approva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respingi richiesta</DialogTitle>
            <DialogDescription>Indica il motivo del rifiuto (minimo 10 caratteri).</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Motivo del rifiuto"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Annulla</Button>
            <Button
              variant="destructive"
              disabled={isPending || rejectReason.trim().length < 10}
              onClick={async () => {
                await rejectMut.mutateAsync({ id: id!, reason: rejectReason.trim() });
                setShowRejectDialog(false);
                setRejectReason("");
              }}
            >Respingi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
