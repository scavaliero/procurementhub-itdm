import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { opportunityService, type OpportunityFilters } from "@/services/opportunityService";
import { categoryService } from "@/services/categoryService";
import { exportService } from "@/services/exportService";
import { useGrants } from "@/hooks/useGrants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Plus, Search, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

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
  const [searchParams, setSearchParams] = useSearchParams();

  // Read from URL
  const pageParam = Number(searchParams.get("page") || "0");
  const statusParam = searchParams.get("status") || "";
  const categoryParam = searchParams.get("category") || "";
  const searchParam = searchParams.get("q") || "";
  const refIdParam = searchParams.get("ref_id") || "";

  const [searchInput, setSearchInput] = useState(searchParam);

  const updateParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v) next.set(k, v);
      else next.delete(k);
    });
    if (!("page" in updates)) next.set("page", "0");
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== searchParam) updateParams({ q: searchInput });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filters: OpportunityFilters = {
    page: pageParam,
    pageSize: 25,
    status: statusParam || undefined,
    category_id: categoryParam || undefined,
    search: searchParam || undefined,
    internal_ref_id: refIdParam || undefined,
  };

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

  const { data: internalProfiles = [] } = useQuery({
    queryKey: ["internal-profiles"],
    queryFn: () => opportunityService.getInternalProfiles(),
  });

  const opps = result?.data ?? [];
  const totalCount = result?.count ?? 0;
  const totalPages = Math.ceil(totalCount / 25);

  const handleExportCsv = async () => {
    try {
      // Fetch ALL records matching active filters (no pagination limit)
      const all = await opportunityService.list({
        status: statusParam || undefined,
        category_id: categoryParam || undefined,
        internal_ref_id: refIdParam || undefined,
        search: searchParam || undefined,
        pageSize: 10000,
        page: 0,
      });
      const csv = exportService.generateCsv(all.data as unknown as Record<string, unknown>[], [
        { key: "code", header: "Codice" },
        { key: "title", header: "Titolo" },
        { key: "status", header: "Stato", formatter: (v) => STATUS_LABELS[v as string] || String(v) },
        { key: "bids_deadline", header: "Scadenza Offerte", formatter: (v) => v ? format(new Date(v as string), "dd/MM/yyyy HH:mm") : "" },
      ]);
      exportService.downloadCsv(csv, `opportunita_${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(`${all.data.length} opportunità esportate`);
    } catch {
      toast.error("Errore nell'esportazione");
    }
  };

  const metricCards = [
    { label: "Bozza", key: "draft", color: "border-gray-300" },
    { label: "Aperte", key: "open", color: "border-emerald-400" },
    { label: "In valutazione", key: "evaluating", color: "border-purple-400" },
    { label: "Aggiudicate", key: "awarded", color: "border-green-500" },
  ];

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: "Dashboard", href: "/internal" }, { label: "Opportunità" }]} />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 section-accent-bar-green">
          <span className="text-base">📋</span>
          Opportunità
        </h2>
        <div className="flex gap-2">
          {hasGrant("export_data") && (
            <Button variant="outline" onClick={handleExportCsv} className="gap-2">
              <Download className="h-4 w-4" /> Esporta CSV
            </Button>
          )}
          {hasGrant("create_opportunity") && (
            <Button onClick={() => navigate("/internal/opportunities/new")}>
              <Plus className="h-4 w-4 mr-2" /> Nuova Opportunità
            </Button>
          )}
        </div>
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
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Select
          value={statusParam || "all"}
          onValueChange={(v) => updateParams({ status: v === "all" ? "" : v })}
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
          value={categoryParam || "all"}
          onValueChange={(v) => updateParams({ category: v === "all" ? "" : v })}
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
        <Select
          value={refIdParam || "all"}
          onValueChange={(v) => updateParams({ ref_id: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Referente interno" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i referenti</SelectItem>
            {internalProfiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
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
                disabled={pageParam === 0}
                onClick={() => updateParams({ page: String(pageParam - 1) })}
              >
                Precedente
              </Button>
              <span className="text-sm text-muted-foreground">
                Pag. {pageParam + 1} di {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pageParam >= totalPages - 1}
                onClick={() => updateParams({ page: String(pageParam + 1) })}
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
