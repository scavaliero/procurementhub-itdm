import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { opportunityService } from "@/services/opportunityService";
import { invitationService } from "@/services/invitationService";
import { bidService, type ValidateBidResult } from "@/services/bidService";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { ArrowLeft, Save, Send, Upload, Trash2, AlertTriangle, CheckCircle, FileText } from "lucide-react";
import { format } from "date-fns";

export default function SupplierOpportunityDetail() {
  const { id: opportunityId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [validationResult, setValidationResult] = useState<ValidateBidResult | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);

  const supplierId = profile?.supplier_id;

  const { data: opp, isLoading: oppLoading } = useQuery({
    queryKey: ["opportunity", opportunityId],
    queryFn: () => opportunityService.getById(opportunityId!),
    enabled: !!opportunityId,
  });

  const { data: invitation } = useQuery({
    queryKey: ["my-invitation", opportunityId, supplierId],
    queryFn: async () => {
      const invs = await invitationService.listForSupplier(supplierId!);
      return invs.find((i: any) => i.opportunity_id === opportunityId) ?? null;
    },
    enabled: !!opportunityId && !!supplierId,
  });

  const { data: existingBid, isLoading: bidLoading } = useQuery({
    queryKey: ["my-bid", opportunityId, supplierId],
    queryFn: () => bidService.getByOpportunityAndSupplier(opportunityId!, supplierId!),
    enabled: !!opportunityId && !!supplierId,
  });

  const deadlinePassed = opp?.bids_deadline ? new Date(opp.bids_deadline) < new Date() : false;
  
  const isExcluded = existingBid?.status === "excluded";
  const bidEditable = !existingBid || existingBid.status === "draft";
  const isSubmitted = !!existingBid && existingBid.status !== "draft";
  const formDisabled = isSubmitted || deadlinePassed;

  // Budget max from opportunity
  const budgetMax = opp?.budget_max ?? null;

  const bidSchema = useMemo(() => {
    let amountSchema = z.coerce.number().positive("Importo obbligatorio");
    if (budgetMax) {
      amountSchema = amountSchema.max(budgetMax, `L'importo non può superare il budget massimo di € ${budgetMax.toLocaleString("it-IT")}`);
    }
    return z.object({
      total_amount: amountSchema,
      technical_description: z.string().min(10, "Descrizione tecnica obbligatoria (min 10 caratteri)"),
      execution_days: z.coerce.number().int().positive("Giorni di esecuzione obbligatori"),
      bid_validity_date: z.string().min(1, "Data validità obbligatoria"),
      proposed_conditions: z.string().optional(),
      notes: z.string().optional(),
    });
  }, [budgetMax]);

  type BidFormData = z.infer<typeof bidSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    getValues,
  } = useForm<BidFormData>({
    resolver: zodResolver(bidSchema),
  });

  // Pre-fill form with existing bid data
  useEffect(() => {
    if (existingBid && existingBid.status === "draft") {
      reset({
        total_amount: existingBid.total_amount ?? undefined,
        technical_description: existingBid.technical_description ?? "",
        execution_days: existingBid.execution_days ?? undefined,
        bid_validity_date: existingBid.bid_validity_date ?? "",
        proposed_conditions: existingBid.proposed_conditions ?? "",
        notes: existingBid.notes ?? "",
      });
    }
  }, [existingBid, reset]);

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (!supplierId || !profile || !opportunityId) throw new Error("Dati mancanti");
      const values = getValues();
      // For excluded bids, create a new draft (don't try to update the excluded one)
      const bid = await bidService.saveDraft(
        {
          opportunity_id: opportunityId,
          supplier_id: supplierId,
          tenant_id: profile.tenant_id,
          invitation_id: invitation?.id,
          total_amount: values.total_amount || undefined,
          technical_description: values.technical_description,
          execution_days: values.execution_days || undefined,
          bid_validity_date: values.bid_validity_date,
          proposed_conditions: values.proposed_conditions,
          notes: values.notes,
        },
        isExcluded ? undefined : existingBid?.id
      );
      return bid;
    },
    onSuccess: () => {
      toast.success("Bozza salvata");
      qc.invalidateQueries({ queryKey: ["my-bid", opportunityId, supplierId] });
    },
    onError: (err: any) => toast.error(err.message || "Errore nel salvataggio"),
  });

  const submitMutation = useMutation({
    mutationFn: async (data: BidFormData) => {
      if (!supplierId || !profile || !opportunityId) throw new Error("Dati mancanti");

      // Budget validation
      if (budgetMax && data.total_amount > budgetMax) {
        throw new Error(`L'importo (€ ${data.total_amount.toLocaleString("it-IT")}) supera il budget massimo (€ ${budgetMax.toLocaleString("it-IT")})`);
      }

      // 1. Save/update draft first (for excluded, create new)
      const bidIdToUse = isExcluded ? undefined : existingBid?.id;
      const bid = await bidService.saveDraft(
        {
          opportunity_id: opportunityId,
          supplier_id: supplierId,
          tenant_id: profile.tenant_id,
          invitation_id: invitation?.id,
          total_amount: data.total_amount,
          technical_description: data.technical_description,
          execution_days: data.execution_days,
          bid_validity_date: data.bid_validity_date,
          proposed_conditions: data.proposed_conditions,
          notes: data.notes,
        },
        existingBid?.id
      );

      // 2. Upload attachments
      for (const file of attachments) {
        await bidService.uploadAttachment(opportunityId, supplierId, file);
      }

      // 3. Validate
      const validation = await bidService.validate(opportunityId, supplierId);
      setValidationResult(validation);

      if (!validation.valid) {
        throw new Error(validation.message || "Validazione fallita");
      }

      // 4. Submit
      return bidService.submit(bid.id, profile.tenant_id, opportunityId, invitation?.id);
    },
    onSuccess: () => {
      toast.success("Offerta inviata con successo");
      qc.invalidateQueries({ queryKey: ["my-bid", opportunityId, supplierId] });
      setAttachments([]);
    },
    onError: (err: any) => {
      // Don't toast if it's a validation error — we show inline
      if (!validationResult || validationResult.valid) {
        toast.error(err.message || "Errore nell'invio");
      }
    },
  });

  const criteria = useMemo(
    () => (Array.isArray(opp?.evaluation_criteria) ? opp.evaluation_criteria : []),
    [opp]
  );

  if (oppLoading || bidLoading) {
    return <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  if (!opp) {
    return <div className="p-6"><p className="text-muted-foreground">Opportunità non trovata.</p></div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/supplier/opportunities")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{opp.title}</h1>
          <p className="text-sm text-muted-foreground font-mono">{opp.code}</p>
        </div>
        {existingBid && existingBid.status !== "draft" && (
          <Badge className={
            existingBid.status === "winning" ? "bg-emerald-100 text-emerald-700" :
            existingBid.status === "submitted" ? "bg-blue-100 text-blue-700" :
            existingBid.status === "not_awarded" ? "bg-amber-100 text-amber-700" :
            existingBid.status === "excluded" ? "bg-red-100 text-red-700" :
            "bg-muted text-muted-foreground"
          }>
            <CheckCircle className="h-3 w-3 mr-1" />
            {existingBid.status === "winning" ? "Aggiudicata" :
             existingBid.status === "submitted" ? "Offerta inviata" :
             existingBid.status === "not_awarded" ? "Non aggiudicata" :
             existingBid.status === "excluded" ? "Esclusa" :
             existingBid.status}
          </Badge>
        )}
        {deadlinePassed && !existingBid && (
          <Badge variant="destructive">Scadenza superata</Badge>
        )}
      </div>

      {/* Excluded notice — irreversible */}
      {isExcluded && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Offerta esclusa</AlertTitle>
          <AlertDescription>
            La tua offerta è stata esclusa da questa opportunità. Non è possibile presentare una nuova offerta.
          </AlertDescription>
        </Alert>
      )}

      {/* Opportunity details — now with economic info */}
      <Card className="card-top-opportunities">
        <CardHeader><CardTitle className="text-lg">Dettagli Opportunità</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Categoria</p>
            <p className="text-sm font-medium">{opp.categories?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Scadenza offerte</p>
            <p className="text-sm font-medium">
              {opp.bids_deadline ? format(new Date(opp.bids_deadline), "dd/MM/yyyy HH:mm") : "—"}
            </p>
          </div>
          {/* Economic details */}
          {opp.budget_estimated != null && (
            <div>
              <p className="text-sm text-muted-foreground">Budget stimato</p>
              <p className="text-sm font-medium">€ {Number(opp.budget_estimated).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
            </div>
          )}
          {opp.budget_max != null && (
            <div>
              <p className="text-sm text-muted-foreground">Budget massimo</p>
              <p className="text-sm font-medium font-mono text-destructive">€ {Number(opp.budget_max).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
            </div>
          )}
          {opp.estimated_duration_days != null && (
            <div>
              <p className="text-sm text-muted-foreground">Durata stimata</p>
              <p className="text-sm font-medium">{opp.estimated_duration_days} giorni</p>
            </div>
          )}
          {opp.start_date && (
            <div>
              <p className="text-sm text-muted-foreground">Data inizio prevista</p>
              <p className="text-sm font-medium">{format(new Date(opp.start_date), "dd/MM/yyyy")}</p>
            </div>
          )}
          {opp.end_date && (
            <div>
              <p className="text-sm text-muted-foreground">Data fine prevista</p>
              <p className="text-sm font-medium">{format(new Date(opp.end_date), "dd/MM/yyyy")}</p>
            </div>
          )}
          {opp.geographic_area && (
            <div>
              <p className="text-sm text-muted-foreground">Area geografica</p>
              <p className="text-sm font-medium">{opp.geographic_area}</p>
            </div>
          )}
          {opp.description && (
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground">Descrizione</p>
              <p className="text-sm whitespace-pre-wrap">{opp.description}</p>
            </div>
          )}
          {opp.participation_conditions && (
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground">Condizioni di partecipazione</p>
              <p className="text-sm whitespace-pre-wrap">{opp.participation_conditions}</p>
            </div>
          )}
          {criteria.length > 0 && (
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground mb-2">Criteri di valutazione</p>
              <div className="flex flex-wrap gap-2">
                {criteria.map((c: any, i: number) => (
                  <Badge key={i} variant="outline">{c.name} ({c.weight_pct}%)</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation errors */}
      {validationResult && !validationResult.valid && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {validationResult.code === "RB04" && "Scadenza raggiunta"}
            {validationResult.code === "RB01" && "Categoria non qualificata"}
            {validationResult.code === "RB01_EXPIRED" && "Qualifica categoria scaduta"}
            {validationResult.code === "RB02" && "Documenti mancanti"}
            {!["RB04", "RB01", "RB01_EXPIRED", "RB02"].includes(validationResult.code ?? "") && "Errore di validazione"}
          </AlertTitle>
          <AlertDescription>
            {validationResult.code === "RB04" && "Scadenza raggiunta. Non è possibile inviare l'offerta."}
            {validationResult.code === "RB01" && "Non sei qualificato per la categoria di questa opportunità."}
            {validationResult.code === "RB01_EXPIRED" && "La tua qualifica per questa categoria è scaduta."}
            {validationResult.code === "RB02" && (
              <div>
                <p>Documenti obbligatori mancanti o non approvati:</p>
                <ul className="list-disc ml-4 mt-1">
                  {validationResult.missing_documents?.map((d, i) => (
                    <li key={i}>{d.document_name} — {d.reason}</li>
                  ))}
                </ul>
              </div>
            )}
            {!["RB04", "RB01", "RB01_EXPIRED", "RB02"].includes(validationResult.code ?? "") && validationResult.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Bid form */}
      <Card className="card-top-opportunities">
        <CardHeader>
          <CardTitle className="text-lg">
            {isSubmitted ? (isExcluded ? "Offerta esclusa" : "Offerta inviata") : existingBid ? "Modifica offerta" : "Presenta offerta"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((data) => submitMutation.mutate(data))}
            className="space-y-4"
          >
            <fieldset disabled={formDisabled} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>
                    Importo totale (€) *
                    {budgetMax && (
                      <span className="text-xs text-muted-foreground ml-2">
                        (max € {budgetMax.toLocaleString("it-IT")})
                      </span>
                    )}
                  </Label>
                  <Input type="number" step="0.01" max={budgetMax ?? undefined} {...register("total_amount")} />
                  {errors.total_amount && <p className="text-sm text-destructive mt-1">{errors.total_amount.message}</p>}
                </div>
                <div>
                  <Label>Giorni di esecuzione *</Label>
                  <Input type="number" {...register("execution_days")} />
                  {errors.execution_days && <p className="text-sm text-destructive mt-1">{errors.execution_days.message}</p>}
                </div>
                <div>
                  <Label>Validità offerta *</Label>
                  <Input type="date" {...register("bid_validity_date")} />
                  {errors.bid_validity_date && <p className="text-sm text-destructive mt-1">{errors.bid_validity_date.message}</p>}
                </div>
              </div>

              <div>
                <Label>Descrizione tecnica *</Label>
                <Textarea {...register("technical_description")} rows={4} />
                {errors.technical_description && <p className="text-sm text-destructive mt-1">{errors.technical_description.message}</p>}
              </div>

              <div>
                <Label>Condizioni proposte</Label>
                <Textarea {...register("proposed_conditions")} rows={3} />
              </div>

              <div>
                <Label>Note</Label>
                <Textarea {...register("notes")} rows={2} />
              </div>

              {/* Attachments */}
              {!formDisabled && (
                <div>
                  <Label>Allegati</Label>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center">
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      id="bid-files"
                      onChange={(e) => {
                        if (e.target.files) setAttachments([...attachments, ...Array.from(e.target.files)]);
                      }}
                    />
                    <label htmlFor="bid-files" className="cursor-pointer flex flex-col items-center gap-1">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Clicca per caricare</span>
                    </label>
                  </div>
                  {attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {attachments.map((f, i) => (
                        <div key={i} className="flex items-center justify-between text-sm bg-muted rounded px-3 py-1">
                          <span>{f.name}</span>
                          <Button variant="ghost" size="sm" type="button" onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </fieldset>

            {!formDisabled && (
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => saveDraftMutation.mutate()}
                  disabled={saveDraftMutation.isPending}
                >
                  <Save className="mr-2 h-4 w-4" /> Salva bozza
                </Button>
                <Button type="submit" disabled={submitMutation.isPending}>
                  <Send className="mr-2 h-4 w-4" /> Invia offerta
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
