import { useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { supabase } from "@/integrations/supabase/client";
import { changeRequestService } from "@/services/changeRequestService";
import { SUPPLIER_STATUS_CONFIG } from "@/lib/supplierStatusConfig";
import { maskIBAN } from "@/utils/formatters";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { documentService } from "@/services/documentService";
import { contactService } from "@/services/contactService";
import { auditService } from "@/services/auditService";
import { notificationService } from "@/services/notificationService";
import { useGrants } from "@/hooks/useGrants";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  RotateCcw,
} from "lucide-react";
import type {
  UploadedDocument,
  Supplier,
  SupplierCategory,
  SupplierStatusHistory,
} from "@/types";

/* ── Status display config ── */
const STATUS_LABELS = SUPPLIER_STATUS_CONFIG;

const DOC_LABELS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  approved: { label: "Approvato", variant: "default" },
  uploaded: { label: "In revisione", variant: "secondary" },
  rejected: { label: "Respinto", variant: "destructive" },
  expired: { label: "Scaduto", variant: "destructive" },
};

/* ── Helpers ── */
function fmtAddress(addr: unknown): string {
  if (!addr || typeof addr !== "object") return "—";
  const a = addr as Record<string, string>;
  return [a.street, a.city, a.province, a.zip, a.country].filter(Boolean).join(", ") || "—";
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT");
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("it-IT");
}

/* ── Action type union ── */
type ActionType =
  | "enable"
  | "approve"
  | "integrate"
  | "suspend"
  | "revoke"
  | "reactivate"
  | "reject";

/* ════════════════════════════════════════════
   Main Component
   ════════════════════════════════════════════ */
export default function InternalVendorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasGrant } = useGrants();

  /* state */
  const [activeDialog, setActiveDialog] = useState<ActionType | null>(null);
  const [dialogMsg, setDialogMsg] = useState("");
  const [revokeText, setRevokeText] = useState("");
  const [banUser, setBanUser] = useState(false);
  const [rejectDoc, setRejectDoc] = useState<UploadedDocument | null>(null);
  const [rejectDocNotes, setRejectDocNotes] = useState("");

  /* ── Queries ── */
  const { data: supplier, isLoading } = useQuery({
    queryKey: ["supplier", id],
    queryFn: () => vendorService.getSupplier(id!),
    enabled: !!id,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["supplier-profiles", id],
    queryFn: () => vendorService.getSupplierProfiles(id!),
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

  const { data: allCategories = [] } = useQuery({
    queryKey: ["all-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name, code");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: existingContacts = [] } = useQuery({
    queryKey: ["supplier-contacts", id],
    queryFn: () => contactService.list(id!),
    enabled: !!id,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["supplier-history", id],
    queryFn: () => vendorService.getStatusHistory(id!),
    enabled: !!id,
  });

  const { data: changeRequests = [] } = useQuery({
    queryKey: ["supplier-change-requests", id],
    queryFn: () => changeRequestService.listForSupplier(id!),
    enabled: !!id,
  });

  const { profile: currentProfile } = useAuth();

  /* ── Invalidation helper ── */
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["supplier", id] });
    qc.invalidateQueries({ queryKey: ["supplier-history", id] });
    qc.invalidateQueries({ queryKey: ["supplier-categories", id] });
    qc.invalidateQueries({ queryKey: ["supplier-documents", id] });
    qc.invalidateQueries({ queryKey: ["supplier-status-counts"] });
    qc.invalidateQueries({ queryKey: ["suppliers-paginated"] });
  };

  const closeDialog = () => {
    setActiveDialog(null);
    setDialogMsg("");
    setRevokeText("");
    setBanUser(false);
  };

  /* ── Status mutation ── */
  const statusMut = useMutation({
    mutationFn: (p: { toStatus: string; reason?: string; extraUpdate?: Partial<Supplier> }) =>
      vendorService.changeStatus({
        supplierId: id!,
        fromStatus: supplier!.status,
        toStatus: p.toStatus,
        reason: p.reason,
        extraUpdate: p.extraUpdate,
      }),
    onSuccess: () => {
      toast.success("Stato aggiornato");
      invalidateAll();
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  /* ── Document review mutation ── */
  const reviewMut = useMutation({
    mutationFn: async ({
      doc,
      action,
      notes,
    }: {
      doc: UploadedDocument;
      action: "approved" | "rejected";
      notes?: string;
    }) => {
      const result = await documentService.reviewDocument(doc.id, action, notes);
      if (supplier) {
        await auditService.log({
          tenant_id: supplier.tenant_id,
          entity_type: "uploaded_documents",
          entity_id: doc.id,
          event_type: `document_${action}`,
          old_state: { status: doc.status },
          new_state: { status: action, review_notes: notes || null },
        });
        try {
          const pid = await vendorService.getSupplierProfileId(supplier.id);
          if (pid) {
            const dtMap = Object.fromEntries(docTypes.map((dt) => [dt.id, dt]));
            await notificationService.send({
              event_type: `document_${action}`,
              recipient_id: pid,
              tenant_id: supplier.tenant_id,
              link_url: `/supplier/documents`,
              related_entity_id: doc.id,
              related_entity_type: "uploaded_document",
              variables: {
                document_name: dtMap[doc.document_type_id]?.name || "",
                ...(notes ? { review_notes: notes } : {}),
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
      setRejectDoc(null);
      setRejectDocNotes("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  /* ── Download ── */
  const downloadMut = useMutation({
    mutationFn: async (path: string) => {
      const url = await documentService.getSignedUrl(path);
      window.open(url, "_blank");
    },
    onError: () => toast.error("Errore nel download"),
  });

  /* ── Loading / not found ── */
  if (isLoading) return <PageSkeleton />;
  if (!supplier) {
    return (
      <div className="p-6">
        <EmptyState title="Fornitore non trovato" />
      </div>
    );
  }

  const badge = STATUS_LABELS[supplier.status] || STATUS_LABELS.pre_registered;
  const dtMap = Object.fromEntries(docTypes.map((dt) => [dt.id, dt]));
  const canReview = hasGrant("review_documents");
  const canApprove = hasGrant("approve_accreditation");
  const canSuspend = hasGrant("suspend_supplier");

  /* ── Build action buttons based on status ── */
  const actions: {
    key: string;
    label: string;
    icon: React.ElementType;
    variant: "default" | "destructive" | "outline";
    type: ActionType;
  }[] = [];

  const s = supplier.status;

  // pending_review → Abilita / Rifiuta
  if (s === "pending_review" && canReview) {
    actions.push({ key: "enable", label: "Abilita processo qualifica", icon: Unlock, variant: "default", type: "enable" });
    actions.push({ key: "reject-reg", label: "Rifiuta registrazione", icon: XCircle, variant: "destructive", type: "reject" });
  }

  // in_approval / in_accreditation → Approva / Rifiuta / Integrazione
  if ((s === "in_approval" || s === "in_accreditation") && canApprove) {
    actions.push({ key: "approve", label: "Approva accreditamento", icon: ShieldCheck, variant: "default", type: "approve" });
    actions.push({ key: "reject-qual", label: "Rifiuta qualifica", icon: XCircle, variant: "destructive", type: "reject" });
  }
  if ((s === "in_accreditation" || s === "in_approval") && canReview) {
    actions.push({ key: "integrate", label: "Richiedi integrazione", icon: Send, variant: "outline", type: "integrate" });
  }

  // accredited → Sospendi / Revoca
  if (s === "accredited" && canSuspend) {
    actions.push({ key: "suspend", label: "Sospendi", icon: AlertTriangle, variant: "destructive", type: "suspend" });
    actions.push({ key: "revoke", label: "Revoca", icon: Ban, variant: "destructive", type: "revoke" });
  }

  // suspended → Riattiva / Revoca
  if (s === "suspended" && canSuspend) {
    actions.push({ key: "reactivate", label: "Riattiva", icon: RotateCcw, variant: "default", type: "reactivate" });
    actions.push({ key: "revoke", label: "Revoca", icon: Ban, variant: "destructive", type: "revoke" });
  }

  /* ── Dialog submit ── */
  const handleDialogSubmit = async () => {
    if (!activeDialog) return;

    switch (activeDialog) {
      case "enable":
        statusMut.mutate(
          { toStatus: "enabled" },
          {
            onSuccess: async () => {
              try {
                const p = profiles[0];
                if (p) {
                  await supabase.functions.invoke("send-notification", {
                    body: {
                      event_type: "supplier_enabled",
                      recipient_id: p.id,
                      tenant_id: supplier.tenant_id,
                      link_url: "/supplier/onboarding",
                      related_entity_id: supplier.id,
                      related_entity_type: "supplier",
                      variables: {
                        company_name: supplier.company_name,
                        contact_name: p.full_name,
                        login_url: `${window.location.origin}/login`,
                      },
                    },
                  });
                }
              } catch (e) {
                console.error("Email error:", e);
              }
            },
          }
        );
        break;

      case "approve": {
        const pending = docs.filter((d) => d.status !== "approved");
        if (pending.length > 0) {
          toast.error(`Impossibile approvare: ${pending.length} documenti non ancora approvati.`);
          return;
        }
        statusMut.mutate(
          {
            toStatus: "accredited",
            extraUpdate: { accredited_at: new Date().toISOString() },
          },
          {
            onSuccess: () => {
              toast.success(`Il fornitore "${supplier.company_name}" è stato accreditato`);
            },
          }
        );
        break;
      }

      case "integrate":
        if (!dialogMsg.trim()) { toast.error("Inserisci un messaggio"); return; }
        statusMut.mutate({ toStatus: supplier.status, reason: dialogMsg });
        break;

      case "suspend":
        if (!dialogMsg.trim()) { toast.error("Inserisci il motivo della sospensione"); return; }
        statusMut.mutate({
          toStatus: "suspended",
          reason: dialogMsg,
          extraUpdate: { suspension_reason: dialogMsg, suspended_at: new Date().toISOString() },
        });
        break;

      case "revoke":
        if (revokeText !== "REVOCA") { toast.error("Digita REVOCA per confermare"); return; }
        statusMut.mutate({ toStatus: "revoked" });
        break;

      case "reactivate":
        if (!dialogMsg.trim()) { toast.error("Inserisci il motivo della riattivazione"); return; }
        statusMut.mutate({
          toStatus: "accredited",
          reason: dialogMsg,
          extraUpdate: { suspension_reason: null, suspended_at: null },
        });
        break;

      case "reject":
        if (!dialogMsg.trim()) { toast.error("Inserisci il motivo del rifiuto"); return; }
        if (banUser) {
          try {
            await supabase.functions.invoke("ban-supplier-user", { body: { supplier_id: id, ban: true } });
          } catch (e) { console.error("Ban error:", e); }
        }
        statusMut.mutate({ toStatus: "rejected", reason: dialogMsg });
        break;
    }
  };

  const dialogTitles: Record<ActionType, string> = {
    enable: "Abilita processo qualifica",
    approve: "Approva accreditamento",
    integrate: "Richiedi integrazione",
    suspend: "Sospendi fornitore",
    revoke: "Revoca fornitore",
    reactivate: "Riattiva fornitore",
    reject: "Rifiuta registrazione",
  };

  /* ════════════════════════════════════════════
     Render
     ════════════════════════════════════════════ */
  return (
    <div className="p-6 space-y-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/internal/dashboard" },
          { label: "Fornitori", href: "/internal/vendors" },
          { label: supplier.company_name },
        ]}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/internal/vendors")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{supplier.company_name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {supplier.company_type || "—"} · {supplier.pec || "—"}
            </p>
          </div>
        </div>
        <Badge variant={badge.variant} className="text-sm shrink-0">
          {badge.label}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info"><Building2 className="h-4 w-4 mr-1" /> Anagrafica</TabsTrigger>
          {(() => {
            const pendingDocs = docs.filter((d) => d.status === "uploaded");
            const hasPending = pendingDocs.length > 0;
            return (
              <TabsTrigger value="documents" className={hasPending ? "font-bold" : ""}>
                <FileText className="h-4 w-4 mr-1" /> Documenti
                {hasPending && <span className="ml-1 text-xs">({pendingDocs.length})</span>}
              </TabsTrigger>
            );
          })()}
          <TabsTrigger value="categories"><FolderTree className="h-4 w-4 mr-1" /> Categorie</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-1" /> Storico</TabsTrigger>
          {(() => {
            const pendingChanges = changeRequests.filter((r) => r.status === "pending");
            if (changeRequests.length === 0) return null;
            const hasPending = pendingChanges.length > 0;
            return (
              <TabsTrigger value="changes" className={hasPending ? "font-bold" : ""}>
                Richieste modifica
                {hasPending && <span className="ml-1 text-xs">({pendingChanges.length})</span>}
              </TabsTrigger>
            );
          })()}
        </TabsList>

        {/* ── Tab Anagrafica ── */}
        <TabsContent value="info" className="mt-4 space-y-4">
          <Card className="card-top-suppliers">
            <CardHeader><CardTitle className="text-base">Dati Azienda</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <Field label="Ragione Sociale" value={supplier.company_name} />
                <Field label="Tipo Società" value={supplier.company_type} />
                <Field label="PEC" value={supplier.pec} />
                <Field label="Website" value={supplier.website} />
                <Field label="Indirizzo Legale" value={fmtAddress(supplier.legal_address)} />
                <Field label="P.IVA" value={supplier.vat_number_hash ? "•••••••••••" : null} />
                <Field label="IBAN (mascherato)" value={maskIBAN(supplier.iban_masked)} />
                <Field
                  label="Rating"
                  value={supplier.rating_score != null ? `${supplier.rating_score} (${supplier.rating_count || 0} val.)` : null}
                />
                <Field label="Accreditato il" value={supplier.accredited_at ? fmtDate(supplier.accredited_at) : null} />
                <Field label="Motivo sospensione" value={supplier.suspension_reason} />
                <Field label="Note" value={supplier.notes} />
                <Field label="Registrato il" value={fmtDate(supplier.created_at)} />
              </div>
            </CardContent>
          </Card>

          {profiles.length > 0 && (
            <Card className="card-top-suppliers">
              <CardHeader><CardTitle className="text-base">Referenti</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {profiles.map((p) => (
                    <div key={p.id} className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-1 text-sm border-b last:border-0 pb-3 last:pb-0">
                      <Field label="Nome" value={p.full_name} />
                      <Field label="Email" value={p.email} />
                      <Field label="Telefono" value={p.phone} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Action buttons — always visible here after Referenti ── */}
          {actions.length > 0 && (
            <Card className="card-top-suppliers">
              <CardHeader><CardTitle className="text-base">Azioni disponibili</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {actions.map((a) => (
                    <Button
                      key={a.key}
                      variant={a.variant}
                      onClick={() => {
                        if (a.type === "reject") setBanUser(false);
                        setActiveDialog(a.type);
                      }}
                    >
                      <a.icon className="h-4 w-4 mr-2" />
                      {a.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab Documenti ── */}
        <TabsContent value="documents" className="mt-4 space-y-3">
          {docs.length === 0 ? (
            <EmptyState title="Nessun documento caricato" description="Il fornitore non ha ancora caricato documenti." />
          ) : (
            docs.map((doc) => {
              const dt = dtMap[doc.document_type_id];
              const db = DOC_LABELS[doc.status] || { label: doc.status, variant: "outline" as const };
              return (
                <Card key={doc.id} className="card-top-docs">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{dt?.name || doc.document_type_id}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.original_filename} · v{doc.version}
                          {doc.expiry_date && ` · Scade: ${fmtDate(doc.expiry_date)}`}
                        </p>
                        {doc.review_notes && (
                          <p className="text-xs text-muted-foreground mt-1">Note: {doc.review_notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={db.variant}>{db.label}</Badge>
                        {doc.storage_path && (
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => downloadMut.mutate(doc.storage_path!)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        {canReview && doc.status === "uploaded" && (
                          <>
                            <Button size="sm" disabled={reviewMut.isPending} onClick={() => reviewMut.mutate({ doc, action: "approved" })}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approva
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={reviewMut.isPending}
                              onClick={() => { setRejectDoc(doc); setRejectDocNotes(""); }}
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
            <EmptyState title="Nessuna categoria" description="Il fornitore non ha selezionato categorie." />
          ) : (
            categories.map((sc: SupplierCategory) => (
              <Card key={sc.id} className="card-top-suppliers">
                <CardContent className="pt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{sc.categories?.name || sc.category_id}</p>
                    <p className="text-xs text-muted-foreground">
                      Codice: {sc.categories?.code || "—"}
                      {sc.qualified_at && ` · Qualificato: ${fmtDate(sc.qualified_at)}`}
                    </p>
                  </div>
                  <Badge variant={sc.status === "qualified" ? "default" : "secondary"}>
                    {sc.status === "qualified" ? "Qualificato" : "In attesa"}
                  </Badge>
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
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    {idx < history.length - 1 && <div className="w-px flex-1 bg-border" />}
                  </div>
                  <div className="pb-6 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {h.from_status && (
                        <>
                          <Badge variant="outline" className="text-xs">
                            {STATUS_LABELS[h.from_status]?.label || h.from_status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">→</span>
                        </>
                      )}
                      <Badge variant={STATUS_LABELS[h.to_status]?.variant || "outline"} className="text-xs">
                        {STATUS_LABELS[h.to_status]?.label || h.to_status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {h.changer?.full_name || "Sistema"} · {fmtDateTime(h.created_at)}
                    </p>
                    {h.reason && <p className="text-xs mt-1 text-muted-foreground italic">{h.reason}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Tab Richieste Modifica ── */}
        {changeRequests.length > 0 && (
          <TabsContent value="changes" className="mt-4 space-y-3">
            {changeRequests.map((req: any) => {
              const changes = req.requested_changes || {};
              const isPending = req.status === "pending";
              return (
                <Card key={req.id} className={isPending ? "card-top-docs" : ""}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          Richiesta del {fmtDateTime(req.created_at)}
                        </p>
                        {req.review_notes && (
                          <p className="text-xs text-muted-foreground mt-1">Note: {req.review_notes}</p>
                        )}
                      </div>
                      <Badge variant={req.status === "approved" ? "default" : req.status === "rejected" ? "destructive" : "secondary"}>
                        {req.status === "pending" ? "In attesa" : req.status === "approved" ? "Approvata" : "Rifiutata"}
                      </Badge>
                    </div>

                    {/* Show requested changes summary */}
                    <div className="text-xs space-y-1 bg-muted/50 rounded p-3">
                      {changes.company_data && (
                        <div>
                          <span className="font-medium">Dati azienda modificati:</span>
                          <ul className="list-disc ml-4 mt-0.5">
                            {changes.company_data.company_name !== undefined && <li>Ragione sociale: <strong>{changes.company_data.company_name}</strong></li>}
                            {changes.company_data.company_type !== undefined && <li>Tipo società: <strong>{changes.company_data.company_type || "—"}</strong></li>}
                            {changes.company_data.pec !== undefined && <li>PEC: <strong>{changes.company_data.pec || "—"}</strong></li>}
                            {changes.company_data.website !== undefined && <li>Sito Web: <strong>{changes.company_data.website || "—"}</strong></li>}
                          </ul>
                        </div>
                      )}
                      {changes.address && (
                        <div>
                          <span className="font-medium">Sede modificata:</span>
                          <ul className="list-disc ml-4 mt-0.5">
                            {changes.address.street !== undefined && <li>Via/Piazza: <strong>{changes.address.street || "—"}</strong></li>}
                            {changes.address.city !== undefined && <li>Città: <strong>{changes.address.city || "—"}</strong></li>}
                            {changes.address.zip !== undefined && <li>CAP: <strong>{changes.address.zip || "—"}</strong></li>}
                            {changes.address.province !== undefined && <li>Provincia: <strong>{changes.address.province || "—"}</strong></li>}
                            {changes.address.country !== undefined && <li>Nazione: <strong>{changes.address.country || "—"}</strong></li>}
                          </ul>
                        </div>
                      )}
                      {changes.contacts?.length > 0 && (() => {
                        const dbContacts = (existingContacts || []) as any[];
                        return (
                          <div>
                            <span className="font-medium">Referenti modificati:</span>
                            <ul className="list-disc ml-4 mt-0.5">
                              {changes.contacts.map((c: any, idx: number) => {
                                const existing = dbContacts[idx];
                                if (!existing) {
                                  return <li key={idx}>Nuovo: <strong>{c.nome} {c.cognome}</strong> ({c.email})</li>;
                                }
                                const diffs: string[] = [];
                                if (c.nome !== (existing.first_name || existing.nome || "")) diffs.push(`Nome: ${c.nome}`);
                                if (c.cognome !== (existing.last_name || existing.cognome || "")) diffs.push(`Cognome: ${c.cognome}`);
                                if (c.ruolo !== (existing.role || existing.ruolo || "")) diffs.push(`Ruolo: ${c.ruolo}`);
                                if (c.email !== (existing.email || "")) diffs.push(`Email: ${c.email}`);
                                if (c.phone !== (existing.phone || "")) diffs.push(`Telefono: ${c.phone}`);
                                if (diffs.length === 0) return null;
                                return <li key={idx}>{c.nome} {c.cognome}: <strong>{diffs.join(", ")}</strong></li>;
                              })}
                              {dbContacts.length > changes.contacts.length && (
                                <li className="text-destructive">Rimossi {dbContacts.length - changes.contacts.length} referenti</li>
                              )}
                            </ul>
                          </div>
                        );
                      })()}
                      {changes.categories?.length > 0 && (() => {
                        const catMap = Object.fromEntries(allCategories.map((c: any) => [c.id, c.name]));
                        const currentCatIds = categories.map((c: any) => c.category_id);
                        const newCatIds: string[] = changes.categories;
                        const added = newCatIds.filter((cid: string) => !currentCatIds.includes(cid));
                        const removed = currentCatIds.filter((cid: string) => !newCatIds.includes(cid));
                        return (
                          <div>
                            <span className="font-medium">Categorie modificate:</span>
                            <ul className="list-disc ml-4 mt-0.5">
                              {added.length > 0 && <li className="text-primary">Aggiunte: <strong>{added.map((cid: string) => catMap[cid] || cid).join(", ")}</strong></li>}
                              {removed.length > 0 && <li className="text-destructive">Rimosse: <strong>{removed.map((cid: string) => catMap[cid] || cid).join(", ")}</strong></li>}
                              {added.length === 0 && removed.length === 0 && <li>Nessuna variazione rilevata</li>}
                            </ul>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Actions for pending requests */}
                    {isPending && hasGrant("review_change_requests") && (
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={async () => {
                            try {
                              await changeRequestService.approve(req.id, currentProfile!.id, supplier.id, changes);
                              toast.success("Modifiche approvate e applicate");
                              qc.invalidateQueries({ queryKey: ["supplier-change-requests", id] });
                              qc.invalidateQueries({ queryKey: ["supplier", id] });
                            } catch (e: any) { toast.error(e.message); }
                          }}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approva e applica
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={async () => {
                            const notes = prompt("Motivo del rifiuto:");
                            if (!notes) return;
                            try {
                              await changeRequestService.reject(req.id, currentProfile!.id, notes);
                              toast.success("Richiesta rifiutata");
                              qc.invalidateQueries({ queryKey: ["supplier-change-requests", id] });
                            } catch (e: any) { toast.error(e.message); }
                          }}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Rifiuta
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        )}
      </Tabs>

      {/* ── Action Dialog ── */}
      <Dialog open={!!activeDialog} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeDialog ? dialogTitles[activeDialog] : ""}</DialogTitle>
            {activeDialog === "enable" && (
              <DialogDescription>Il fornitore potrà procedere con il caricamento documenti e la qualifica.</DialogDescription>
            )}
            {activeDialog === "approve" && (
              <DialogDescription>Il fornitore verrà accreditato e potrà partecipare alle gare.</DialogDescription>
            )}
            {activeDialog === "reject" && (
              <DialogDescription>La registrazione verrà rifiutata. Puoi anche bloccare l'utente.</DialogDescription>
            )}
            {activeDialog === "revoke" && (
              <DialogDescription>Questa azione è irreversibile. Digita <strong>REVOCA</strong> per confermare.</DialogDescription>
            )}
          </DialogHeader>

          {(activeDialog === "integrate" || activeDialog === "suspend" || activeDialog === "reactivate" || activeDialog === "reject") && (
            <div className="space-y-2">
              <Label>
                {activeDialog === "suspend" ? "Motivo sospensione *"
                  : activeDialog === "reactivate" ? "Motivo riattivazione *"
                  : activeDialog === "reject" ? "Motivo del rifiuto *"
                  : "Messaggio *"}
              </Label>
              <Textarea value={dialogMsg} onChange={(e) => setDialogMsg(e.target.value)} rows={3} />
            </div>
          )}

          {activeDialog === "reject" && (
            <div className="flex items-center space-x-2">
              <Checkbox id="ban-user" checked={banUser} onCheckedChange={(c) => setBanUser(!!c)} />
              <Label htmlFor="ban-user" className="text-sm font-normal cursor-pointer">
                Blocca l'utente (impedisce future registrazioni)
              </Label>
            </div>
          )}

          {activeDialog === "revoke" && (
            <div className="space-y-2">
              <Label>Digita <strong>REVOCA</strong> per confermare</Label>
              <Input value={revokeText} onChange={(e) => setRevokeText(e.target.value)} placeholder="REVOCA" />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Annulla</Button>
            <Button
              variant={activeDialog === "suspend" || activeDialog === "revoke" || activeDialog === "reject" ? "destructive" : "default"}
              disabled={statusMut.isPending}
              onClick={handleDialogSubmit}
            >
              {statusMut.isPending ? "Salvataggio…" : "Conferma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject document dialog ── */}
      <Dialog open={!!rejectDoc} onOpenChange={(o) => { if (!o) { setRejectDoc(null); setRejectDocNotes(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respingi documento</DialogTitle>
            <DialogDescription>
              {rejectDoc ? (dtMap[rejectDoc.document_type_id]?.name ?? rejectDoc.original_filename) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo del rifiuto <span className="text-destructive">*</span></Label>
            <Textarea value={rejectDocNotes} onChange={(e) => setRejectDocNotes(e.target.value)} placeholder="Specifica il motivo…" rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDoc(null)}>Annulla</Button>
            <Button
              variant="destructive"
              disabled={!rejectDocNotes.trim() || reviewMut.isPending}
              onClick={() => { if (rejectDoc) reviewMut.mutate({ doc: rejectDoc, action: "rejected", notes: rejectDocNotes.trim() }); }}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" /> Conferma rifiuto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Field subcomponent ── */
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}
