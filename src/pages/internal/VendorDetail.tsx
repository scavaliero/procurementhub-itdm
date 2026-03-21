import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { documentService } from "@/services/documentService";
import { auditService } from "@/services/auditService";
import { notificationService } from "@/services/notificationService";
import { useGrants } from "@/hooks/useGrants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import {
  Building2,
  FileText,
  CheckCircle2,
  XCircle,
  Download,
  AlertCircle,
  Clock,
} from "lucide-react";
import type { UploadedDocument, Supplier } from "@/types";

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pre_registered: { label: "Pre-registrato", variant: "outline" },
  pending_review: { label: "In revisione", variant: "secondary" },
  accredited: { label: "Accreditato", variant: "default" },
  suspended: { label: "Sospeso", variant: "destructive" },
  rejected: { label: "Rifiutato", variant: "destructive" },
  blacklisted: { label: "Blacklist", variant: "destructive" },
};

const docStatusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  approved: { label: "Approvato", variant: "default" },
  uploaded: { label: "In revisione", variant: "secondary" },
  rejected: { label: "Respinto", variant: "destructive" },
};

export default function InternalVendorDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { hasGrant } = useGrants();
  const canReview = hasGrant("review_documents");

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

  const reviewMutation = useMutation({
    mutationFn: async ({
      doc,
      action,
    }: {
      doc: UploadedDocument;
      action: "approved" | "rejected";
    }) => {
      const result = await documentService.reviewDocument(doc.id, action);
      // Audit log
      if (supplier) {
        await auditService.log({
          tenant_id: supplier.tenant_id,
          entity_type: "uploaded_documents",
          entity_id: doc.id,
          event_type: `document_${action}`,
          old_state: { status: doc.status },
          new_state: { status: action },
        });
        // Notify supplier
        try {
          const profileId = await vendorService.getSupplierProfileId(supplier.id);
          if (profileId) {
            await notificationService.send({
              event_type: `document_${action}`,
              recipient_id: profileId,
              tenant_id: supplier.tenant_id,
              variables: { document_name: docTypes.find((dt) => dt.id === doc.document_type_id)?.name || "" },
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
      qc.invalidateQueries({ queryKey: ["supplier-documents", id] });
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

  if (isLoading) return <PageSkeleton />;
  if (!supplier) {
    return (
      <div className="p-6">
        <EmptyState title="Fornitore non trovato" />
      </div>
    );
  }

  const sBadge = statusBadge[supplier.status] || statusBadge.pre_registered;

  // Build docType name map
  const dtMap = Object.fromEntries(docTypes.map((dt) => [dt.id, dt]));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{supplier.company_name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {supplier.company_type || "—"} · {supplier.pec || "—"}
          </p>
        </div>
        <Badge variant={sBadge.variant}>{sBadge.label}</Badge>
      </div>

      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="info">
            <Building2 className="h-4 w-4 mr-1" /> Info
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="h-4 w-4 mr-1" /> Documenti
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-2 text-sm">
              <p><strong>ID:</strong> {supplier.id}</p>
              <p><strong>Stato:</strong> {supplier.status}</p>
              <p><strong>Website:</strong> {supplier.website || "—"}</p>
              <p><strong>Rating:</strong> {supplier.rating_score ?? "N/A"} ({supplier.rating_count ?? 0} valutazioni)</p>
              <p><strong>Creato:</strong> {supplier.created_at ? new Date(supplier.created_at).toLocaleDateString("it-IT") : "—"}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4 space-y-4">
          {docs.length === 0 ? (
            <EmptyState
              title="Nessun documento caricato"
              description="Il fornitore non ha ancora caricato documenti."
            />
          ) : (
            docs.map((doc) => {
              const dt = dtMap[doc.document_type_id];
              const dBadge = docStatusBadge[doc.status] || { label: doc.status, variant: "outline" as const };
              return (
                <Card key={doc.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{dt?.name || doc.document_type_id}</p>
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
                            onClick={() => downloadMutation.mutate(doc.storage_path!)}
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
                                reviewMutation.mutate({ doc, action: "approved" })
                              }
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approva
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={reviewMutation.isPending}
                              onClick={() =>
                                reviewMutation.mutate({ doc, action: "rejected" })
                              }
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
      </Tabs>
    </div>
  );
}
