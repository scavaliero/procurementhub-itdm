import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { documentService } from "@/services/documentService";
import { vendorService } from "@/services/vendorService";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Send, Lock, Search, FileCheck, FileX, Clock, CheckCircle2 } from "lucide-react";
import { useState, useMemo } from "react";
import { DocumentCard } from "@/components/supplier/DocumentCard";
import type { UploadedDocument } from "@/types";

/** States where documents are locked (waiting for admin review) */
const LOCKED_STATUSES = ["in_accreditation", "in_approval", "pending_review"];

export default function SupplierDocuments() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const statusFilter = searchParams.get("status") || "all";
  const searchQuery = searchParams.get("q") || "";

  const updateParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v && v !== "all") next.set(k, v);
      else next.delete(k);
    });
    setSearchParams(next, { replace: true });
  };

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

  // Build map: latest upload per document_type_id
  const latestByType: Record<string, UploadedDocument> = {};
  if (uploadedDocs) {
    uploadedDocs.forEach((d) => {
      if (!latestByType[d.document_type_id] || d.version > latestByType[d.document_type_id].version) {
        latestByType[d.document_type_id] = d;
      }
    });
  }

  // KPI counts for documents
  const kpiCounts = useMemo(() => {
    let approvedCount = 0, expiring = 0, pending = 0, rejected = 0, missing = 0;
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    for (const dt of docTypes) {
      const doc = latestByType[dt.id];
      if (!doc) { missing++; continue; }
      if (doc.status === "approved") {
        approvedCount++;
        if (doc.expiry_date && new Date(doc.expiry_date) <= thirtyDays) expiring++;
      }
      else if (doc.status === "uploaded") pending++;
      else if (doc.status === "rejected") rejected++;
    }
    return { approved: approvedCount, expiring, pending, rejected, missing };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docTypes, uploadedDocs]);

  // Filtered doc types
  const filteredDocTypes = useMemo(() => {
    return docTypes.filter((dt) => {
      const doc = latestByType[dt.id];
      if (statusFilter === "approved" && doc?.status !== "approved") return false;
      if (statusFilter === "pending" && doc?.status !== "uploaded") return false;
      if (statusFilter === "rejected" && doc?.status !== "rejected") return false;
      if (statusFilter === "missing" && doc) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!dt.name.toLowerCase().includes(q) && !(dt.code ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docTypes, uploadedDocs, statusFilter, searchQuery]);

  if (supLoading || dtLoading || udLoading) return <PageSkeleton />;
  if (!supplier) {
    return (
      <div className="p-6">
        <EmptyState title="Profilo fornitore non trovato" />
      </div>
    );
  }

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

  const kpiCards = [
    { key: "approved", label: "Approvati", value: kpiCounts.approved, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100" },
    { key: "pending", label: "In revisione", value: kpiCounts.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-100" },
    { key: "rejected", label: "Rifiutati", value: kpiCounts.rejected, icon: FileX, color: "text-destructive", bg: "bg-destructive/10", alert: true },
    { key: "missing", label: "Mancanti", value: kpiCounts.missing, icon: FileCheck, color: "text-muted-foreground", bg: "bg-muted" },
  ];

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

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => {
          const isSelected = statusFilter === kpi.key;
          const Icon = kpi.icon;
          return (
            <Card
              key={kpi.key}
              className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${
                isSelected ? "ring-2 ring-primary" : ""
              } ${kpi.alert && kpi.value > 0 ? "border-destructive/40 bg-destructive/5" : ""}`}
              onClick={() => updateParams({ status: isSelected ? "all" : kpi.key })}
              data-testid={`sup-docs-kpi-${kpi.key}`}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {kpi.label}
                </CardTitle>
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${kpi.bg}`}>
                  <Icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">{kpi.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca documento…"
          value={searchQuery}
          onChange={(e) => updateParams({ q: e.target.value })}
          className="pl-9"
          data-testid="sup-docs-search"
        />
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

      {filteredDocTypes.length === 0 ? (
        <EmptyState
          title="Nessun documento"
          description="Non ci sono documenti che corrispondono ai filtri."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocTypes.map((dt) => (
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
