import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentService } from "@/services/documentService";
import { vendorService } from "@/services/vendorService";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { Send, Lock } from "lucide-react";
import { useState } from "react";
import { DocumentCard } from "@/components/supplier/DocumentCard";
import type { UploadedDocument } from "@/types";

/** States where documents are locked (waiting for admin review) */
const LOCKED_STATUSES = ["in_accreditation", "in_approval", "pending_review"];

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
  const approved = mandatory.filter(
    (dt) => latestByType[dt.id]?.status === "approved"
  ).length;
  const mandatoryUploaded = mandatory.filter(
    (dt) => latestByType[dt.id] && latestByType[dt.id].status !== "rejected"
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
