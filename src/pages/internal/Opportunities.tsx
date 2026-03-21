import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { opportunityService, type OpportunityFilters } from "@/services/opportunityService";
import { categoryService } from "@/services/categoryService";
import { useGrants } from "@/hooks/useGrants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Plus, Search, FileText } from "lucide-react";
import { format } from "date-fns";

const STATUS_LABELS: Record<string, string> = {
  draft: "Bozza",
  pending_approval: "In approvazione",
  open: "Aperta",
  collecting_bids: "Raccolta offerte",
  evaluating: "In valutazione",
  awarded: "Aggiudicata",
  closed: "Chiusa",
  cancelled: "Annullata",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_approval: "bg-amber-100 text-amber-700",
  open: "bg-emerald-100 text-emerald-700",
  collecting_bids: "bg-blue-100 text-blue-700",
  evaluating: "bg-purple-100 text-purple-700",
  awarded: "bg-green-100 text-green-800",
  closed: "bg-gray-200 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
};

export default function InternalOpportunities() {
  const navigate = useNavigate();
  const { hasGrant } = useGrants();
  const [filters, setFilters] = useState<OpportunityFilters>({ page: 0, pageSize: 25 });

  const { data: result, isLoading } = useQuery({
    queryKey: ["opportunities", filters],
    queryFn: () => opportunityService.list(filters),
  });

  const { data: statusCounts } = useQuery({
    queryKey: ["opportunities-counts"],
    queryFn: () => opportunityService.getStatusCounts(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoryService.list(),
  });

  const opps = result?.data ?? [];
  const totalCount = result?.count ?? 0;
  const totalPages = Math.ceil(totalCount / (filters.pageSize ?? 25));

  const metricCards = [
    { label: "Bozza", key: "draft", color: "border-gray-300" },
    { label: "Aperte", key: "open", color: "border-emerald-400" },
    { label: "In valutazione", key: "evaluating", color: "border-purple-400" },
    { label: "Aggiudicate", key: "awarded", color: "border-green-500" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Opportunità</h1>
        {hasGrant("create_opportunity") && (
          <Button onClick={() => navigate("/internal/opportunities/new")}>
            <Plus className="h-4 w-4 mr-2" /> Nuova Opportunità
          </Button>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metricCards.map((m) => (
          <Card key={m.key} className={`border-l-4 ${m.color}`}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{m.label}</p>
              <p className="text-2xl font-bold">{statusCounts?.[m.key] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per titolo..."
            className="pl-9"
            value={filters.search ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 0 }))}
          />
        </div>
        <Select
          value={filters.status ?? "all"}
          onValueChange={(v) => setFilters((f) => ({ ...f, status: v === "all" ? undefined : v, page: 0 }))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.category_id ?? "all"}
          onValueChange={(v) => setFilters((f) => ({ ...f, category_id: v === "all" ? undefined : v, page: 0 }))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le categorie</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : opps.length === 0 ? (
        <EmptyState title="Nessuna opportunità" description="Non ci sono opportunità con i filtri selezionati." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Codice</TableHead>
                <TableHead>Titolo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Scadenza offerte</TableHead>
                <TableHead className="text-center">Inviti</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opps.map((o) => (
                <TableRow
                  key={o.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/internal/opportunities/${o.id}`)}
                >
                  <TableCell className="font-mono text-sm">{o.code ?? "—"}</TableCell>
                  <TableCell className="font-medium max-w-[300px] truncate">{o.title}</TableCell>
                  <TableCell>{o.categories?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={STATUS_COLORS[o.status] ?? ""}>
                      {STATUS_LABELS[o.status] ?? o.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {o.bids_deadline ? format(new Date(o.bids_deadline), "dd/MM/yyyy HH:mm") : "—"}
                  </TableCell>
                  <TableCell className="text-center">{o.opportunity_invitations?.length ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={(filters.page ?? 0) === 0}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 0) - 1 }))}
              >
                Precedente
              </Button>
              <span className="text-sm text-muted-foreground">
                Pag. {(filters.page ?? 0) + 1} di {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={(filters.page ?? 0) >= totalPages - 1}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 0) + 1 }))}
              >
                Successiva
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
