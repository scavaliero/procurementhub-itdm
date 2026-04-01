import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { invitationService } from "@/services/invitationService";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ChevronRight, Search, Eye, EyeOff, Briefcase, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import SupplierOpportunityDetail from "@/components/supplier/OpportunityDetail";

const OPP_STATUS_LABELS: Record<string, string> = {
  draft: "Bozza",
  pending_approval: "In approvazione",
  open: "Aperta",
  collecting_bids: "Raccolta offerte",
  evaluating: "In valutazione",
  awarded: "Aggiudicata",
  closed: "Chiusa",
  cancelled: "Annullata",
};

const OPP_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_approval: "bg-amber-100 text-amber-700",
  open: "bg-emerald-100 text-emerald-700",
  collecting_bids: "bg-blue-100 text-blue-700",
  evaluating: "bg-purple-100 text-purple-700",
  awarded: "bg-green-100 text-green-800",
  closed: "bg-gray-200 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
};

export default function SupplierOpportunities() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);
  const [selectedInvitation, setSelectedInvitation] = useState<any>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const statusFilter = searchParams.get("status") || "all";
  const searchQuery = searchParams.get("q") || "";

  const updateParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v && v !== "all") next.set(k, v);
      else next.delete(k);
    });
    setSearchParams(next, { replace: true });
  };

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ["supplier-invitations", profile?.supplier_id],
    queryFn: () => invitationService.listForSupplier(profile!.supplier_id!),
    enabled: !!profile?.supplier_id,
  });

  const markViewedMutation = useMutation({
    mutationFn: (invId: string) => invitationService.markViewed(invId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplier-invitations"] }),
  });

  const [declineTarget, setDeclineTarget] = useState<string | null>(null);

  const declineMutation = useMutation({
    mutationFn: (invId: string) => invitationService.declineInvitation(invId),
    onSuccess: () => {
      toast.success("Opportunità rifiutata e rimossa dall'elenco");
      qc.invalidateQueries({ queryKey: ["supplier-invitations"] });
      setDeclineTarget(null);
    },
    onError: () => toast.error("Errore nel rifiuto"),
  });

  // KPI counts
  const kpiCounts = useMemo(() => {
    let total = 0, unseen = 0, open = 0, evaluating = 0;
    for (const inv of invitations as any[]) {
      total++;
      if (!inv.viewed_at) unseen++;
      const status = inv.opportunities?.status;
      if (status === "open" || status === "collecting_bids") open++;
      if (status === "evaluating") evaluating++;
    }
    return { total, unseen, open, evaluating };
  }, [invitations]);

  // Filtered list
  const filteredInvitations = useMemo(() => {
    return (invitations as any[]).filter((inv) => {
      const opp = inv.opportunities;
      // KPI card filters
      if (statusFilter === "unseen" && inv.viewed_at) return false;
      if (statusFilter === "open" && opp?.status !== "open" && opp?.status !== "collecting_bids") return false;
      if (statusFilter === "evaluating" && opp?.status !== "evaluating") return false;
      // Dropdown status filters (exact match)
      if (statusFilter === "collecting_bids" && opp?.status !== "collecting_bids") return false;
      if (statusFilter === "awarded" && opp?.status !== "awarded") return false;
      if (statusFilter === "closed" && opp?.status !== "closed") return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const haystack = `${opp?.code ?? ""} ${opp?.title ?? ""} ${opp?.categories?.name ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [invitations, statusFilter, searchQuery]);

  const handleClick = (inv: any) => {
    if (!inv.viewed_at) {
      markViewedMutation.mutate(inv.id);
    }
    setSelectedOppId(inv.opportunities?.id ?? inv.opportunity_id);
    setSelectedInvitation(inv);
  };

  if (selectedOppId) {
    return (
      <SupplierOpportunityDetail
        opportunityId={selectedOppId}
        invitation={selectedInvitation}
        onBack={() => {
          setSelectedOppId(null);
          setSelectedInvitation(null);
          qc.invalidateQueries({ queryKey: ["supplier-invitations"] });
        }}
      />
    );
  }

  const kpiCards = [
    { key: "all", label: "Totale", value: kpiCounts.total, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-100" },
    { key: "unseen", label: "Da visualizzare", value: kpiCounts.unseen, icon: EyeOff, color: "text-amber-600", bg: "bg-amber-100", alert: true },
    { key: "open", label: "Aperte", value: kpiCounts.open, icon: Eye, color: "text-emerald-600", bg: "bg-emerald-100" },
    { key: "evaluating", label: "In valutazione", value: kpiCounts.evaluating, icon: Clock, color: "text-purple-600", bg: "bg-purple-100" },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Opportunità</h1>
      <p className="text-muted-foreground">Gare a cui sei stato invitato.</p>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => {
          const isSelected = statusFilter === kpi.key || (statusFilter === "all" && kpi.key === "all");
          const Icon = kpi.icon;
          return (
            <Card
              key={kpi.key}
              className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${
                isSelected && kpi.key !== "all" ? "ring-2 ring-primary" : ""
              } ${kpi.alert && kpi.value > 0 ? "border-amber-400/40 bg-amber-50" : ""}`}
              onClick={() => updateParams({ status: kpi.key === "all" ? "all" : (statusFilter === kpi.key ? "all" : kpi.key) })}
              data-testid={`opp-kpi-${kpi.key}`}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {kpi.label}
                </CardTitle>
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${kpi.bg}`}>
                  <Icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">{kpi.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search & Status Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca codice, titolo…"
            value={searchQuery}
            onChange={(e) => updateParams({ q: e.target.value })}
            className="pl-9"
            data-testid="opp-search"
          />
        </div>
        <Select
          value={statusFilter === "all" ? "all" : statusFilter}
          onValueChange={(v) => updateParams({ status: v })}
        >
          <SelectTrigger className="w-full sm:w-[200px]" data-testid="opp-status-filter">
            <SelectValue placeholder="Tutti gli stati" />
          </SelectTrigger>
          <SelectContent position="popper" side="bottom" sideOffset={4} avoidCollisions={false}>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            <SelectItem value="open">Aperta</SelectItem>
            <SelectItem value="collecting_bids">Raccolta offerte</SelectItem>
            <SelectItem value="evaluating">In valutazione</SelectItem>
            <SelectItem value="awarded">Aggiudicata</SelectItem>
            <SelectItem value="closed">Chiusa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : filteredInvitations.length === 0 ? (
        <EmptyState title="Nessuna opportunità" description="Non ci sono opportunità che corrispondono ai filtri." />
      ) : (
        <div className="space-y-3">
          {filteredInvitations.map((inv: any) => {
            const opp = inv.opportunities;
            return (
              <Card
                key={inv.id}
                className={`cursor-pointer transition-shadow hover:shadow-md card-top-opportunities ${!inv.viewed_at ? "border-l-4 border-l-primary" : ""}`}
                onClick={() => handleClick(inv)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{opp?.code ?? "—"}</span>
                      <Badge variant="secondary" className={OPP_STATUS_COLORS[opp?.status] ?? ""}>
                        {OPP_STATUS_LABELS[opp?.status] ?? opp?.status ?? "—"}
                      </Badge>
                    </div>
                    <p className="font-medium truncate">{opp?.title ?? "—"}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Categoria: {opp?.categories?.name ?? "—"}</span>
                      {opp?.bids_deadline && (
                        <span>Scadenza: {format(new Date(opp.bids_deadline), "dd/MM/yyyy HH:mm")}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
