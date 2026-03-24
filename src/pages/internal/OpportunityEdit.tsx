import { useState, useEffect } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { opportunityService } from "@/services/opportunityService";
import { categoryService } from "@/services/categoryService";
import { invitationService } from "@/services/invitationService";
import { notificationService } from "@/services/notificationService";
import { auditService } from "@/services/auditService";
import { useAuth } from "@/hooks/useAuth";
import { useGrants } from "@/hooks/useGrants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";

const formSchema = z.object({
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
  participation_conditions: z.string().optional(),
  operational_notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Criterion {
  name: string;
  weight_pct: number;
  max_score: number;
  min_score_threshold: number;
}

export default function InternalOpportunityEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { hasGrant } = useGrants();
  const [criteria, setCriteria] = useState<Criterion[]>([]);

  const { data: opp, isLoading } = useQuery({
    queryKey: ["opportunity", id],
    queryFn: () => opportunityService.getById(id!),
    enabled: !!id,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoryService.list(),
  });

  const { data: internalProfiles = [] } = useQuery({
    queryKey: ["internal-profiles"],
    queryFn: () => opportunityService.getInternalProfiles(),
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ["invitations", id],
    queryFn: () => invitationService.getInvitationsByOpportunity(id!),
    enabled: !!id,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (opp) {
      reset({
        title: opp.title,
        description: opp.description || "",
        category_id: opp.category_id || "",
        internal_ref_id: opp.internal_ref_id || "",
        requesting_unit: opp.requesting_unit || "",
        opens_at: opp.opens_at ? opp.opens_at.slice(0, 16) : "",
        bids_deadline: opp.bids_deadline ? opp.bids_deadline.slice(0, 16) : "",
        start_date: opp.start_date || "",
        end_date: opp.end_date || "",
        budget_estimated: opp.budget_estimated ?? undefined,
        budget_max: opp.budget_max ?? undefined,
        participation_conditions: opp.participation_conditions || "",
        operational_notes: opp.operational_notes || "",
      });
      const ec = Array.isArray(opp.evaluation_criteria) ? opp.evaluation_criteria as Criterion[] : [];
      setCriteria(ec);
    }
  }, [opp, reset]);

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!profile) throw new Error("Profilo non trovato");

      const oldState = {
        title: opp?.title,
        description: opp?.description,
        budget_estimated: opp?.budget_estimated,
        budget_max: opp?.budget_max,
        bids_deadline: opp?.bids_deadline,
      };

      const updated = await opportunityService.update(id!, {
        title: data.title,
        description: data.description || null,
        category_id: data.category_id || null,
        internal_ref_id: data.internal_ref_id || null,
        requesting_unit: data.requesting_unit || null,
        opens_at: data.opens_at || null,
        bids_deadline: data.bids_deadline || null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        budget_estimated: data.budget_estimated ?? null,
        budget_max: data.budget_max ?? null,
        participation_conditions: data.participation_conditions || null,
        operational_notes: data.operational_notes || null,
        evaluation_criteria: criteria.length > 0 ? (criteria as any) : [],
      } as any);

      await auditService.log({
        tenant_id: profile.tenant_id,
        entity_type: "opportunity",
        entity_id: id!,
        event_type: "opportunity_updated",
        old_state: oldState,
        new_state: {
          title: data.title,
          description: data.description,
          budget_estimated: data.budget_estimated,
          budget_max: data.budget_max,
          bids_deadline: data.bids_deadline,
        },
      });

      // Notify invited suppliers about the update
      if (invitations.length > 0) {
        await opportunityService.notifyInvitedSuppliersOfUpdate({
          opportunityId: id!,
          tenantId: profile.tenant_id,
          opportunityTitle: data.title,
          opportunityCode: opp?.code || "",
          invitations,
        });
      }

      return updated;
    },
    onSuccess: () => {
      toast.success("Opportunità aggiornata con successo");
      qc.invalidateQueries({ queryKey: ["opportunity", id] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      navigate(`/internal/opportunities/${id}`);
    },
    onError: (err: Error) => toast.error(err.message || "Errore nel salvataggio"),
  });

  const canViewBudget = hasGrant("view_budget");
  const totalWeight = criteria.reduce((s, c) => s + (c.weight_pct || 0), 0);
  const criteriaValid = criteria.length === 0 || totalWeight === 100;

  const addCriterion = () => {
    setCriteria([...criteria, { name: "", weight_pct: 0, max_score: 10, min_score_threshold: 0 }]);
  };

  const removeCriterion = (idx: number) => {
    setCriteria(criteria.filter((_, i) => i !== idx));
  };

  const updateCriterion = (idx: number, field: keyof Criterion, value: string | number) => {
    setCriteria(criteria.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  if (isLoading) return <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Breadcrumb items={[
        { label: "Dashboard", href: "/internal" },
        { label: "Opportunità", href: "/internal/opportunities" },
        { label: opp?.title || "Modifica", href: `/internal/opportunities/${id}` },
        { label: "Modifica" },
      ]} />
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/internal/opportunities/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Modifica Opportunità</h1>
        {invitations.length > 0 && (
          <Badge variant="secondary" className="bg-amber-100 text-amber-700">
            {invitations.length} fornitore/i già invitato/i — verranno notificati delle modifiche
          </Badge>
        )}
      </div>

      <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-6">
        {/* General data */}
        <Card>
          <CardHeader><CardTitle>Dati Generali</CardTitle></CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Criteria */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Criteri di Valutazione</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addCriterion}>
                <Plus className="h-4 w-4 mr-1" /> Aggiungi criterio
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {criteria.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nessun criterio definito.</p>
            )}
            {criteria.map((c, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-3 items-end border rounded-lg p-3">
                <div className="col-span-12 sm:col-span-4">
                  <Label>Nome criterio</Label>
                  <Input value={c.name} onChange={(e) => updateCriterion(idx, "name", e.target.value)} />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Label>Peso %</Label>
                  <Input type="number" value={c.weight_pct} onChange={(e) => updateCriterion(idx, "weight_pct", Number(e.target.value))} />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Label>Max</Label>
                  <Input type="number" value={c.max_score} onChange={(e) => updateCriterion(idx, "max_score", Number(e.target.value))} />
                </div>
                <div className="col-span-3 sm:col-span-3">
                  <Label>Soglia</Label>
                  <Input type="number" value={c.min_score_threshold} onChange={(e) => updateCriterion(idx, "min_score_threshold", Number(e.target.value))} />
                </div>
                <div className="col-span-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeCriterion(idx)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {criteria.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Totale pesi:</span>
                <Badge variant={totalWeight === 100 ? "default" : "destructive"}>{totalWeight}%</Badge>
                {totalWeight !== 100 && <span className="text-sm text-destructive">La somma dei pesi deve essere 100%</span>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conditions */}
        <Card>
          <CardHeader><CardTitle>Condizioni</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Condizioni di partecipazione</Label>
              <Textarea {...register("participation_conditions")} rows={3} />
            </div>
            <div>
              <Label>Note operative</Label>
              <Textarea {...register("operational_notes")} rows={3} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(`/internal/opportunities/${id}`)}>
            Annulla
          </Button>
          <Button type="submit" disabled={saveMutation.isPending || !criteriaValid}>
            <Save className="mr-2 h-4 w-4" /> Salva modifiche
          </Button>
        </div>
      </form>
    </div>
  );
}
