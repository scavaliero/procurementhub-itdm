import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { categoryService } from "@/services/categoryService";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Search,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pre_registered: { label: "Pre-registrato", variant: "outline" },
  enabled: { label: "Abilitato", variant: "secondary" },
  in_accreditation: { label: "In accreditamento", variant: "secondary" },
  in_approval: { label: "In approvazione", variant: "secondary" },
  pending_review: { label: "In revisione", variant: "secondary" },
  accredited: { label: "Accreditato", variant: "default" },
  suspended: { label: "Sospeso", variant: "destructive" },
  rejected: { label: "Rifiutato", variant: "destructive" },
  revoked: { label: "Revocato", variant: "destructive" },
  blacklisted: { label: "Blacklist", variant: "destructive" },
};

const PAGE_SIZE = 25;

function MetricCard({
  label,
  count,
  icon: Icon,
  color,
}: {
  label: string;
  count: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 flex items-center gap-3">
        <div className={`rounded-lg p-2.5 ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{count}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InternalVendors() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

  // Debounce search
  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
    // Simple debounce via timeout
    clearTimeout((window as any).__vendorSearchTimer);
    (window as any).__vendorSearchTimer = setTimeout(
      () => setSearchDebounced(val),
      300
    );
  };

  const { data: statusCounts = {}, isLoading: countsLoading } = useQuery({
    queryKey: ["supplier-status-counts"],
    queryFn: () => vendorService.getStatusCounts(),
    enabled: !!profile,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoryService.list(),
  });

  const {
    data: result,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: [
      "suppliers-paginated",
      page,
      statusFilter,
      categoryFilter,
      searchDebounced,
    ],
    queryFn: () =>
      vendorService.listSuppliersPaginated({
        page,
        pageSize: PAGE_SIZE,
        status: statusFilter || undefined,
        categoryId: categoryFilter || undefined,
        search: searchDebounced || undefined,
      }),
    enabled: !!profile,
  });

  const suppliers = result?.data || [];
  const totalCount = result?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (isLoading && countsLoading) return <PageSkeleton />;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Albo Fornitori</h1>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Pre-registrati"
          count={statusCounts["pre_registered"] || 0}
          icon={Clock}
          color="bg-slate-500"
        />
        <MetricCard
          label="In approvazione"
          count={
            (statusCounts["in_accreditation"] || 0) +
            (statusCounts["in_approval"] || 0)
          }
          icon={Users}
          color="bg-amber-500"
        />
        <MetricCard
          label="Accreditati"
          count={statusCounts["accredited"] || 0}
          icon={CheckCircle2}
          color="bg-emerald-600"
        />
        <MetricCard
          label="Sospesi"
          count={statusCounts["suspended"] || 0}
          icon={AlertTriangle}
          color="bg-red-500"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca ragione sociale…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tutti gli stati" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>
                {cfg.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={categoryFilter}
          onValueChange={(v) => {
            setCategoryFilter(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tutte le categorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le categorie</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {suppliers.length === 0 && !isFetching ? (
        <EmptyState
          title="Nessun fornitore trovato"
          description="Prova a modificare i filtri di ricerca."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ragione Sociale</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Registrato il</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => {
                  const cfg =
                    STATUS_CONFIG[s.status] || STATUS_CONFIG.pre_registered;
                  return (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/internal/vendors/${s.id}`)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          {s.company_name}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {s.vat_number_hash
                          ? `${s.vat_number_hash.slice(0, 8)}…`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {s.created_at
                          ? new Date(s.created_at).toLocaleDateString("it-IT")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {totalCount} fornitor{totalCount === 1 ? "e" : "i"} · Pagina{" "}
            {page}/{totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
