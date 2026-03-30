import { useQuery } from "@tanstack/react-query";
import { opportunityService } from "@/services/opportunityService";
import { bidService } from "@/services/bidService";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format } from "date-fns";
import { FileText, Send } from "lucide-react";

interface Props {
  opportunityId: string;
  invitation: any;
  onOpenBid: () => void;
}

export default function SupplierOpportunitySheet({ opportunityId, invitation, onOpenBid }: Props) {
  const { profile } = useAuth();
  const supplierId = profile?.supplier_id;

  const { data: opp, isLoading } = useQuery({
    queryKey: ["opportunity", opportunityId],
    queryFn: () => opportunityService.getById(opportunityId),
    enabled: !!opportunityId && !!profile,
  });

  const { data: existingBid } = useQuery({
    queryKey: ["my-bid", opportunityId, supplierId],
    queryFn: () => bidService.getByOpportunityAndSupplier(opportunityId, supplierId!),
    enabled: !!opportunityId && !!supplierId,
  });

  const criteria = Array.isArray(opp?.evaluation_criteria) ? opp.evaluation_criteria : [];
  const deadlinePassed = opp?.bids_deadline ? new Date(opp.bids_deadline) < new Date() : false;
  const isExcluded = existingBid?.status === "excluded";

  if (isLoading) {
    return <div className="space-y-3 pt-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  if (!opp) return <p className="text-muted-foreground p-4">Opportunità non trovata.</p>;

  const bidLabel = existingBid
    ? existingBid.status === "draft" ? "Modifica offerta" : "Visualizza offerta"
    : "Presenta offerta";

  const canBid = !deadlinePassed && !isExcluded;

  return (
    <div className="space-y-5">
      <SheetHeader>
        <SheetTitle className="text-xl">{opp.title}</SheetTitle>
        <p className="text-sm text-muted-foreground font-mono">{opp.code}</p>
      </SheetHeader>

      <Separator />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Categoria" value={opp.categories?.name} />
        <Field label="Scadenza offerte" value={opp.bids_deadline ? format(new Date(opp.bids_deadline), "dd/MM/yyyy HH:mm") : undefined} />
        {opp.budget_max != null && (
          <Field label="Offerta massima" value={`€ ${Number(opp.budget_max).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`} className="text-destructive font-mono" />
        )}
        {opp.estimated_duration_days != null && (
          <Field label="Durata stimata" value={`${opp.estimated_duration_days} giorni`} />
        )}
        {opp.start_date && <Field label="Data inizio" value={format(new Date(opp.start_date), "dd/MM/yyyy")} />}
        {opp.end_date && <Field label="Data fine" value={format(new Date(opp.end_date), "dd/MM/yyyy")} />}
        {opp.geographic_area && <Field label="Area geografica" value={opp.geographic_area} />}
      </div>

      {opp.description && (
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-1">Descrizione</p>
          <p className="text-sm whitespace-pre-wrap">{opp.description}</p>
        </div>
      )}

      {opp.participation_conditions && (
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-1">Condizioni di partecipazione</p>
          <p className="text-sm whitespace-pre-wrap">{opp.participation_conditions}</p>
        </div>
      )}

      {criteria.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-2">Criteri di valutazione</p>
          <div className="flex flex-wrap gap-2">
            {criteria.map((c: any, i: number) => (
              <Badge key={i} variant="outline">{c.name} ({c.weight_pct}%)</Badge>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Bid status + action */}
      <div className="space-y-3">
        {existingBid && existingBid.status !== "draft" && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Stato offerta:</span>
            <Badge className={
              existingBid.status === "winning" ? "bg-emerald-100 text-emerald-700" :
              existingBid.status === "submitted" ? "bg-blue-100 text-blue-700" :
              existingBid.status === "excluded" ? "bg-red-100 text-red-700" :
              existingBid.status === "not_awarded" ? "bg-amber-100 text-amber-700" :
              "bg-muted text-muted-foreground"
            }>
              {existingBid.status === "winning" ? "Aggiudicata" :
               existingBid.status === "submitted" ? "Inviata" :
               existingBid.status === "excluded" ? "Esclusa" :
               existingBid.status === "not_awarded" ? "Non aggiudicata" :
               existingBid.status === "admitted" ? "Ammessa" :
               existingBid.status}
            </Badge>
          </div>
        )}

        {deadlinePassed && !existingBid && (
          <Badge variant="destructive">Scadenza superata</Badge>
        )}

        {canBid && (
          <Button className="w-full gap-2" onClick={onOpenBid}>
            {existingBid && existingBid.status !== "draft" ? <FileText className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {bidLabel}
          </Button>
        )}

        {existingBid && existingBid.status !== "draft" && !isExcluded && (
          <Button variant="outline" className="w-full gap-2" onClick={onOpenBid}>
            <FileText className="h-4 w-4" /> Visualizza offerta
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, className }: { label: string; value?: string | null; className?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${className ?? ""}`}>{value ?? "—"}</p>
    </div>
  );
}
