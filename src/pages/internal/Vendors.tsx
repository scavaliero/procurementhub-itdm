import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { vendorService } from "@/services/vendorService";
import { categoryService } from "@/services/categoryService";
import { exportService } from "@/services/exportService";
import { useAuth } from "@/hooks/useAuth";
import { useGrants } from "@/hooks/useGrants";
import { SUPPLIER_STATUS_CONFIG } from "@/lib/supplierStatusConfig";
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
import { Breadcrumb } from "@/components/Breadcrumb";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Search,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  Eye,
  Unlock,
  ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";

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
  const { hasGrant } = useGrants();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read filters from URL params
  const page = Number(searchParams.get("page") || "1");
  const statusFilter = searchParams.get("status") || "";
  const categoryFilter = searchParams.get("category") || "";
  const search = searchParams.get("q") || "";
  const dateFrom = searchParams.get("date_from") || "";
  const dateTo = searchParams.get("date_to") || "";

  const [searchInput, setSearchInput] = useState(search);

  // Sync URL params helper
  const updateParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v) next.set(k, v);
      else next.delete(k);
    });
    // Reset page on filter change unless explicitly setting page
    if (!("page" in updates)) next.set("page", "1");
    setSearchParams(next, { replace: true });
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) updateParams({ q: searchInput });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

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
      search,
      dateFrom,
      dateTo,
    ],
    queryFn: () =>
      vendorService.listSuppliersPaginated({
        page,
        pageSize: PAGE_SIZE,
        status: statusFilter || undefined,
        categoryId: categoryFilter || undefined,
        search: search || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    enabled: !!profile,
  });

  const suppliers = result?.data || [];
  const totalCount = result?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // CSV Export — exports ALL records matching active filters (no pagination)
  const handleExportCsv = async () => {
    try {
      const allData = await vendorService.listSuppliersForExport({
        status: statusFilter || undefined,
        categoryId: categoryFilter || undefined,
        search: search || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      const csv = exportService.generateCsv(allData as unknown as Record<string, unknown>[], [
        { key: "company_name", header: "Ragione Sociale" },
        { key: "status", header: "Stato", formatter: (v) => SUPPLIER_STATUS_CONFIG[v as string]?.label || String(v) },
        { key: "created_at", header: "Data Registrazione", formatter: (v) => v ? new Date(v as string).toLocaleDateString("it-IT") : "" },
      ]);
      exportService.downloadCsv(csv, `fornitori_${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(`${allData.length} fornitori esportati`);
    } catch {
      toast.error("Errore nell'esportazione");
    }
  };

  if (isLoading && countsLoading) return <PageSkeleton />;

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: "Dashboard", href: "/internal" }, { label: "Albo Fornitori" }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Albo Fornitori</h1>
        {hasGrant("export_data") && (
          <Button variant="outline" onClick={handleExportCsv} className="gap-2">
            <Download className="h-4 w-4" /> Esporta CSV
          </Button>
        )}
      </div>

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
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca ragione sociale…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) => updateParams({ status: v === "all" ? "" : v })}
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
          value={categoryFilter || "all"}
          onValueChange={(v) => updateParams({ category: v === "all" ? "" : v })}
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
        <div className="flex items-end gap-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Da</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => updateParams({ date_from: e.target.value })}
              className="w-[150px]"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">A</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => updateParams({ date_to: e.target.value })}
              className="w-[150px]"
            />
          </div>
        </div>
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
              onClick={() => updateParams({ page: String(page - 1) })}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => updateParams({ page: String(page + 1) })}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
