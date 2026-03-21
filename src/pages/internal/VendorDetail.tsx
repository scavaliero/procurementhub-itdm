import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { documentService } from "@/services/documentService";
import { auditService } from "@/services/auditService";
import { notificationService } from "@/services/notificationService";
import { useGrants } from "@/hooks/useGrants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import {
  Building2,
  FileText,
  FolderTree,
  History,
  CheckCircle2,
  XCircle,
  Download,
  ArrowLeft,
  ShieldCheck,
  Ban,
  AlertTriangle,
  Send,
  Unlock,
} from "lucide-react";
import type { UploadedDocument, Supplier, SupplierCategory, SupplierStatusHistory } from "@/types";

// ── Config ──
const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pre_registered: { label: "Pre-registrato", variant: "outline" },
  enabled: { label: "Abilitato", variant: "secondary" },
  in_accreditation: { label: "In accreditamento", variant: "secondary" },
  in_approval: { label: "In approvazione", variant: "secondary" },
  pending_review: { label: "In revisione", variant: "secondary" },
  accredited: { label: "Accreditato", variant: "default" },
  suspended: { label: "Sospeso", variant: "destructive" },
  rejected: { label: "Rifiutato", variant: "destructive" },
  revoked: { label: "Revocato", variant: "destructive" },
  blacklisted: { label: "Blacklist", variant: "destructive" },
};

const DOC_STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  approved: { label: "Approvato", variant: "default" },
  uploaded: { label: "In revisione", variant: "secondary" },
  rejected: { label: "Respinto", variant: "destructive" },
};

// ── Helper to display legal_address ──
function formatAddress(addr: unknown): string {
  if (!addr || typeof addr !== "object") return "—";
  const a = addr as Record<string, string>;
  return [a.street, a.city, a.province, a.zip, a.country]
    .filter(Boolean)
    .join(", ") || "—";
}

// ── Main Component ──
export default function InternalVendorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasGrant } = useGrants();

  // Dialog state
  const [actionDialog, setActionDialog] = useState<{
    type: "enable" | "approve" | "integrate" | "suspend" | "revoke";
  } | null>(null);
  const [dialogMessage, setDialogMessage] = useState("");
  const [revokeConfirm, setRevokeConfirm] = useState("");
  const [rejectDocDialog, setRejectDocDialog] = useState<UploadedDocument | null>(null);
  const [rejectDocNotes, setRejectDocNotes] = useState("");

  // ── Queries ──
  const { data: supplier, isLoading } = useQuery({
    queryKey: ["supplier", id],
    queryFn: () => vendorService.getSupplier(id!),
    enabled: !!id,
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["supplier-documents", id],
    queryFn: () => documentService.getSupplierDocuments(id!),
    enabled: !!id,
  });

  const { data: docTypes = [] } = useQuery({
    queryKey: ["document-types"],
    queryFn: () => documentService.listDocumentTypes(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["supplier-categories", id],
    queryFn: () => vendorService.getSupplierCategories(id!),
    enabled: !!id,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["supplier-history", id],
    queryFn: () => vendorService.getStatusHistory(id!),
    enabled: !!id,
  });

  // ── Mutations ──
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["supplier", id] });
    qc.invalidateQueries({ queryKey: ["supplier-history", id] });
    qc.invalidateQueries({ queryKey: ["supplier-categories", id] });
    qc.invalidateQueries({ queryKey: ["supplier-documents", id] });
    qc.invalidateQueries({ queryKey: ["supplier-status-counts"] });
    qc.invalidateQueries({ queryKey: ["suppliers-paginated"] });
  };

  const statusMutation = useMutation({
    mutationFn: async (params: {
      toStatus: string;
      reason?: string;
      extraUpdate?: Partial<Supplier>;
    }) => {
      await vendorService.changeStatus({
        supplierId: id!,
        fromStatus: supplier!.status,
        toStatus: params.toStatus,
        reason: params.reason,
        extraUpdate: params.extraUpdate,
      });
    },
    onSuccess: () => {
      toast.success("Stato aggiornato");
      invalidateAll();
      setActionDialog(null);
      setDialogMessage("");
      setRevokeConfirm("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reviewMutation = useMutation({
    mutationFn: async ({
      doc,
      action,
      reviewNotes,
    }: {
      doc: UploadedDocument;
      action: "approved" | "rejected";
      reviewNotes?: string;
    }) => {
      const result = await documentService.reviewDocument(doc.id, action, reviewNotes);
      if (supplier) {
        await auditService.log({
          tenant_id: supplier.tenant_id,
          entity_type: "uploaded_documents",
          entity_id: doc.id,
          event_type: `document_${action}`,
          old_state: { status: doc.status },
          new_state: { status: action, review_notes: reviewNotes || null },
        });
        try {
          const profileId = await vendorService.getSupplierProfileId(supplier.id);
          if (profileId) {
            await notificationService.send({
              event_type: `document_${action}`,
              recipient_id: profileId,
              tenant_id: supplier.tenant_id,
              variables: {
                document_name:
                  docTypes.find((dt) => dt.id === doc.document_type_id)?.name || "",
                ...(reviewNotes ? { review_notes: reviewNotes } : {}),
              },
            });
          }
        } catch (e) {
          console.error(e);
        }
      }
      return result;
    },
    onSuccess: () => {
      toast.success("Documento aggiornato");
      invalidateAll();
      setRejectDocDialog(null);
      setRejectDocNotes("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const downloadMutation = useMutation({
    mutationFn: async (storagePath: string) => {
      const url = await documentService.getSignedUrl(storagePath);
      window.open(url, "_blank");
    },
    onError: () => toast.error("Errore nel download"),
  });

  const approveCategoryMutation = useMutation({
    mutationFn: (catId: string) => vendorService.approveCategory(catId),
    onSuccess: () => {
      toast.success("Categoria qualificata");
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Loading / not found ──
  if (isLoading) return <PageSkeleton />;
  if (!supplier) {
    return (
      <div className="p-6">
        <EmptyState title="Fornitore non trovato" />
      </div>
    );
  }

  const sBadge = STATUS_CONFIG[supplier.status] || STATUS_CONFIG.pre_registered;
  const dtMap = Object.fromEntries(docTypes.map((dt) => [dt.id, dt]));
  const canReview = hasGrant("review_documents");
  const canApproveAccreditation = hasGrant("approve_accreditation");
  const canSuspend = hasGrant("suspend_supplier");

  // ── Compute available actions ──
  const actions: {
    key: string;
    label: string;
    icon: React.ElementType;
    variant: "default" | "destructive" | "outline";
    onClick: () => void;
  }[] = [];

  if (supplier.status === "pre_registered" && canReview) {
    actions.push({
      key: "enable",
      label: "Abilita accreditamento",
      icon: Unlock,
      variant: "default",
      onClick: () => setActionDialog({ type: "enable" }),
    });
  }
  if (supplier.status === "in_approval" && canApproveAccreditation) {
    actions.push({
      key: "approve",
      label: "Approva accreditamento",
      icon: ShieldCheck,
      variant: "default",
      onClick: () => setActionDialog({ type: "approve" }),
    });
  }
  if (
    (supplier.status === "in_accreditation" ||
      supplier.status === "in_approval") &&
    canReview
  ) {
    actions.push({
      key: "integrate",
      label: "Richiedi integrazione",
      icon: Send,
      variant: "outline",
      onClick: () => setActionDialog({ type: "integrate" }),
    });
  }
  if (supplier.status === "accredited" && canSuspend) {
    actions.push({
      key: "suspend",
      label: "Sospendi",
      icon: AlertTriangle,
      variant: "destructive",
      onClick: () => setActionDialog({ type: "suspend" }),
    });
  }
  if (
    (supplier.status === "accredited" || supplier.status === "suspended") &&
    canSuspend
  ) {
    actions.push({
      key: "revoke",
      label: "Revoca",
      icon: Ban,
      variant: "destructive",
      onClick: () => setActionDialog({ type: "revoke" }),
    });
  }

  // ── Dialog submit handler ──
  const handleDialogSubmit = () => {
    if (!actionDialog) return;
    switch (actionDialog.type) {
      case "enable":
        statusMutation.mutate({ toStatus: "enabled" });
        break;
      case "approve":
        statusMutation.mutate({
          toStatus: "accredited",
          extraUpdate: { accredited_at: new Date().toISOString() },
        });
        break;
      case "integrate":
        if (!dialogMessage.trim()) {
          toast.error("Inserisci un messaggio");
          return;
        }
        statusMutation.mutate({
          toStatus: supplier.status, // same status, just adds history entry
          reason: dialogMessage,
        });
        break;
      case "suspend":
        if (!dialogMessage.trim()) {
          toast.error("Inserisci il motivo della sospensione");
          return;
        }
        statusMutation.mutate({
          toStatus: "suspended",
          reason: dialogMessage,
          extraUpdate: {
            suspension_reason: dialogMessage,
            suspended_at: new Date().toISOString(),
          },
        });
        break;
      case "revoke":
        if (revokeConfirm !== "REVOCA") {
          toast.error("Digita REVOCA per confermare");
          return;
        }
        statusMutation.mutate({ toStatus: "revoked" });
        break;
    }
  };

  const dialogTitle: Record<string, string> = {
    enable: "Abilita accreditamento",
    approve: "Approva accreditamento",
    integrate: "Richiedi integrazione",
    suspend: "Sospendi fornitore",
    revoke: "Revoca fornitore",
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => navigate("/internal/vendors")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{supplier.company_name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {supplier.company_type || "—"} · {supplier.pec || "—"}
            </p>
          </div>
        </div>
        <Badge variant={sBadge.variant} className="text-sm shrink-0">
          {sBadge.label}
        </Badge>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          <Tabs defaultValue="info">
            <TabsList>
              <TabsTrigger value="info">
                <Building2 className="h-4 w-4 mr-1" /> Anagrafica
              </TabsTrigger>
              <TabsTrigger value="documents">
                <FileText className="h-4 w-4 mr-1" /> Documenti
              </TabsTrigger>
              <TabsTrigger value="categories">
                <FolderTree className="h-4 w-4 mr-1" /> Categorie
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-4 w-4 mr-1" /> Storico
              </TabsTrigger>
            </TabsList>

            {/* ── Tab Anagrafica ── */}
            <TabsContent value="info" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                    <InfoRow label="Ragione Sociale" value={supplier.company_name} />
                    <InfoRow label="Tipo Società" value={supplier.company_type} />
                    <InfoRow label="PEC" value={supplier.pec} />
                    <InfoRow label="Website" value={supplier.website} />
                    <InfoRow
                      label="Indirizzo Legale"
                      value={formatAddress(supplier.legal_address)}
                    />
                    <InfoRow
                      label="P.IVA"
                      value={supplier.vat_number_hash ? "•••••••••••" : "—"}
                    />
                    <InfoRow label="IBAN (mascherato)" value={supplier.iban_masked} />
                    <InfoRow
                      label="Rating"
                      value={
                        supplier.rating_score != null
                          ? `${supplier.rating_score} (${supplier.rating_count || 0} val.)`
                          : null
                      }
                    />
                    <InfoRow
                      label="Accreditato il"
                      value={
                        supplier.accredited_at
                          ? new Date(supplier.accredited_at).toLocaleDateString("it-IT")
                          : null
                      }
                    />
                    <InfoRow label="Motivo sospensione" value={supplier.suspension_reason} />
                    <InfoRow label="Note" value={supplier.notes} />
                    <InfoRow
                      label="Registrato il"
                      value={
                        supplier.created_at
                          ? new Date(supplier.created_at).toLocaleDateString("it-IT")
                          : null
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tab Documenti ── */}
            <TabsContent value="documents" className="mt-4 space-y-3">
              {docs.length === 0 ? (
                <EmptyState
                  title="Nessun documento caricato"
                  description="Il fornitore non ha ancora caricato documenti."
                />
              ) : (
                docs.map((doc) => {
                  const dt = dtMap[doc.document_type_id];
                  const dBadge = DOC_STATUS[doc.status] || {
                    label: doc.status,
                    variant: "outline" as const,
                  };
                  return (
                    <Card key={doc.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {dt?.name || doc.document_type_id}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {doc.original_filename} · v{doc.version}
                              {doc.expiry_date &&
                                ` · Scade: ${new Date(doc.expiry_date).toLocaleDateString("it-IT")}`}
                            </p>
                            {doc.review_notes && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Note: {doc.review_notes}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={dBadge.variant}>{dBadge.label}</Badge>
                            {doc.storage_path && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() =>
                                  downloadMutation.mutate(doc.storage_path!)
                                }
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            {canReview && doc.status === "uploaded" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  disabled={reviewMutation.isPending}
                                  onClick={() =>
                                    reviewMutation.mutate({
                                      doc,
                                      action: "approved",
                                    })
                                  }
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{" "}
                                  Approva
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={reviewMutation.isPending}
                                  onClick={() => {
                                    setRejectDocDialog(doc);
                                    setRejectDocNotes("");
                                  }}
                                >
                                  <XCircle className="h-3.5 w-3.5 mr-1" /> Respingi
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>

            {/* ── Tab Categorie ── */}
            <TabsContent value="categories" className="mt-4 space-y-3">
              {categories.length === 0 ? (
                <EmptyState
                  title="Nessuna categoria"
                  description="Il fornitore non ha selezionato categorie."
                />
              ) : (
                categories.map((sc: SupplierCategory) => (
                  <Card key={sc.id}>
                    <CardContent className="pt-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {sc.categories?.name || sc.category_id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Codice: {sc.categories?.code || "—"}
                          {sc.qualified_at &&
                            ` · Qualificato: ${new Date(sc.qualified_at).toLocaleDateString("it-IT")}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            sc.status === "qualified" ? "default" : "secondary"
                          }
                        >
                          {sc.status === "qualified" ? "Qualificato" : "In attesa"}
                        </Badge>
                        {canApproveAccreditation && sc.status !== "qualified" && (
                          <Button
                            size="sm"
                            disabled={approveCategoryMutation.isPending}
                            onClick={() =>
                              approveCategoryMutation.mutate(sc.id)
                            }
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{" "}
                            Approva qualifica
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* ── Tab Storico ── */}
            <TabsContent value="history" className="mt-4">
              {history.length === 0 ? (
                <EmptyState title="Nessun evento" />
              ) : (
                <div className="space-y-0">
                  {history.map((h: SupplierStatusHistory, idx: number) => (
                    <div key={h.id} className="flex gap-4">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        {idx < history.length - 1 && (
                          <div className="w-px flex-1 bg-border" />
                        )}
                      </div>
                      {/* Content */}
                      <div className="pb-6 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {h.from_status && (
                            <>
                              <Badge variant="outline" className="text-xs">
                                {STATUS_CONFIG[h.from_status]?.label || h.from_status}
                              </Badge>
                              <span className="text-xs text-muted-foreground">→</span>
                            </>
                          )}
                          <Badge
                            variant={
                              STATUS_CONFIG[h.to_status]?.variant || "outline"
                            }
                            className="text-xs"
                          >
                            {STATUS_CONFIG[h.to_status]?.label || h.to_status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {h.changer?.full_name || "Sistema"} ·{" "}
                          {h.created_at
                            ? new Date(h.created_at).toLocaleString("it-IT")
                            : "—"}
                        </p>
                        {h.reason && (
                          <p className="text-xs mt-1 text-muted-foreground italic">
                            {h.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar actions */}
        {actions.length > 0 && (
          <div className="w-full lg:w-64 shrink-0 space-y-2">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3">
              Azioni
            </h3>
            {actions.map((a) => (
              <Button
                key={a.key}
                variant={a.variant}
                className="w-full justify-start"
                onClick={a.onClick}
              >
                <a.icon className="h-4 w-4 mr-2" />
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* ── Action Dialog ── */}
      <Dialog
        open={!!actionDialog}
        onOpenChange={(open) => {
          if (!open) {
            setActionDialog(null);
            setDialogMessage("");
            setRevokeConfirm("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog ? dialogTitle[actionDialog.type] : ""}
            </DialogTitle>
            {actionDialog?.type === "revoke" && (
              <DialogDescription>
                Questa azione è irreversibile. Digita{" "}
                <strong>REVOCA</strong> per confermare.
              </DialogDescription>
            )}
            {actionDialog?.type === "enable" && (
              <DialogDescription>
                Il fornitore potrà accedere al wizard di onboarding.
              </DialogDescription>
            )}
            {actionDialog?.type === "approve" && (
              <DialogDescription>
                Il fornitore verrà accreditato e potrà partecipare alle gare.
              </DialogDescription>
            )}
          </DialogHeader>

          {(actionDialog?.type === "integrate" ||
            actionDialog?.type === "suspend") && (
            <div className="space-y-2">
              <Label>
                {actionDialog.type === "suspend"
                  ? "Motivo sospensione *"
                  : "Messaggio *"}
              </Label>
              <Textarea
                value={dialogMessage}
                onChange={(e) => setDialogMessage(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {actionDialog?.type === "revoke" && (
            <div className="space-y-2">
              <Label>
                Digita <strong>REVOCA</strong> per confermare
              </Label>
              <Input
                value={revokeConfirm}
                onChange={(e) => setRevokeConfirm(e.target.value)}
                placeholder="REVOCA"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionDialog(null);
                setDialogMessage("");
                setRevokeConfirm("");
              }}
            >
              Annulla
            </Button>
            <Button
              variant={
                actionDialog?.type === "suspend" ||
                actionDialog?.type === "revoke"
                  ? "destructive"
                  : "default"
              }
              disabled={statusMutation.isPending}
              onClick={handleDialogSubmit}
            >
              {statusMutation.isPending ? "Salvataggio…" : "Conferma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Dialog rifiuto documento ── */}
      <Dialog
        open={!!rejectDocDialog}
        onOpenChange={(open) => {
          if (!open) {
            setRejectDocDialog(null);
            setRejectDocNotes("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respingi documento</DialogTitle>
            <DialogDescription>
              Documento: {rejectDocDialog ? (dtMap[rejectDocDialog.document_type_id]?.name ?? rejectDocDialog.original_filename) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Motivo del rifiuto <span className="text-destructive">*</span></Label>
              <Textarea
                value={rejectDocNotes}
                onChange={(e) => setRejectDocNotes(e.target.value)}
                placeholder="Specifica il motivo del rifiuto…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDocDialog(null)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectDocNotes.trim() || reviewMutation.isPending}
              onClick={() => {
                if (rejectDocDialog) {
                  reviewMutation.mutate({
                    doc: rejectDocDialog,
                    action: "rejected",
                    reviewNotes: rejectDocNotes.trim(),
                  });
                }
              }}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Conferma rifiuto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Subcomponent ──
function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}
