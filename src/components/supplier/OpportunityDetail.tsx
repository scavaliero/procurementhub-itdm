import { useQuery } from "@tanstack/react-query";
import { opportunityService } from "@/services/opportunityService";
import { bidService } from "@/services/bidService";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { EmptyState } from "@/components/EmptyState";
import { format } from "date-fns";
import { ArrowLeft, FileText, ClipboardList } from "lucide-react";
import { useState } from "react";
import SupplierBidSheet from "./BidSheet";

interface Props {
  opportunityId: string;
  invitation: any;
  onBack: () => void;
}

export default function SupplierOpportunityDetail({ opportunityId, invitation, onBack }: Props) {
  const { profile } = useAuth();
  const supplierId = profile?.supplier_id;

  const { data: opp, isLoading } = useQuery({
    queryKey: ["opportunity", opportunityId],
    queryFn: () => opportunityService.getById(opportunityId),
    enabled: !!opportunityId,
  });

  const { data: existingBid } = useQuery({
    queryKey: ["my-bid", opportunityId, supplierId],
    queryFn: () => bidService.getByOpportunityAndSupplier(opportunityId, supplierId!),
    enabled: !!opportunityId && !!supplierId,
  });

  const criteria = Array.isArray(opp?.evaluation_criteria) ? opp.evaluation_criteria : [];
  const deadlinePassed = opp?.bids_deadline ? new Date(opp.bids_deadline) < new Date() : false;
  const isExcluded = existingBid?.status === "excluded";
  const canBid = !deadlinePassed && !isExcluded;

  const bidLabel = existingBid
    ? existingBid.status === "draft" ? "Modifica offerta" : "Visualizza offerta"
    : "Presenta offerta";

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!opp) return <EmptyState title="Opportunità non trovata" description="L'opportunità richiesta non esiste." />;

  const BID_STATUS_LABELS: Record<string, string> = {
    draft: "Bozza", submitted: "Inviata", admitted: "Ammessa",
    excluded: "Esclusa", winning: "Aggiudicata", not_awarded: "Non aggiudicata", withdrawn: "Ritirata",
  };
  const BID_STATUS_COLORS: Record<string, string> = {
    draft: "bg-muted text-muted-foreground", submitted: "bg-blue-100 text-blue-700",
    admitted: "bg-emerald-100 text-emerald-700", excluded: "bg-red-100 text-red-700",
    winning: "bg-emerald-100 text-emerald-800", not_awarded: "bg-amber-100 text-amber-700",
    withdrawn: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold truncate">{opp.title}</h1>
            {existingBid && existingBid.status !== "draft" && (
              <Badge variant="secondary" className={BID_STATUS_COLORS[existingBid.status] ?? ""}>
                {BID_STATUS_LABELS[existingBid.status] ?? existingBid.status}
              </Badge>
            )}
            {deadlinePassed && !existingBid && (
              <Badge variant="destructive">Scadenza superata</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1 font-mono">{opp.code}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="detail">
        <TabsList>
          <TabsTrigger value="detail">
            <FileText className="h-4 w-4 mr-1.5" /> Dettaglio
          </TabsTrigger>
          <TabsTrigger value="bid">
            <ClipboardList className="h-4 w-4 mr-1.5" /> Offerte
          </TabsTrigger>
        </TabsList>

        {/* TAB DETTAGLIO */}
        <TabsContent value="detail" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Informazioni generali
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-muted-foreground">Categoria</dt>
                      <dd className="font-medium">{opp.categories?.name ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Scadenza offerte</dt>
                      <dd className="font-medium">{opp.bids_deadline ? format(new Date(opp.bids_deadline), "dd/MM/yyyy HH:mm") : "—"}</dd>
                    </div>
                  </div>
                  {opp.budget_max != null && (
                    <div>
                      <dt className="text-muted-foreground">Offerta massima</dt>
                      <dd className="font-medium text-destructive font-mono">€ {Number(opp.budget_max).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</dd>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {opp.estimated_duration_days != null && (
                      <div>
                        <dt className="text-muted-foreground">Durata stimata</dt>
                        <dd className="font-medium">{opp.estimated_duration_days} giorni</dd>
                      </div>
                    )}
                    {opp.geographic_area && (
                      <div>
                        <dt className="text-muted-foreground">Area geografica</dt>
                        <dd className="font-medium">{opp.geographic_area}</dd>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {opp.start_date && (
                      <div>
                        <dt className="text-muted-foreground">Data inizio</dt>
                        <dd className="font-medium">{format(new Date(opp.start_date), "dd/MM/yyyy")}</dd>
                      </div>
                    )}
                    {opp.end_date && (
                      <div>
                        <dt className="text-muted-foreground">Data fine</dt>
                        <dd className="font-medium">{format(new Date(opp.end_date), "dd/MM/yyyy")}</dd>
                      </div>
                    )}
                  </div>
                </dl>
              </CardContent>
            </Card>

            {(opp.description || opp.participation_conditions) && (
              <div className="space-y-6">
                {opp.description && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Descrizione</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap">{opp.description}</p>
                    </CardContent>
                  </Card>
                )}
                {opp.participation_conditions && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Condizioni di partecipazione</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap">{opp.participation_conditions}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB OFFERTE */}
        <TabsContent value="bid" className="space-y-6 mt-4">
          <SupplierBidSheet
            opportunityId={opportunityId}
            invitation={invitation}
            onClose={() => {}}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
