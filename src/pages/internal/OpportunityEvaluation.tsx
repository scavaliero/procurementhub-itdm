import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { opportunityService } from "@/services/opportunityService";
import { bidService } from "@/services/bidService";
import { useAuth } from "@/hooks/useAuth";
import { useGrants } from "@/hooks/useGrants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { ArrowLeft, Check, AlertTriangle, X, Save } from "lucide-react";
import { format } from "date-fns";

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
};

const BID_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  under_evaluation: "bg-purple-100 text-purple-700",
  admitted: "bg-emerald-100 text-emerald-700",
  admitted_with_reserve: "bg-amber-100 text-amber-700",
  excluded: "bg-red-100 text-red-700",
};

export default function InternalOpportunityEvaluation() {
  const { id: opportunityId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { hasGrant } = useGrants();
  const [excludeDialog, setExcludeDialog] = useState<{ bidId: string; supplierName: string } | null>(null);
  const [excludeReason, setExcludeReason] = useState("");

  // Scores: { [bidId]: { [criterionName]: score } }
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

  // Initialize scores from existing evaluations
  useMemo(() => {
    const initial: Record<string, Record<string, number>> = {};
    invitations.forEach((inv: any) => {
      const bid = inv.bids?.[0];
      if (bid?.bid_evaluations?.[0]) {
        const cs = bid.bid_evaluations[0].criteria_scores as Record<string, number>;
        if (cs) initial[bid.id] = cs;
      }
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

  const saveEvalMutation = useMutation({
    mutationFn: async (bidId: string) => {
      if (!profile) throw new Error("Profilo non trovato");
      await bidService.saveEvaluation({
        bidId,
        evaluatorId: profile.id,
        criteriaScores: scores[bidId] ?? {},
        totalScore: computeTotal(bidId),
        tenantId: profile.tenant_id,
      });
    },
    onSuccess: () => {
      toast.success("Valutazione salvata");
      qc.invalidateQueries({ queryKey: ["evaluation-bids", opportunityId] });
    },
    onError: (err: any) => toast.error(err.message || "Errore"),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ bidId, status, reason }: { bidId: string; status: string; reason?: string }) => {
      if (!profile) throw new Error("Profilo non trovato");
      await bidService.updateBidStatus(bidId, status, profile.tenant_id, reason);
    },
    onSuccess: () => {
      toast.success("Stato aggiornato");
      qc.invalidateQueries({ queryKey: ["evaluation-bids", opportunityId] });
      setExcludeDialog(null);
      setExcludeReason("");
    },
    onError: (err: any) => toast.error(err.message || "Errore"),
  });

  if (oppLoading || invLoading) {
    return <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  if (!opp) {
    return <EmptyState title="Opportunità non trovata" />;
  }

  const canEvaluate = hasGrant("evaluate_bids");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/internal/opportunities/${opportunityId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Valutazione Offerte</h1>
          <p className="text-sm text-muted-foreground">{opp.title} — {opp.code}</p>
        </div>
      </div>

      {invitations.length === 0 ? (
        <EmptyState title="Nessuna offerta" description="Nessun fornitore ha ancora presentato un'offerta." />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
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
                  <TableHead className="text-center font-bold">Totale</TableHead>
                  {canEvaluate && <TableHead className="text-center">Azioni</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv: any) => {
                  const bid = inv.bids?.[0];
                  const bidId = bid?.id;
                  const bidStatus = bid?.status ?? "no_bid";
                  const hasBid = !!bid && bid.status !== "draft";
                  const total = bidId ? computeTotal(bidId) : 0;

                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="sticky left-0 bg-background font-medium">
                        {inv.suppliers?.company_name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={BID_STATUS_COLORS[bidStatus] ?? "bg-gray-100 text-gray-500"}>
                          {BID_STATUS_LABELS[bidStatus] ?? bidStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {hasBid ? `€ ${Number(bid.total_amount ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—"}
                      </TableCell>
                      <TableCell className="text-center">{hasBid ? bid.execution_days ?? "—" : "—"}</TableCell>
                      {criteria.map((c) => (
                        <TableCell key={c.name} className="text-center">
                          {hasBid && canEvaluate && bidId ? (
                            <Input
                              type="number"
                              min={0}
                              max={c.max_score}
                              className="w-16 mx-auto text-center h-8 text-sm"
                              value={scores[bidId]?.[c.name] ?? ""}
                              onChange={(e) => setScore(bidId, c.name, Math.min(c.max_score, Math.max(0, Number(e.target.value))))}
                            />
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold">
                        {hasBid && bidId ? total.toFixed(2) : "—"}
                      </TableCell>
                      {canEvaluate && (
                        <TableCell>
                          {hasBid && bidId ? (
                            <div className="flex items-center gap-1 justify-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Salva valutazione"
                                onClick={() => saveEvalMutation.mutate(bidId)}
                                disabled={saveEvalMutation.isPending}
                              >
                                <Save className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-emerald-600"
                                title="Ammetti"
                                onClick={() => statusMutation.mutate({ bidId, status: "admitted" })}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-amber-600"
                                title="Ammetti con riserva"
                                onClick={() => statusMutation.mutate({ bidId, status: "admitted_with_reserve" })}
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                title="Escludi"
                                onClick={() => setExcludeDialog({ bidId, supplierName: inv.suppliers?.company_name ?? "" })}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Exclude Dialog */}
      <Dialog open={!!excludeDialog} onOpenChange={() => { setExcludeDialog(null); setExcludeReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escludi offerta — {excludeDialog?.supplierName}</DialogTitle>
          </DialogHeader>
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
              disabled={!excludeReason.trim() || statusMutation.isPending}
              onClick={() => {
                if (excludeDialog) {
                  statusMutation.mutate({ bidId: excludeDialog.bidId, status: "excluded", reason: excludeReason });
                }
              }}
            >
              Conferma esclusione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
