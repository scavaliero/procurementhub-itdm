import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentService } from "@/services/documentService";
import { vendorService } from "@/services/vendorService";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle2, AlertCircle, Clock, Trash2, Send, Lock } from "lucide-react";
import { useRef, useState } from "react";
import type { DocumentType, UploadedDocument } from "@/types";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  approved: { label: "Approvato", variant: "default", icon: CheckCircle2 },
  uploaded: { label: "In revisione", variant: "secondary", icon: Clock },
  rejected: { label: "Respinto", variant: "destructive", icon: AlertCircle },
  not_uploaded: { label: "Da caricare", variant: "outline", icon: Upload },
  expired: { label: "Scaduto", variant: "destructive", icon: AlertCircle },
};

/** States where documents are locked (waiting for admin review) */
const LOCKED_STATUSES = ["in_accreditation", "in_approval", "pending_review"];

function DocumentCard({
  docType,
  uploaded,
  supplierId,
  tenantId,
  locked,
}: {
  docType: DocumentType;
  uploaded: UploadedDocument | undefined;
  supplierId: string;
  tenantId: string;
  locked: boolean;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const expiryRef = useRef<HTMLInputElement>(null);

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => documentService.deleteDocument(docId),
    onSuccess: () => {
      toast.success("Documento eliminato — puoi ricaricarlo");
      qc.invalidateQueries({ queryKey: ["supplier-documents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const expiryDate = expiryRef.current?.value;
      if (!expiryDate) {
        throw new Error("La data di scadenza è obbligatoria");
      }
      await documentService.uploadDocument({
        supplierId,
        documentTypeId: docType.id,
        tenantId,
        file,
        expiryDate,
        needsManualReview: docType.needs_manual_review ?? true,
      });
    },
    onSuccess: () => {
      toast.success(`${docType.name} caricato`);
      qc.invalidateQueries({ queryKey: ["supplier-documents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isExpiringSoon = uploaded?.status === "approved" && uploaded?.expiry_date &&
    new Date(uploaded.expiry_date) > new Date() &&
    new Date(uploaded.expiry_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const isExpired = uploaded?.status === "approved" && uploaded?.expiry_date &&
    new Date(uploaded.expiry_date) < new Date();

  const effectiveStatus = isExpired ? "expired" : uploaded?.status || "not_uploaded";
  const cfg = statusConfig[effectiveStatus] || statusConfig.not_uploaded;
  const StatusIcon = cfg.icon;

  return (
    <Card className={`card-top-docs ${locked ? "opacity-80" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {locked ? (
              <Lock className="h-4 w-4 text-muted-foreground" />
            ) : (
              <FileText className="h-4 w-4 text-muted-foreground" />
            )}
            <CardTitle className="text-sm font-medium">{docType.name}</CardTitle>
          </div>
          <Badge variant={cfg.variant} className="text-xs gap-1">
            <StatusIcon className="h-3 w-3" />
            {cfg.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {docType.description && (
          <p className="text-xs text-muted-foreground">{docType.description}</p>
        )}

        {/* Locked banner */}
        {locked && uploaded && (
          <div className="rounded-md bg-muted border px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" /> Documenti inviati — in attesa di revisione
            </p>
          </div>
        )}

        {uploaded?.review_notes && uploaded.status === "rejected" && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
            <p className="text-xs font-medium text-destructive">Motivo rifiuto:</p>
            <p className="text-xs text-destructive/80 mt-0.5">{uploaded.review_notes}</p>
          </div>
        )}

        {isExpiringSoon && (
          <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 px-3 py-2">
            <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400">
              ⚠ Documento in scadenza il {new Date(uploaded!.expiry_date!).toLocaleDateString("it-IT")}
            </p>
          </div>
        )}

        {isExpired && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
            <p className="text-xs font-medium text-destructive">
              Documento scaduto il {new Date(uploaded!.expiry_date!).toLocaleDateString("it-IT")}
            </p>
          </div>
        )}

        {uploaded?.expiry_date && uploaded.status !== "rejected" && !isExpiringSoon && !isExpired && (
          <p className="text-xs text-muted-foreground">
            Scadenza: {new Date(uploaded.expiry_date).toLocaleDateString("it-IT")}
          </p>
        )}
        {uploaded?.original_filename && uploaded.status !== "rejected" && !isExpired && (
          <p className="text-xs truncate">{uploaded.original_filename}</p>
        )}

        {/* Actions — hidden when locked */}
        {!locked && (
          <>
            {uploaded?.status === "rejected" && (
              <Button
                size="sm"
                variant="destructive"
                className="w-full"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(uploaded.id)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                {deleteMutation.isPending ? "Eliminazione…" : "Elimina e ricarica"}
              </Button>
            )}

            {(!uploaded || uploaded.status !== "rejected") && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">
                    Data scadenza <span className="text-destructive">*</span>
                  </Label>
                  <Input ref={expiryRef} type="date" className="h-8 text-xs" required />
                </div>
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept={docType.allowed_formats?.map((f) => `.${f}`).join(",") || "*"}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const maxBytes = (docType.max_size_mb || 10) * 1024 * 1024;
                        if (file.size > maxBytes) {
                          toast.error(`File troppo grande. Max ${docType.max_size_mb || 10}MB`);
                          return;
                        }
                        uploadMutation.mutate(file);
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant={isExpired || isExpiringSoon ? "default" : "outline"}
                    className="w-full"
                    disabled={uploadMutation.isPending}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    {uploadMutation.isPending
                      ? "Caricamento…"
                      : isExpired
                      ? "Sostituisci documento scaduto"
                      : isExpiringSoon
                      ? "Sostituisci documento"
                      : uploaded
                      ? "Ricarica"
                      : "Carica"}
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        {docType.is_mandatory && (
          <p className="text-[10px] text-destructive">* Obbligatorio</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function SupplierDocuments() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: supplier, isLoading: supLoading } = useQuery({
    queryKey: ["my-supplier"],
    queryFn: () => vendorService.getMySupplier(),
    enabled: !!profile,
  });

  const { data: docTypes = [], isLoading: dtLoading } = useQuery({
    queryKey: ["document-types"],
    queryFn: () => documentService.listDocumentTypes(),
  });

  const { data: uploadedDocs = [], isLoading: udLoading } = useQuery({
    queryKey: ["supplier-documents", supplier?.id],
    queryFn: () => documentService.getSupplierDocuments(supplier!.id),
    enabled: !!supplier,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!supplier) throw new Error("Fornitore non trovato");
      await vendorService.updateSupplier(supplier.id, { status: "in_accreditation" as any });
    },
    onSuccess: () => {
      toast.success("Documenti inviati per revisione");
      setShowConfirm(false);
      qc.invalidateQueries({ queryKey: ["my-supplier"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (supLoading || dtLoading || udLoading) return <PageSkeleton />;
  if (!supplier) {
    return (
      <div className="p-6">
        <EmptyState title="Profilo fornitore non trovato" />
      </div>
    );
  }

  // Build map: latest upload per document_type_id
  const latestByType: Record<string, UploadedDocument> = {};
  uploadedDocs.forEach((d) => {
    if (!latestByType[d.document_type_id] || d.version > latestByType[d.document_type_id].version) {
      latestByType[d.document_type_id] = d;
    }
  });

  const mandatory = docTypes.filter((dt) => dt.is_mandatory);
  const mandatoryUploaded = mandatory.filter(
    (dt) => latestByType[dt.id] && latestByType[dt.id].status !== "rejected"
  ).length;
  const approved = mandatory.filter(
    (dt) => latestByType[dt.id]?.status === "approved"
  ).length;
  const progressPct = mandatory.length > 0 ? (approved / mandatory.length) * 100 : 0;

  const isLocked = LOCKED_STATUSES.includes(supplier.status);
  const canSubmit = !isLocked
    && supplier.status === "enabled"
    && mandatory.length > 0
    && mandatoryUploaded >= mandatory.length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documenti</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isLocked
            ? "I documenti sono stati inviati e sono in attesa di revisione."
            : "Carica i documenti richiesti per la qualifica."}
        </p>
      </div>

      {mandatory.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">
                Documenti obbligatori approvati: {approved}/{mandatory.length}
              </p>
              <span className="text-sm text-muted-foreground">{Math.round(progressPct)}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />
            {isLocked && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Lock className="h-3 w-3" /> In attesa di revisione da parte dell'amministratore
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submit button */}
      {canSubmit && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Tutti i documenti obbligatori sono stati caricati</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Invia i documenti per la revisione. Non potrai modificarli fino al completamento della revisione.
              </p>
            </div>
            <Button onClick={() => setShowConfirm(true)} className="gap-2 shrink-0">
              <Send className="h-4 w-4" /> Invia per revisione
            </Button>
          </CardContent>
        </Card>
      )}

      {docTypes.length === 0 ? (
        <EmptyState
          title="Nessun documento richiesto"
          description="Non ci sono tipi documento configurati al momento."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {docTypes.map((dt) => (
            <DocumentCard
              key={dt.id}
              docType={dt}
              uploaded={latestByType[dt.id]}
              supplierId={supplier.id}
              tenantId={supplier.tenant_id}
              locked={isLocked}
            />
          ))}
        </div>
      )}

      {/* Confirm dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma invio documenti</DialogTitle>
            <DialogDescription>
              Una volta inviati, i documenti non potranno essere modificati fino al completamento della revisione da parte dell'amministratore.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Annulla</Button>
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {submitMutation.isPending ? "Invio…" : "Conferma invio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
