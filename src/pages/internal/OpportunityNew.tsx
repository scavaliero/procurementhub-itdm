import { useState, useEffect, useMemo } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { opportunityService } from "@/services/opportunityService";
import { categoryService } from "@/services/categoryService";
import { useAuth } from "@/hooks/useAuth";
import { useGrants } from "@/hooks/useGrants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Plus, Trash2, Upload, Save, Send } from "lucide-react";
import { format } from "date-fns";
import OpportunityAttachments from "@/components/opportunity/OpportunityAttachments";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { purchaseRequestService } from "@/services/purchaseRequestService";

const step1Schema = z.object({
  title: z.string().min(3, "Titolo obbligatorio (min 3 caratteri)"),
  description: z.string().optional(),
  category_id: z.string().min(1, "Categoria obbligatoria"),
  internal_ref_id: z.string().optional(),
  requesting_unit: z.string().optional(),
  opens_at: z.string().optional(),
  bids_deadline: z.string().min(1, "Scadenza offerte obbligatoria"),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  budget_estimated: z.coerce.number().gt(0, "Budget stimato obbligatorio e maggiore di 0"),
  budget_max: z.coerce.number().gt(0, "Offerta massima obbligatoria e maggiore di 0"),
  require_technical_offer: z.boolean(),
  require_economic_offer: z.boolean(),
}).refine((data) => {
  if (data.budget_max > data.budget_estimated) {
    return false;
  }
  return true;
}, {
  message: "L'offerta massima non può superare il budget stimato",
  path: ["budget_max"],
});

type Step1Data = z.infer<typeof step1Schema>;

interface Criterion {
  name: string;
  weight_pct: number;
  max_score: number;
  min_score_threshold: number;
}

export default function InternalOpportunityNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromRequest = searchParams.get("from_request");
  const { profile } = useAuth();
  const { hasGrant } = useGrants();
  const [step, setStep] = useState(0);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  
  const [conditions, setConditions] = useState("");
  const [notes, setNotes] = useState("");

  // Load linked purchase request data BEFORE form renders
  const { data: linkedRequest, isLoading: linkedLoading } = useQuery({
    queryKey: ["purchase-request-for-opp", fromRequest],
    queryFn: () => purchaseRequestService.getById(fromRequest!),
    enabled: !!fromRequest,
    staleTime: Infinity,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoryService.list(),
  });

  const { data: internalProfiles = [] } = useQuery({
    queryKey: ["internal-profiles"],
    queryFn: () => opportunityService.getInternalProfiles(),
  });

  // Build default values from linked request
  const formDefaults = useMemo(() => {
    const base: Partial<Step1Data> = { require_technical_offer: true, require_economic_offer: true };
    if (linkedRequest) {
      if (linkedRequest.subject) base.title = linkedRequest.subject;
      if (linkedRequest.description) base.description = linkedRequest.description;
      if (linkedRequest.amount) {
        base.budget_estimated = Number(linkedRequest.amount);
        base.budget_max = Number(linkedRequest.amount);
      }
      if (linkedRequest.needed_by) base.end_date = linkedRequest.needed_by;
    }
    return step1Data ?? base;
  }, [linkedRequest, step1Data]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: formDefaults as Step1Data,
  });

  // If still loading linked request, show skeleton
  if (fromRequest && linkedLoading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }


  /** Create or update draft in DB — ensures category_id is persisted from step 1 */
  const saveDraftMutation = useMutation({
    mutationFn: async (data: Step1Data) => {
      if (!profile) throw new Error("Profilo non trovato");
      const payload = {
        title: data.title,
        description: data.description || undefined,
        category_id: data.category_id || undefined,
        internal_ref_id: data.internal_ref_id || undefined,
        requesting_unit: data.requesting_unit || undefined,
        opens_at: data.opens_at || undefined,
        bids_deadline: data.bids_deadline || undefined,
        start_date: data.start_date || undefined,
        end_date: data.end_date || undefined,
        budget_estimated: data.budget_estimated,
        budget_max: data.budget_max,
        require_technical_offer: data.require_technical_offer,
        require_economic_offer: data.require_economic_offer,
      };

      if (draftId) {
        return opportunityService.update(draftId, payload as any);
      } else {
        const opp = await opportunityService.create({
          ...payload,
          tenant_id: profile.tenant_id,
          status: "draft",
          created_by: profile.id,
        });
        return opp;
      }
    },
    onSuccess: (opp) => {
      if (!draftId) setDraftId(opp.id);
    },
    onError: (err: Error) => toast.error(err.message || "Errore nel salvataggio bozza"),
  });

  const publishMutation = useMutation({
    mutationFn: async (status: string) => {
      if (!draftId) throw new Error("Bozza non salvata");

      // Update with criteria, conditions, notes, and final status
      const opp = await opportunityService.update(draftId, {
        evaluation_criteria: criteria.length > 0 ? (criteria as any) : [],
        participation_conditions: conditions || undefined,
        operational_notes: notes || undefined,
        status,
      } as any);

      // Attachments are now uploaded directly via OpportunityAttachments component

      return opp;
    },
    onSuccess: (opp) => {
      // Link to purchase request if created from one
      if (fromRequest && opp.id) {
        purchaseRequestService.completeWithOpportunity(fromRequest, opp.id).catch(() => {});
      }
      toast.success("Opportunità creata con successo");
      navigate(`/internal/opportunities/${opp.id}`);
    },
    onError: (err: Error) => toast.error(err.message || "Errore nella creazione"),
  });

  const canViewBudget = hasGrant("view_budget");
  const canApprove = hasGrant("approve_opportunity");

  const totalWeight = criteria.reduce((s, c) => s + (c.weight_pct || 0), 0);
  const criteriaValid = criteria.length === 0 || totalWeight === 100;

  const handleStep1Submit = async (data: Step1Data) => {
    setStep1Data(data);
    // Auto-save draft to DB so category_id is persisted
    await saveDraftMutation.mutateAsync(data);
    setStep(1);
  };

  const addCriterion = () => {
    setCriteria([...criteria, { name: "", weight_pct: 0, max_score: 10, min_score_threshold: 0 }]);
  };

  const removeCriterion = (idx: number) => {
    setCriteria(criteria.filter((_, i) => i !== idx));
  };

  const updateCriterion = (idx: number, field: keyof Criterion, value: string | number) => {
    setCriteria(criteria.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  const determineStatus = () => {
    if (!step1Data) return "draft";
    const budgetMax = step1Data.budget_max ?? 0;
    if (budgetMax > 50000 && !canApprove) return "pending_approval";
    return "open";
  };

  const handlePublish = () => {
    publishMutation.mutate(determineStatus());
  };

  const handleSaveDraft = () => {
    if (draftId) {
      // Already saved as draft, just update criteria/conditions
      publishMutation.mutate("draft");
    } else {
      toast.error("Completa prima lo step 1");
    }
  };

  return (
    <div key={fromRequest ?? "no-rda"} className="p-6 max-w-4xl mx-auto space-y-6">
      <Breadcrumb items={[{ label: "Dashboard", href: "/internal/dashboard" }, { label: "Opportunità", href: "/internal/opportunities" }, { label: "Nuova Opportunità" }]} />
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/internal/opportunities")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Nuova Opportunità</h1>
      </div>

      {fromRequestCode ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Opportunità collegata alla Richiesta <strong>{fromRequestCode}</strong>
          </AlertDescription>
        </Alert>
      ) : fromRequest ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>Caricamento dati richiesta collegata…</AlertDescription>
        </Alert>
      ) : null}

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {["Dati generali", "Criteri di valutazione", "Allegati e condizioni"].map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            <span className={`text-sm hidden sm:inline ${i === step ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
            {i < 2 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step === 0 && (
        <Card>
          <CardHeader><CardTitle>Dati Generali</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(handleStep1Submit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Titolo *</Label>
                  <Input {...register("title")} />
                  {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
                </div>
                <div className="md:col-span-2">
                  <Label>Descrizione</Label>
                  <Textarea {...register("description")} rows={3} />
                </div>
                <div>
                  <Label>Categoria *</Label>
                  <Select value={watch("category_id") ?? ""} onValueChange={(v) => setValue("category_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                    <SelectContent>
                      {categories.filter((c) => c.is_active).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.category_id && <p className="text-sm text-destructive mt-1">{errors.category_id.message}</p>}
                </div>
                <div>
                  <Label>Referente interno</Label>
                  <Select value={watch("internal_ref_id") ?? ""} onValueChange={(v) => setValue("internal_ref_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                    <SelectContent>
                      {internalProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Unità richiedente</Label>
                  <Input {...register("requesting_unit")} />
                </div>
                <div>
                  <Label>Scadenza offerte *</Label>
                  <Input type="datetime-local" {...register("bids_deadline")} />
                  {errors.bids_deadline && <p className="text-sm text-destructive mt-1">{errors.bids_deadline.message}</p>}
                </div>
                <div>
                  <Label>Apertura</Label>
                  <Input type="datetime-local" {...register("opens_at")} />
                </div>
                <div>
                  <Label>Data inizio</Label>
                  <Input type="date" {...register("start_date")} />
                </div>
                <div>
                  <Label>Data fine</Label>
                  <Input type="date" {...register("end_date")} />
                </div>
                <div className={canViewBudget ? "" : "hidden"}>
                  <Label>Budget stimato (€) *</Label>
                  <Input type="number" step="0.01" {...register("budget_estimated")} />
                  {errors.budget_estimated && <p className="text-sm text-destructive mt-1">{errors.budget_estimated.message}</p>}
                </div>
                <div className={canViewBudget ? "" : "hidden"}>
                  <Label>Offerta massima (€) *</Label>
                  <Input type="number" step="0.01" {...register("budget_max")} />
                  {errors.budget_max && <p className="text-sm text-destructive mt-1">{errors.budget_max.message}</p>}
                </div>
                <div className="md:col-span-2 flex flex-col gap-3 pt-2">
                  <Label className="text-sm font-semibold">Documenti offerta richiesti</Label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" {...register("require_technical_offer")} className="accent-primary h-4 w-4" />
                      <span className="text-sm">Offerta Tecnica obbligatoria</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" {...register("require_economic_offer")} className="accent-primary h-4 w-4" />
                      <span className="text-sm">Offerta Economica obbligatoria</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit">
                  Avanti <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — Evaluation Criteria */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Criteri di Valutazione</CardTitle>
              <Button variant="outline" size="sm" onClick={addCriterion}>
                <Plus className="h-4 w-4 mr-1" /> Aggiungi criterio
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {criteria.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nessun criterio definito. Puoi procedere senza criteri oppure aggiungerne.
              </p>
            )}
            {criteria.map((c, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-3 items-end border rounded-lg p-3">
                <div className="col-span-4">
                  <Label>Nome criterio</Label>
                  <Input value={c.name} onChange={(e) => updateCriterion(idx, "name", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label>Peso %</Label>
                  <Input type="number" value={c.weight_pct} onChange={(e) => updateCriterion(idx, "weight_pct", Number(e.target.value))} />
                </div>
                <div className="col-span-2">
                  <Label>Punteggio max</Label>
                  <Input type="number" value={c.max_score} onChange={(e) => updateCriterion(idx, "max_score", Number(e.target.value))} />
                </div>
                <div className="col-span-3">
                  <Label>Soglia minima</Label>
                  <Input type="number" value={c.min_score_threshold} onChange={(e) => updateCriterion(idx, "min_score_threshold", Number(e.target.value))} />
                </div>
                <div className="col-span-1">
                  <Button variant="ghost" size="icon" onClick={() => removeCriterion(idx)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}

            {criteria.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Totale pesi:</span>
                <Badge variant={totalWeight === 100 ? "default" : "destructive"}>
                  {totalWeight}%
                </Badge>
                {totalWeight !== 100 && (
                  <span className="text-sm text-destructive">La somma dei pesi deve essere 100%</span>
                )}
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(0)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Indietro
              </Button>
              <Button onClick={() => setStep(2)} disabled={!criteriaValid}>
                Avanti <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Attachments & Conditions */}
      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>Allegati e Condizioni</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {draftId && (
              <OpportunityAttachments opportunityId={draftId} />
            )}
            {!draftId && (
              <p className="text-sm text-muted-foreground">Salva prima i dati generali per poter caricare gli allegati.</p>
            )}

            <div>
              <Label>Condizioni di partecipazione</Label>
              <Textarea value={conditions} onChange={(e) => setConditions(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Note operative</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Indietro
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSaveDraft} disabled={publishMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" /> Salva bozza
                </Button>
                <Button onClick={handlePublish} disabled={publishMutation.isPending}>
                  <Send className="mr-2 h-4 w-4" /> Pubblica
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
