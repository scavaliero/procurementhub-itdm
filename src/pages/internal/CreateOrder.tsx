import { useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { orderService } from "@/services/orderService";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

interface Milestone {
  date: string;
  description: string;
}

export default function InternalCreateOrder() {
  const { id: opportunityId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [contractConditions, setContractConditions] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  const { data: award, isLoading } = useQuery({
    queryKey: ["award-for-order", opportunityId],
    queryFn: () => orderService.getAwardForOrder(opportunityId!),
    enabled: !!opportunityId,
  });

  // Pre-fill from award data
  const prefilled = award && !subject;
  if (prefilled && award.bids) {
    const bid = award.bids;
    setTimeout(() => {
      setAmount(Number(bid.total_amount ?? 0));
      setSubject(award.justification ? `Ordine - ${award.justification.substring(0, 60)}` : "");
    }, 0);
  }

  const addMilestone = () => setMilestones((m) => [...m, { date: "", description: "" }]);
  const removeMilestone = (i: number) => setMilestones((m) => m.filter((_, idx) => idx !== i));
  const updateMilestone = (i: number, field: keyof Milestone, value: string) => {
    setMilestones((m) => m.map((ms, idx) => (idx === i ? { ...ms, [field]: value } : ms)));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!profile || !award) throw new Error("Dati mancanti");

      // Upload attachments
      for (const file of attachments) {
        await orderService.uploadAttachment(opportunityId!, file);
      }

      return orderService.createOrder({
        tenantId: profile.tenant_id,
        supplierId: award.supplier_id,
        opportunityId: opportunityId!,
        awardId: award.id,
        subject,
        description,
        amount,
        startDate,
        endDate,
        milestones: milestones.filter((m) => m.date && m.description),
        contractConditions,
        issuedBy: profile.id,
      });
    },
    onSuccess: (order) => {
      const msg = order.status === "issued"
        ? "Ordine emesso con successo"
        : "Ordine creato — in attesa di approvazione";
      toast.success(msg);
      navigate("/internal/orders");
    },
    onError: (err: any) => toast.error(err.message || "Errore"),
  });

  if (isLoading) {
    return <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  if (!award) {
    return <EmptyState title="Aggiudicazione non trovata" description="Questa opportunità non è ancora stata aggiudicata." />;
  }

  const isValid = subject.trim() && amount > 0 && startDate && endDate;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Genera Ordine</h1>
          <p className="text-sm text-muted-foreground">
            Fornitore: {award.suppliers?.company_name ?? "—"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Dati ordine</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Fornitore</Label>
            <Input value={award.suppliers?.company_name ?? ""} disabled />
          </div>

          <div className="space-y-2">
            <Label>Oggetto *</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Oggetto dell'ordine" />
          </div>

          <div className="space-y-2">
            <Label>Descrizione</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Importo (€) *</Label>
              <Input type="number" min={0} step="0.01" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Data inizio *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data fine *</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Condizioni contrattuali</Label>
            <Textarea value={contractConditions} onChange={(e) => setContractConditions(e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Milestones</CardTitle>
            <Button variant="outline" size="sm" onClick={addMilestone}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Aggiungi
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {milestones.length === 0 && (
            <p className="text-sm text-muted-foreground">Nessuna milestone definita.</p>
          )}
          {milestones.map((ms, i) => (
            <div key={i} className="flex gap-3 items-start">
              <Input
                type="date"
                className="w-40"
                value={ms.date}
                onChange={(e) => updateMilestone(i, "date", e.target.value)}
              />
              <Input
                className="flex-1"
                placeholder="Descrizione milestone"
                value={ms.description}
                onChange={(e) => updateMilestone(i, "description", e.target.value)}
              />
              <Button variant="ghost" size="icon" onClick={() => removeMilestone(i)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Allegati</CardTitle></CardHeader>
        <CardContent>
          <Input
            type="file"
            multiple
            onChange={(e) => setAttachments(Array.from(e.target.files || []))}
          />
          {attachments.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">{attachments.length} file selezionati</p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          disabled={!isValid || createMutation.isPending}
          onClick={() => createMutation.mutate()}
          className="min-w-[200px]"
        >
          Crea ordine (in approvazione)
        </Button>
      </div>
    </div>
  );
}
