import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { documentService } from "@/services/documentService";
import { getEffectiveDocStatus, isDocExpiringSoon } from "@/lib/documentUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Upload, FileText, CheckCircle2, AlertCircle, Clock, Trash2, Lock, Plus, Pencil,
} from "lucide-react";
import { DocumentDatePicker } from "./DocumentDatePicker";
import type { DocumentType, UploadedDocument } from "@/types";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  approved: { label: "Approvato", variant: "default", icon: CheckCircle2 },
  uploaded: { label: "In revisione", variant: "secondary", icon: Clock },
  rejected: { label: "Respinto", variant: "destructive", icon: AlertCircle },
  not_uploaded: { label: "Da caricare", variant: "outline", icon: Upload },
  expired: { label: "Scaduto", variant: "destructive", icon: AlertCircle },
};

interface DocumentCardProps {
  docType: DocumentType;
  uploaded: UploadedDocument | undefined;
  allUploads?: UploadedDocument[];
  supplierId: string;
  tenantId: string;
  locked: boolean;
}

export function DocumentCard({ docType, uploaded, allUploads, supplierId, tenantId, locked }: DocumentCardProps) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [issueDate, setIssueDate] = useState<Date | undefined>();
  const [expiryDate, setExpiryDate] = useState<Date | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);

  // Determine if this doc type supports multiple uploads (non-mandatory, like CERT_AZIENDALI)
  const isMultiUpload = !docType.is_mandatory && docType.code === "CERT_AZIENDALI";
  const uploads = isMultiUpload ? (allUploads ?? []) : [];

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => documentService.deleteDocument(docId),
    onSuccess: () => {
      toast.success("Documento eliminato — puoi ricaricarlo");
      qc.invalidateQueries({ queryKey: ["supplier-documents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleUpload = async (file: File) => {
    const requiresExpiry = docType.requires_expiry ?? false;

    if (requiresExpiry && !expiryDate) {
      toast.error("La data di scadenza è obbligatoria per questo documento");
      return;
    }

    if (expiryDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expiryDate < today) {
        toast.error("La data di scadenza non può essere precedente alla data odierna");
        return;
      }
    }

    setIsUploading(true);
    try {
      // If replacing a rejected document, soft-delete the old one first
      if (uploaded?.status === "rejected") {
        await documentService.deleteDocument(uploaded.id);
      }

      await documentService.uploadDocument({
        supplierId,
        documentTypeId: docType.id,
        tenantId,
        file,
        expiryDate: expiryDate ? format(expiryDate, "yyyy-MM-dd") : undefined,
        issueDate: issueDate ? format(issueDate, "yyyy-MM-dd") : undefined,
        needsManualReview: docType.needs_manual_review ?? true,
      });
      toast.success(`${docType.name} caricato`);
      qc.invalidateQueries({ queryKey: ["supplier-documents"] });
      setIssueDate(undefined);
      setExpiryDate(undefined);
    } catch (err: any) {
      toast.error(err.message || "Errore nel caricamento");
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const isExpiringSoon = isDocExpiringSoon(uploaded);
  const isExpired = getEffectiveDocStatus(uploaded) === "expired";

  const effectiveStatus = getEffectiveDocStatus(uploaded);
  const cfg = statusConfig[effectiveStatus] || statusConfig.not_uploaded;
  const StatusIcon = cfg.icon;

  return (
    <Card className={`card-top-docs ${locked ? "opacity-80" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {locked ? (
              <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <CardTitle className="text-sm font-medium truncate">{docType.name}</CardTitle>
          </div>
          {!isMultiUpload && (
            <Badge variant={cfg.variant} className="text-xs gap-1 shrink-0">
              <StatusIcon className="h-3 w-3" />
              {cfg.label}
            </Badge>
          )}
          {isMultiUpload && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {uploads.length} caricati
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {docType.description && (
          <p className="text-xs text-muted-foreground">{docType.description}</p>
        )}

        {locked && uploaded && (
          <div className="rounded-md bg-muted border px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" /> Documenti inviati — in attesa di revisione
            </p>
          </div>
        )}

        {/* Multi-upload: show all uploaded files */}
        {isMultiUpload && uploads.length > 0 && (
          <div className="space-y-2">
            {uploads.map((doc) => {
              const docStatus = getEffectiveDocStatus(doc);
              const dCfg = statusConfig[docStatus] || statusConfig.not_uploaded;
              return (
                <div key={doc.id} className="flex items-center justify-between text-xs border rounded px-2 py-1.5">
                  <span className="truncate flex-1 mr-2">{doc.original_filename}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {doc.expiry_date && <span className="text-muted-foreground">Scade: {new Date(doc.expiry_date).toLocaleDateString("it-IT")}</span>}
                    <Badge variant={dCfg.variant} className="text-[10px]">{dCfg.label}</Badge>
                    {!locked && doc.status === "rejected" && (
                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => deleteMutation.mutate(doc.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Single upload display */}
        {!isMultiUpload && uploaded?.review_notes && uploaded.status === "rejected" && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
            <p className="text-xs font-medium text-destructive">Motivo rifiuto:</p>
            <p className="text-xs text-destructive/80 mt-0.5">{uploaded.review_notes}</p>
          </div>
        )}

        {!isMultiUpload && isExpiringSoon && (
          <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 px-3 py-2">
            <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400">
              ⚠ Documento in scadenza il {new Date(uploaded!.expiry_date!).toLocaleDateString("it-IT")}
            </p>
          </div>
        )}

        {!isMultiUpload && isExpired && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
            <p className="text-xs font-medium text-destructive">
              Documento scaduto il {new Date(uploaded!.expiry_date!).toLocaleDateString("it-IT")}
            </p>
          </div>
        )}

        {!isMultiUpload && uploaded?.expiry_date && uploaded.status !== "rejected" && !isExpiringSoon && !isExpired && (
          <p className="text-xs text-muted-foreground">
            Scadenza: {new Date(uploaded.expiry_date).toLocaleDateString("it-IT")}
          </p>
        )}
        {!isMultiUpload && uploaded?.original_filename && uploaded.status !== "rejected" && !isExpired && (
          <p className="text-xs truncate">{uploaded.original_filename}</p>
        )}

        {!locked && (
          <>
            {/* Show "Modifica" button when document needs re-upload */}
            {!isMultiUpload && uploaded && !showUploadForm && (uploaded.status === "rejected" || isExpiringSoon || isExpired) && (
              <Button
                size="sm"
                variant={uploaded.status === "rejected" ? "destructive" : "default"}
                className="w-full"
                onClick={() => setShowUploadForm(true)}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                {uploaded.status === "rejected"
                  ? "Modifica e ricarica"
                  : isExpired
                  ? "Sostituisci documento scaduto"
                  : "Sostituisci documento in scadenza"}
              </Button>
            )}

            {/* Upload form: always visible if no document, or toggled via Modifica */}
            {(!uploaded || showUploadForm || isMultiUpload || (uploaded.status !== "rejected" && !isExpiringSoon && !isExpired)) && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <DocumentDatePicker
                    label="Data emissione"
                    value={issueDate}
                    onChange={setIssueDate}
                  />
                  <DocumentDatePicker
                    label="Data scadenza"
                    required={!!docType.requires_expiry}
                    value={expiryDate}
                    onChange={setExpiryDate}
                    minDate={new Date()}
                  />
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
                        handleUpload(file);
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant={isExpired || isExpiringSoon || uploaded?.status === "rejected" ? "default" : "outline"}
                    className="w-full"
                    disabled={isUploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {isMultiUpload ? (
                      <><Plus className="h-3.5 w-3.5 mr-1" /> {isUploading ? "Caricamento…" : "Aggiungi certificazione"}</>
                    ) : (
                      <><Upload className="h-3.5 w-3.5 mr-1" />
                      {isUploading
                        ? "Caricamento…"
                        : uploaded?.status === "rejected"
                        ? "Ricarica documento"
                        : isExpired
                        ? "Carica nuovo documento"
                        : isExpiringSoon
                        ? "Carica nuovo documento"
                        : uploaded
                        ? "Ricarica"
                        : "Carica"}</>
                    )}
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
