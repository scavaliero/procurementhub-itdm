import React, { useState, useMemo, useCallback } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { opportunityService } from "@/services/opportunityService";
import { bidService, type EvaluationInvitation } from "@/services/bidService";
import { useAuth } from "@/hooks/useAuth";
import { useGrants } from "@/hooks/useGrants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Check, AlertTriangle, X, Trophy, ChevronDown, ChevronRight, FileText, Download, RotateCcw } from "lucide-react";

interface CriterionDef {
  name: string;
  weight_pct: number;
  max_score: number;
  min_score_threshold: number;
}

const BID_STATUS_LABELS: Record<string, string> = {
  draft: "Bozza",
  submitted: "Inviata",
  under_evaluation: "In valutazione",
  admitted: "Ammessa",
  admitted_with_reserve: "Ammessa con riserva",
  excluded: "Esclusa",
  accepted: "Accettata",
  rejected: "Respinta",
  withdrawn: "Ritirata",
  winning: "Vincitrice",
  not_awarded: "Non aggiudicata",
};

const BID_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  under_evaluation: "bg-purple-100 text-purple-700",
  admitted: "bg-emerald-100 text-emerald-700",
  admitted_with_reserve: "bg-amber-100 text-amber-700",
  excluded: "bg-red-100 text-red-700",
  winning: "bg-emerald-100 text-emerald-800",
  not_awarded: "bg-gray-200 text-gray-600",
};

// Status options removed — replaced by icon-based actions

export default function InternalOpportunityEvaluation() {
  const { id: opportunityId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { hasGrant } = useGrants();
  const [excludeDialog, setExcludeDialog] = useState<{ bidId: string; supplierName: string } | null>(null);
  const [excludeReason, setExcludeReason] = useState("");
  const [awardDialog, setAwardDialog] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState("");
  const [awardJustification, setAwardJustification] = useState("");
  const [expandedBid, setExpandedBid] = useState<string | null>(null);

  const [scores, setScores] = useState<Record<string, Record<string, number>>>({});

  const { data: opp, isLoading: oppLoading } = useQuery({
    queryKey: ["opportunity", opportunityId],
    queryFn: () => opportunityService.getById(opportunityId!),
    enabled: !!opportunityId,
  });

  const { data: invitations = [], isLoading: invLoading } = useQuery({
    queryKey: ["evaluation-bids", opportunityId],
    queryFn: () => bidService.listForEvaluation(opportunityId!),
    enabled: !!opportunityId,
  });

  const criteria: CriterionDef[] = useMemo(
    () => (Array.isArray(opp?.evaluation_criteria) ? (opp.evaluation_criteria as unknown as CriterionDef[]) : []),
    [opp]
  );

  const budgetMax = opp?.budget_max ?? null;

  useMemo(() => {
    const initial: Record<string, Record<string, number>> = {};
    invitations.forEach((inv: EvaluationInvitation) => {
      (inv.bids ?? []).forEach((bid) => {
        if (bid?.bid_evaluations?.[0]) {
          const cs = bid.bid_evaluations[0].criteria_scores as Record<string, number>;
          if (cs) initial[bid.id] = cs;
        }
      });
    });
    if (Object.keys(initial).length > 0 && Object.keys(scores).length === 0) {
      setScores(initial);
    }
  }, [invitations]);

  const computeTotal = useCallback(
    (bidId: string) => {
      const bidScores = scores[bidId] ?? {};
      return criteria.reduce((sum, c) => {
        const score = bidScores[c.name] ?? 0;
        return sum + (score * c.weight_pct) / 100;
      }, 0);
    },
    [scores, criteria]
  );

  const setScore = (bidId: string, criterionName: string, value: number) => {
    setScores((prev) => ({
      ...prev,
      [bidId]: { ...(prev[bidId] ?? {}), [criterionName]: value },
    }));
  };

  // Auto-save evaluation + change status in one action
  const actionMutation = useMutation({
    mutationFn: async ({ bidId, status, reason }: { bidId: string; status: string; reason?: string }) => {
      if (!profile) throw new Error("Profilo non trovato");
      // Save evaluation scores first (if any criteria exist)
      if (criteria.length > 0 && scores[bidId]) {
        await bidService.saveEvaluation({
          bidId,
          evaluatorId: profile.id,
          criteriaScores: scores[bidId] ?? {},
          totalScore: computeTotal(bidId),
          tenantId: profile.tenant_id,
        });
      }
      // Then update status
      await bidService.updateBidStatus(bidId, status, profile.tenant_id, reason);
    },
    onSuccess: () => {
      toast.success("Stato aggiornato e valutazione salvata");
      qc.invalidateQueries({ queryKey: ["evaluation-bids", opportunityId] });
      setExcludeDialog(null);
      setExcludeReason("");
    },
    onError: (err: Error) => toast.error(err.message || "Errore"),
  });

  const admittedBids = useMemo(() => {
    const result: { bidId: string; supplierId: string; supplierName: string; totalAmount: number; score: number; exceedsBudget: boolean }[] = [];
    invitations.forEach((inv: EvaluationInvitation) => {
      (inv.bids ?? []).forEach((bid) => {
        if (bid && (bid.status === "admitted" || bid.status === "admitted_with_reserve")) {
          const amount = Number(bid.total_amount ?? 0);
          result.push({
            bidId: bid.id,
            supplierId: inv.supplier_id,
            supplierName: inv.suppliers?.company_name ?? "—",
            totalAmount: amount,
            score: computeTotal(bid.id),
            exceedsBudget: budgetMax != null && amount > budgetMax,
          });
        }
      });
    });
    return result;
  }, [invitations, computeTotal, budgetMax]);

  const allSubmittedBidIds = useMemo(() => {
    return invitations
      .flatMap((inv: EvaluationInvitation) => (inv.bids ?? []).filter(b => b.status !== "withdrawn" && b.status !== "draft").map(b => b.id))
      .filter(Boolean) as string[];
  }, [invitations]);

  const canAward = hasGrant("approve_award");
  const canCreateOrder = hasGrant("manage_orders");
  const isAwarded = opp?.status === "awarded";

  const selectedWinnerData = admittedBids.find((b) => b.bidId === selectedWinner);
  const winnerExceedsBudget = selectedWinnerData?.exceedsBudget ?? false;

  const awardMutation = useMutation({
    mutationFn: async () => {
      if (!profile || !selectedWinner) throw new Error("Dati mancanti");
      const winner = admittedBids.find((b) => b.bidId === selectedWinner);
      if (!winner) throw new Error("Offerta non trovata");
      if (winner.exceedsBudget) {
        throw new Error(`L'offerta di ${winner.supplierName} (€ ${winner.totalAmount.toLocaleString("it-IT")}) supera l'offerta massima (€ ${budgetMax?.toLocaleString("it-IT")}). Non è possibile aggiudicare.`);
      }
      await bidService.awardOpportunity({
        opportunityId: opportunityId!,
        winningBidId: winner.bidId,
        supplierId: winner.supplierId,
        awardedBy: profile.id,
        justification: awardJustification,
        tenantId: profile.tenant_id,
        allBidIds: allSubmittedBidIds,
      });
    },
    onSuccess: () => {
      toast.success("Aggiudicazione completata");
      qc.invalidateQueries({ queryKey: ["evaluation-bids", opportunityId] });
      qc.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
      setAwardDialog(false);
      setSelectedWinner("");
      setAwardJustification("");
    },
    onError: (err: Error) => toast.error(err.message || "Errore"),
  });

  if (oppLoading || invLoading) {
    return <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  if (!opp) {
    return <EmptyState title="Opportunità non trovata" />;
  }

  const canEvaluate = hasGrant("evaluate_bids");
  const actionsDisabled = isAwarded;

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: "Dashboard", href: "/internal" }, { label: "Opportunità", href: "/internal/opportunities" }, { label: opp.title, href: `/internal/opportunities/${opportunityId}` }, { label: "Valutazione" }]} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/internal/opportunities/${opportunityId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Valutazione Offerte</h1>
            <p className="text-sm text-muted-foreground">{opp.title} — {opp.code}</p>
            {budgetMax != null && (
              <p className="text-xs text-muted-foreground">Offerta massima: € {budgetMax.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
            )}
          </div>
        </div>
        {canAward && !isAwarded && admittedBids.length > 0 && (
          <Button onClick={() => setAwardDialog(true)} className="gap-2">
            <Trophy className="h-4 w-4" />
            Seleziona vincitore
          </Button>
        )}
        {isAwarded && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-sm px-3 py-1">
              Aggiudicata
            </Badge>
            {canCreateOrder && (
              <Button variant="outline" onClick={() => navigate(`/internal/opportunities/${opportunityId}/create-order`)}>
                Genera ordine
              </Button>
            )}
          </div>
        )}
      </div>

      {invitations.length === 0 ? (
        <EmptyState title="Nessuna offerta" description="Nessun fornitore ha ancora presentato un'offerta." />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[160px]">Fornitore</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Importo (€)</TableHead>
                    <TableHead className="text-center">Giorni</TableHead>
                    {criteria.map((c) => (
                      <TableHead key={c.name} className="text-center min-w-[100px]">
                        <div className="text-xs">{c.name}</div>
                        <div className="text-[10px] text-muted-foreground">{c.weight_pct}% (max {c.max_score})</div>
                      </TableHead>
                    ))}
                    {/* Totale column removed */}
                    {canEvaluate && !actionsDisabled && <TableHead className="text-center">Azioni</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((inv: EvaluationInvitation) => {
                    const bids = inv.bids ?? [];
                    if (bids.length === 0) {
                      // Supplier invited but no bid yet
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="w-8 px-2" />
                          <TableCell className="sticky left-0 bg-background font-medium">{inv.suppliers?.company_name ?? "—"}</TableCell>
                          <TableCell><Badge variant="secondary" className="bg-gray-100 text-gray-500">{BID_STATUS_LABELS["no_bid"] ?? "Nessuna offerta"}</Badge></TableCell>
                          <TableCell className="text-right">—</TableCell>
                          <TableCell className="text-center">—</TableCell>
                          {criteria.map((c) => <TableCell key={c.name} className="text-center">—</TableCell>)}
                          {/* Totale removed */}
                          {canEvaluate && !actionsDisabled && <TableCell />}
                        </TableRow>
                      );
                    }

                    return bids.map((bid, bidIdx) => {
                    const bidId = bid?.id;
                    const bidStatus = bid?.status ?? "no_bid";
                    const hasBid = !!bid && bid.status !== "draft";
                    const total = bidId ? computeTotal(bidId) : 0;
                    const bidAmount = Number(bid?.total_amount ?? 0);
                    const overBudget = budgetMax != null && bidAmount > budgetMax && hasBid;
                    const isExpanded = expandedBid === bidId;
                    const isWithdrawnBid = bidStatus === "withdrawn";

                    return (
                      <React.Fragment key={`${inv.id}-${bid.id}`}>
                        <TableRow key={`${inv.id}-bid-${bid.id}`} className={`${isExpanded ? "border-b-0" : ""} ${isWithdrawnBid ? "opacity-50" : ""}`}>
                          <TableCell className="w-8 px-2">
                            {hasBid && bidId && !isWithdrawnBid && (
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setExpandedBid(isExpanded ? null : bidId)}>
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="sticky left-0 bg-background font-medium">
                            <div>{inv.suppliers?.company_name ?? "—"}</div>
                            {bids.length > 1 && <span className="text-[10px] text-muted-foreground">v{bid.version ?? bidIdx + 1}</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={BID_STATUS_COLORS[bidStatus] ?? "bg-gray-100 text-gray-500"}>
                              {BID_STATUS_LABELS[bidStatus] ?? bidStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right font-mono ${overBudget ? "text-destructive font-bold" : ""}`}>
                            {hasBid ? `€ ${bidAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—"}
                            {overBudget && <span className="block text-[10px]">⚠ Supera budget</span>}
                          </TableCell>
                          <TableCell className="text-center">{hasBid ? bid.execution_days ?? "—" : "—"}</TableCell>
                          {criteria.map((c) => (
                            <TableCell key={c.name} className="text-center">
                              {hasBid && canEvaluate && bidId && !actionsDisabled ? (
                                <Input
                                  type="number"
                                  min={0}
                                  max={c.max_score}
                                  className="w-16 mx-auto text-center h-8 text-sm"
                                  value={scores[bidId]?.[c.name] ?? ""}
                                  onChange={(e) => setScore(bidId, c.name, Math.min(c.max_score, Math.max(0, Number(e.target.value))))}
                                />
                              ) : hasBid && bidId ? (
                                <span>{scores[bidId]?.[c.name] ?? "—"}</span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          ))}
                          <TableCell className="text-center font-bold">
                            {hasBid && bidId ? total.toFixed(2) : "—"}
                          </TableCell>
                          {canEvaluate && !actionsDisabled && (
                            <TableCell>
                              {hasBid && bidId && (() => {
                                const isSubmitted = bidStatus === "submitted";
                                const isAdmitted = bidStatus === "admitted" || bidStatus === "admitted_with_reserve";
                                const isExcluded = bidStatus === "excluded";
                                const isWinning = bidStatus === "winning" || bidStatus === "not_awarded";
                                const isWithdrawn = bidStatus === "withdrawn";

                                if (isWinning) return <span className="text-xs text-muted-foreground">—</span>;
                                if (isExcluded) return <Badge variant="destructive" className="text-xs">Esclusa (definitiva)</Badge>;
                                if (isWithdrawn) return <Badge variant="secondary" className="text-xs">Ritirata</Badge>;

                                if (isSubmitted) {
                                  return (
                                    <TooltipProvider>
                                      <div className="flex items-center gap-1 justify-center">
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                              onClick={() => actionMutation.mutate({ bidId, status: "admitted" })}
                                              disabled={actionMutation.isPending}
                                            >
                                              <Check className="h-4 w-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Ammetti offerta</TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                              onClick={() => setExcludeDialog({ bidId, supplierName: inv.suppliers?.company_name ?? "" })}
                                              disabled={actionMutation.isPending}
                                            >
                                              <X className="h-4 w-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Escludi offerta</TooltipContent>
                                        </Tooltip>
                                      </div>
                                    </TooltipProvider>
                                  );
                                }

                                if (isAdmitted) {
                                  return (
                                    <TooltipProvider>
                                      <div className="flex items-center gap-1 justify-center">
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                              onClick={() => actionMutation.mutate({ bidId, status: "submitted" })}
                                              disabled={actionMutation.isPending}
                                            >
                                              <RotateCcw className="h-4 w-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Ripristina a "Inviata"</TooltipContent>
                                        </Tooltip>
                                      </div>
                                    </TooltipProvider>
                                  );
                                }

                                return <span className="text-xs text-muted-foreground">—</span>;
                              })()}
                            </TableCell>
                          )}
                        </TableRow>
                        {/* Expanded bid detail */}
                        {isExpanded && bidId && (
                          <TableRow key={`${inv.id}-detail-${bid.id}`}>
                            <TableCell colSpan={6 + criteria.length + (canEvaluate && !actionsDisabled ? 1 : 0)} className="bg-muted/30 p-0">
                              <BidDetailPanel bidId={bidId} bid={bid!} />
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                    });
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Exclude Dialog */}
      <Dialog open={!!excludeDialog} onOpenChange={() => { setExcludeDialog(null); setExcludeReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escludi offerta — {excludeDialog?.supplierName}</DialogTitle>
          </DialogHeader>
          <Alert variant="destructive" className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Attenzione:</strong> l'esclusione è irreversibile. Il fornitore verrà notificato e non potrà presentare una nuova offerta per questa opportunità.
            </AlertDescription>
          </Alert>
          <div className="space-y-3">
            <Label>Motivazione esclusione *</Label>
            <Textarea
              value={excludeReason}
              onChange={(e) => setExcludeReason(e.target.value)}
              rows={3}
              placeholder="Inserisci la motivazione..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setExcludeDialog(null); setExcludeReason(""); }}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              disabled={!excludeReason.trim() || actionMutation.isPending}
              onClick={() => {
                if (excludeDialog) {
                  actionMutation.mutate({ bidId: excludeDialog.bidId, status: "excluded", reason: excludeReason });
                }
              }}
            >
              Conferma esclusione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Award Dialog */}
      <Dialog open={awardDialog} onOpenChange={(open) => { if (!open) { setAwardDialog(false); setSelectedWinner(""); setAwardJustification(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seleziona vincitore</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Offerta vincitrice *</Label>
              <Select value={selectedWinner} onValueChange={setSelectedWinner}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un fornitore..." />
                </SelectTrigger>
                <SelectContent>
                  {admittedBids.map((b) => (
                    <SelectItem key={b.bidId} value={b.bidId} disabled={b.exceedsBudget}>
                      {b.supplierName} — € {b.totalAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })} (punteggio: {b.score.toFixed(2)})
                      {b.exceedsBudget && " ⚠ Supera budget"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {winnerExceedsBudget && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Questa offerta supera l'offerta massima. Non è possibile aggiudicarla.
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <div className="space-y-2">
              <Label>Motivazione aggiudicazione *</Label>
              <Textarea
                value={awardJustification}
                onChange={(e) => setAwardJustification(e.target.value)}
                rows={3}
                placeholder="Inserisci la motivazione dell'aggiudicazione..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAwardDialog(false); setSelectedWinner(""); setAwardJustification(""); }}>
              Annulla
            </Button>
            <Button
              disabled={!selectedWinner || !awardJustification.trim() || awardMutation.isPending || winnerExceedsBudget}
              onClick={() => awardMutation.mutate()}
            >
              Conferma aggiudicazione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Expanded panel showing bid details + attachments */
function BidDetailPanel({ bidId, bid }: { bidId: string; bid: any }) {
  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["bid-attachments-admin", bidId],
    queryFn: () => bidService.listTypedAttachments(bidId),
    enabled: !!bidId,
  });

  const techAtt = attachments.find((a: any) => a.attachment_type === "technical_offer");
  const econAtt = attachments.find((a: any) => a.attachment_type === "economic_offer");

  return (
    <div className="px-6 py-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bid.technical_description && (
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">Descrizione tecnica</p>
            <p className="text-sm whitespace-pre-wrap bg-background rounded border p-3">{bid.technical_description}</p>
          </div>
        )}
        {bid.proposed_conditions && (
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">Condizioni proposte</p>
            <p className="text-sm whitespace-pre-wrap bg-background rounded border p-3">{bid.proposed_conditions}</p>
          </div>
        )}
        {bid.notes && (
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">Note</p>
            <p className="text-sm whitespace-pre-wrap bg-background rounded border p-3">{bid.notes}</p>
          </div>
        )}
        {bid.bid_validity_date && (
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">Validità offerta</p>
            <p className="text-sm">{new Date(bid.bid_validity_date).toLocaleDateString("it-IT")}</p>
          </div>
        )}
      </div>

      <Separator />

      <div>
        <p className="text-xs text-muted-foreground font-medium mb-2">Allegati offerta</p>
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : attachments.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nessun allegato caricato</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {techAtt && (
              <div className="flex items-center gap-2 bg-background rounded border px-3 py-2">
                <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{techAtt.original_filename}</p>
                  <p className="text-[10px] text-muted-foreground">Offerta Tecnica</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={async () => {
                    const url = await bidService.getBidAttachmentUrl(techAtt.storage_path);
                    window.open(url, "_blank");
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {econAtt && (
              <div className="flex items-center gap-2 bg-background rounded border px-3 py-2">
                <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{econAtt.original_filename}</p>
                  <p className="text-[10px] text-muted-foreground">Offerta Economica</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={async () => {
                    const url = await bidService.getBidAttachmentUrl(econAtt.storage_path);
                    window.open(url, "_blank");
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
