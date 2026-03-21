import { useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useNavigate } from "react-router-dom";
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
  budget_estimated: z.coerce.number().optional(),
  budget_max: z.coerce.number().optional(),
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
  const { profile } = useAuth();
  const { hasGrant } = useGrants();
  const [step, setStep] = useState(0);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [conditions, setConditions] = useState("");
  const [notes, setNotes] = useState("");

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoryService.list(),
  });

  const { data: internalProfiles = [] } = useQuery({
    queryKey: ["internal-profiles"],
    queryFn: () => opportunityService.getInternalProfiles(),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: step1Data ?? {},
  });

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
    onError: (_err: Error) => toast.error(err.message || "Errore nel salvataggio bozza"),
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

      // Upload attachments
      for (const file of attachments) {
        await opportunityService.uploadAttachment(draftId, file);
      }

      return opp;
    },
    onSuccess: (opp) => {
      toast.success("Opportunità creata con successo");
      navigate(`/internal/opportunities/${opp.id}`);
    },
    onError: (_err: Error) => toast.error(err.message || "Errore nella creazione"),
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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Breadcrumb items={[{ label: "Dashboard", href: "/internal" }, { label: "Opportunità", href: "/internal/opportunities" }, { label: "Nuova Opportunità" }]} />
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/internal/opportunities")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Nuova Opportunità</h1>
      </div>

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
                {canViewBudget && (
                  <>
                    <div>
                      <Label>Budget stimato (€)</Label>
                      <Input type="number" step="0.01" {...register("budget_estimated")} />
                    </div>
                    <div>
                      <Label>Budget massimo (€)</Label>
                      <Input type="number" step="0.01" {...register("budget_max")} />
                    </div>
                  </>
                )}
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
            <div>
              <Label>Allegati</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <input
                  type="file"
                  multiple
                  className="hidden"
                  id="opp-files"
                  onChange={(e) => {
                    if (e.target.files) setAttachments([...attachments, ...Array.from(e.target.files)]);
                  }}
                />
                <label htmlFor="opp-files" className="cursor-pointer flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Clicca per caricare file</span>
                </label>
              </div>
              {attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {attachments.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-muted rounded px-3 py-1">
                      <span>{f.name}</span>
                      <Button variant="ghost" size="sm" onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
