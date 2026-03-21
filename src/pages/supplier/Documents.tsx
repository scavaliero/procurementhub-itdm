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
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { useRef } from "react";
import type { DocumentType, UploadedDocument } from "@/types";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  approved: { label: "Approvato", variant: "default", icon: CheckCircle2 },
  uploaded: { label: "In revisione", variant: "secondary", icon: Clock },
  rejected: { label: "Respinto", variant: "destructive", icon: AlertCircle },
  not_uploaded: { label: "Da caricare", variant: "outline", icon: Upload },
  expired: { label: "Scaduto", variant: "destructive", icon: AlertCircle },
};

function DocumentCard({
  docType,
  uploaded,
  supplierId,
  tenantId,
}: {
  docType: DocumentType;
  uploaded: UploadedDocument | undefined;
  supplierId: string;
  tenantId: string;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const expiryRef = useRef<HTMLInputElement>(null);

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

  const status = uploaded?.status || "not_uploaded";
  const cfg = statusConfig[status] || statusConfig.not_uploaded;
  const StatusIcon = cfg.icon;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
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
        {uploaded?.expiry_date && (
          <p className="text-xs text-muted-foreground">
            Scadenza: {new Date(uploaded.expiry_date).toLocaleDateString("it-IT")}
          </p>
        )}
        {uploaded?.original_filename && (
          <p className="text-xs truncate">{uploaded.original_filename}</p>
        )}
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
            variant="outline"
            className="w-full"
            disabled={uploadMutation.isPending}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5 mr-1" />
            {uploadMutation.isPending ? "Caricamento…" : uploaded ? "Ricarica" : "Carica"}
          </Button>
        </div>
        {docType.is_mandatory && (
          <p className="text-[10px] text-destructive">* Obbligatorio</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function SupplierDocuments() {
  const { profile } = useAuth();

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
  const approved = mandatory.filter(
    (dt) => latestByType[dt.id]?.status === "approved"
  ).length;
  const progressPct = mandatory.length > 0 ? (approved / mandatory.length) * 100 : 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documenti</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Carica i documenti richiesti per la qualifica.
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
