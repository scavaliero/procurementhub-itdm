import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { opportunityService } from "@/services/opportunityService";
import { invitationService } from "@/services/invitationService";
import { bidService, type ValidateBidResult } from "@/services/bidService";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { toast } from "sonner";
import { Save, Send, Upload, Trash2, AlertTriangle, FileText, Undo2, Download } from "lucide-react";
import { format } from "date-fns";

interface Props {
  opportunityId: string;
  invitation: any;
  onClose: () => void;
}

export default function SupplierBidSheet({ opportunityId, invitation, onClose }: Props) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const supplierId = profile?.supplier_id;
  const [validationResult, setValidationResult] = useState<ValidateBidResult | null>(null);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const techFileRef = useRef<HTMLInputElement>(null);
  const econFileRef = useRef<HTMLInputElement>(null);
  const [techFile, setTechFile] = useState<File | null>(null);
  const [econFile, setEconFile] = useState<File | null>(null);

  const { data: opp } = useQuery({
    queryKey: ["opportunity", opportunityId],
    queryFn: () => opportunityService.getById(opportunityId),
    enabled: !!opportunityId,
  });

  const { data: existingBid, isLoading: bidLoading } = useQuery({
    queryKey: ["my-bid", opportunityId, supplierId],
    queryFn: () => bidService.getByOpportunityAndSupplier(opportunityId, supplierId!),
    enabled: !!opportunityId && !!supplierId,
  });

  const { data: existingAttachments = [] } = useQuery({
    queryKey: ["bid-attachments", existingBid?.id],
    queryFn: () => bidService.listTypedAttachments(existingBid!.id),
    enabled: !!existingBid?.id,
  });

  const deadlinePassed = opp?.bids_deadline ? new Date(opp.bids_deadline) < new Date() : false;
  const isExcluded = existingBid?.status === "excluded";
  const isSubmitted = !!existingBid && existingBid.status !== "draft";
  const canWithdraw = existingBid?.status === "submitted" && !deadlinePassed;
  const formDisabled = isSubmitted || deadlinePassed;
  const budgetMax = opp?.budget_max ?? null;

  const bidSchema = useMemo(() => {
    let amountSchema = z.coerce.number().positive("Importo obbligatorio");
    if (budgetMax) {
      amountSchema = amountSchema.max(budgetMax, `L'importo non può superare l'offerta massima di € ${budgetMax.toLocaleString("it-IT")}`);
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

  const { register, handleSubmit, formState: { errors }, reset, getValues } = useForm<BidFormData>({
    resolver: zodResolver(bidSchema),
  });

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

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      if (!existingBid || !profile) throw new Error("Dati mancanti");
      await bidService.withdraw(existingBid.id, profile.tenant_id, opportunityId);
    },
    onSuccess: () => {
      toast.success("Offerta ritirata. Puoi presentare una nuova offerta.");
      setShowWithdrawConfirm(false);
      qc.invalidateQueries({ queryKey: ["my-bid", opportunityId, supplierId] });
      reset({ total_amount: undefined, technical_description: "", execution_days: undefined, bid_validity_date: "", proposed_conditions: "", notes: "" });
    },
    onError: (err: any) => toast.error(err.message || "Errore nel ritiro"),
  });

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (!supplierId || !profile) throw new Error("Dati mancanti");
      const values = getValues();
      const bid = await bidService.saveDraft(
        { opportunity_id: opportunityId, supplier_id: supplierId, tenant_id: profile.tenant_id, invitation_id: invitation?.id, total_amount: values.total_amount || undefined, technical_description: values.technical_description, execution_days: values.execution_days || undefined, bid_validity_date: values.bid_validity_date, proposed_conditions: values.proposed_conditions, notes: values.notes },
        existingBid?.id
      );
      if (techFile) { await bidService.uploadTypedAttachment({ bidId: bid.id, opportunityId, supplierId, tenantId: profile.tenant_id, attachmentType: "technical_offer", file: techFile }); setTechFile(null); }
      if (econFile) { await bidService.uploadTypedAttachment({ bidId: bid.id, opportunityId, supplierId, tenantId: profile.tenant_id, attachmentType: "economic_offer", file: econFile }); setEconFile(null); }
      return bid;
    },
    onSuccess: () => { toast.success("Bozza salvata"); qc.invalidateQueries({ queryKey: ["my-bid", opportunityId, supplierId] }); qc.invalidateQueries({ queryKey: ["bid-attachments"] }); },
    onError: (err: any) => toast.error(err.message || "Errore"),
  });

  const submitMutation = useMutation({
    mutationFn: async (data: BidFormData) => {
      if (!supplierId || !profile) throw new Error("Dati mancanti");
      if (budgetMax && data.total_amount > budgetMax) throw new Error(`L'importo supera l'offerta massima`);
      const bid = await bidService.saveDraft(
        { opportunity_id: opportunityId, supplier_id: supplierId, tenant_id: profile.tenant_id, invitation_id: invitation?.id, total_amount: data.total_amount, technical_description: data.technical_description, execution_days: data.execution_days, bid_validity_date: data.bid_validity_date, proposed_conditions: data.proposed_conditions, notes: data.notes },
        existingBid?.id
      );
      if (techFile) await bidService.uploadTypedAttachment({ bidId: bid.id, opportunityId, supplierId, tenantId: profile.tenant_id, attachmentType: "technical_offer", file: techFile });
      if (econFile) await bidService.uploadTypedAttachment({ bidId: bid.id, opportunityId, supplierId, tenantId: profile.tenant_id, attachmentType: "economic_offer", file: econFile });
      const validation = await bidService.validate(opportunityId, supplierId);
      setValidationResult(validation);
      if (!validation.valid) throw new Error(validation.message || "Validazione fallita");
      return bidService.submit(bid.id, profile.tenant_id, opportunityId, invitation?.id);
    },
    onSuccess: () => {
      toast.success("Offerta inviata con successo");
      qc.invalidateQueries({ queryKey: ["my-bid", opportunityId, supplierId] });
      qc.invalidateQueries({ queryKey: ["bid-attachments"] });
      setTechFile(null); setEconFile(null);
    },
    onError: (err: any) => { if (!validationResult || validationResult.valid) toast.error(err.message || "Errore"); },
  });

  const existingTechAtt = existingAttachments.find((a: any) => a.attachment_type === "technical_offer");
  const existingEconAtt = existingAttachments.find((a: any) => a.attachment_type === "economic_offer");

  // Read-only view for submitted bids
  if (isSubmitted) {
    return (
      <div className="space-y-5">
        <SheetHeader>
          <SheetTitle className="text-xl">Offerta presentata</SheetTitle>
          <div className="flex items-center gap-2 pt-1">
            <Badge className={
              existingBid.status === "winning" ? "bg-emerald-100 text-emerald-700" :
              existingBid.status === "submitted" ? "bg-blue-100 text-blue-700" :
              existingBid.status === "excluded" ? "bg-red-100 text-red-700" :
              existingBid.status === "not_awarded" ? "bg-amber-100 text-amber-700" :
              existingBid.status === "admitted" ? "bg-emerald-100 text-emerald-700" :
              "bg-muted text-muted-foreground"
            }>
              {existingBid.status === "winning" ? "Aggiudicata" :
               existingBid.status === "submitted" ? "Inviata" :
               existingBid.status === "excluded" ? "Esclusa" :
               existingBid.status === "not_awarded" ? "Non aggiudicata" :
               existingBid.status === "admitted" ? "Ammessa" :
               existingBid.status}
            </Badge>
            {existingBid.submitted_at && (
              <span className="text-xs text-muted-foreground">
                Inviata il {format(new Date(existingBid.submitted_at), "dd/MM/yyyy HH:mm")}
              </span>
            )}
          </div>
        </SheetHeader>

        <Separator />

        <Card>
          <CardContent className="pt-4 space-y-4">
            <ReadField label="Importo totale" value={existingBid.total_amount != null ? `€ ${Number(existingBid.total_amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : undefined} />
            <ReadField label="Giorni di esecuzione" value={existingBid.execution_days?.toString()} />
            <ReadField label="Validità offerta" value={existingBid.bid_validity_date ? format(new Date(existingBid.bid_validity_date), "dd/MM/yyyy") : undefined} />
            <ReadField label="Data presentazione" value={existingBid.submitted_at ? format(new Date(existingBid.submitted_at), "dd/MM/yyyy HH:mm") : undefined} />
            <ReadField label="Descrizione tecnica" value={existingBid.technical_description} multiline />
            {existingBid.proposed_conditions && <ReadField label="Condizioni proposte" value={existingBid.proposed_conditions} multiline />}
            {existingBid.notes && <ReadField label="Note" value={existingBid.notes} multiline />}
          </CardContent>
        </Card>

        {/* Attachments */}
        {existingAttachments.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-2">Allegati</p>
              <div className="space-y-2">
                {existingAttachments.map((att: any) => (
                  <div key={att.id} className="flex items-center gap-3 bg-muted rounded-md px-3 py-2">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{att.original_filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {att.attachment_type === "technical_offer" ? "Offerta Tecnica" : "Offerta Economica"}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={async () => { const url = await bidService.getBidAttachmentUrl(att.storage_path); window.open(url, "_blank"); }}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Withdraw */}
        {canWithdraw && (
          <>
            <Separator />
            <Button variant="outline" className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => setShowWithdrawConfirm(true)}>
              <Undo2 className="h-4 w-4" /> Ritira offerta
            </Button>
          </>
        )}

        <Dialog open={showWithdrawConfirm} onOpenChange={setShowWithdrawConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ritira offerta</DialogTitle>
              <DialogDescription>
                Sei sicuro di voler ritirare la tua offerta? L'offerta ritirata rimarrà nello storico ma non sarà più considerata nella valutazione. Potrai presentare una nuova offerta.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowWithdrawConfirm(false)}>Annulla</Button>
              <Button variant="destructive" disabled={withdrawMutation.isPending} onClick={() => withdrawMutation.mutate()}>
                <Undo2 className="h-4 w-4 mr-2" /> {withdrawMutation.isPending ? "Ritiro…" : "Conferma ritiro"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Editable form (draft or new)
  return (
    <div className="space-y-5">
      <SheetHeader>
        <SheetTitle className="text-xl">{existingBid ? "Modifica offerta" : "Presenta offerta"}</SheetTitle>
      </SheetHeader>

      {validationResult && !validationResult.valid && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Validazione fallita</AlertTitle>
          <AlertDescription>{validationResult.message}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit((data) => submitMutation.mutate(data))} className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label>Importo totale (€) *{budgetMax && <span className="text-xs text-muted-foreground ml-2">(max € {budgetMax.toLocaleString("it-IT")})</span>}</Label>
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

        <Separator />

        {/* Attachments */}
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><FileText className="h-4 w-4" /> Offerta Tecnica</Label>
            {existingTechAtt && !techFile && (
              <div className="flex items-center gap-2 text-sm bg-muted rounded px-3 py-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{existingTechAtt.original_filename}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">Caricato</Badge>
              </div>
            )}
            {techFile && (
              <div className="flex items-center gap-2 text-sm bg-primary/5 border border-primary/20 rounded px-3 py-2">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate flex-1">{techFile.name}</span>
                <Button variant="ghost" size="sm" type="button" onClick={() => setTechFile(null)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            )}
            <input ref={techFileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => { if (e.target.files?.[0]) setTechFile(e.target.files[0]); }} />
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => techFileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 mr-1" /> {existingTechAtt || techFile ? "Sostituisci" : "Carica"} offerta tecnica
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><FileText className="h-4 w-4" /> Offerta Economica</Label>
            {existingEconAtt && !econFile && (
              <div className="flex items-center gap-2 text-sm bg-muted rounded px-3 py-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{existingEconAtt.original_filename}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">Caricato</Badge>
              </div>
            )}
            {econFile && (
              <div className="flex items-center gap-2 text-sm bg-primary/5 border border-primary/20 rounded px-3 py-2">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate flex-1">{econFile.name}</span>
                <Button variant="ghost" size="sm" type="button" onClick={() => setEconFile(null)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            )}
            <input ref={econFileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => { if (e.target.files?.[0]) setEconFile(e.target.files[0]); }} />
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => econFileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 mr-1" /> {existingEconAtt || econFile ? "Sostituisci" : "Carica"} offerta economica
            </Button>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button type="button" variant="outline" className="flex-1" onClick={() => saveDraftMutation.mutate()} disabled={saveDraftMutation.isPending}>
            <Save className="mr-2 h-4 w-4" /> Salva bozza
          </Button>
          <Button type="submit" className="flex-1" disabled={submitMutation.isPending}>
            <Send className="mr-2 h-4 w-4" /> Invia offerta
          </Button>
        </div>
      </form>
    </div>
  );
}

function ReadField({ label, value, multiline }: { label: string; value?: string | null; multiline?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground font-medium mb-0.5">{label}</p>
      {multiline ? (
        <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md px-3 py-2">{value ?? "—"}</p>
      ) : (
        <p className="text-sm font-medium">{value ?? "—"}</p>
      )}
    </div>
  );
}
