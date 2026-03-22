import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGrants } from "@/hooks/useGrants";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarIcon, Search, Filter, Eye, RotateCcw, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { exportService } from "@/services/exportService";
import { toast } from "sonner";

const EVENT_LABELS: Record<string, string> = {
  login: "Login",
  logout: "Logout",
  opportunity_created: "Opportunità creata",
  opportunity_status_changed: "Stato opportunità",
  invitations_sent: "Inviti inviati",
  opportunity_awarded: "Opportunità aggiudicata",
  bid_status_changed: "Stato offerta",
  evaluation_saved: "Valutazione salvata",
  order_created: "Ordine creato",
  order_approved: "Ordine approvato",
  order_accepted: "Ordine accettato",
  billing_submitted: "Benestare inviato",
  billing_approved: "Benestare approvato",
  billing_deleted: "Benestare eliminato",
  billing_rejected: "Benestare respinto",
  status_change: "Cambio stato",
  document_approved: "Documento approvato",
  document_rejected: "Documento respinto",
  role_assigned: "Ruolo assegnato",
  role_removed: "Ruolo rimosso",
  grant_assigned: "Permesso assegnato",
  grant_removed: "Permesso rimosso",
  user_activated: "Utente attivato",
  user_deactivated: "Utente disattivato",
  invite_resent: "Invito reinviato",
  profile_updated: "Profilo modificato",
};

const ENTITY_LABELS: Record<string, string> = {
  auth: "Autenticazione",
  opportunity: "Opportunità",
  order: "Ordine",
  supplier: "Fornitore",
  suppliers: "Fornitore",
  billing_approval: "Benestare",
  bid: "Offerta",
  bid_evaluation: "Valutazione",
  award: "Aggiudicazione",
  uploaded_documents: "Documento",
  user: "Utente",
  user_roles: "Ruoli utente",
  role_grants: "Permessi ruolo",
  profile: "Profilo",
};

const ENTITY_COLORS: Record<string, string> = {
  auth: "bg-sky-100 text-sky-700",
  opportunity: "bg-blue-100 text-blue-700",
  order: "bg-emerald-100 text-emerald-700",
  supplier: "bg-amber-100 text-amber-700",
  suppliers: "bg-amber-100 text-amber-700",
  billing_approval: "bg-purple-100 text-purple-700",
  bid: "bg-cyan-100 text-cyan-700",
  bid_evaluation: "bg-cyan-100 text-cyan-700",
  award: "bg-green-100 text-green-700",
  uploaded_documents: "bg-orange-100 text-orange-700",
  user: "bg-rose-100 text-rose-700",
  user_roles: "bg-rose-100 text-rose-700",
  profile: "bg-indigo-100 text-indigo-700",
  role_grants: "bg-indigo-100 text-indigo-700",
};

interface AuditLog {
  id: string;
  created_at: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  user_email: string | null;
  user_id: string | null;
  user_role: string | null;
  old_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
}

const PAGE_SIZE = 50;

export default function AuditLogs() {
  const { profile } = useAuth();
  const { hasGrant } = useGrants();
  const canView = hasGrant("view_audit_logs");

  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [page, setPage] = useState(0);
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", search, entityFilter, eventFilter, dateFrom, dateTo, page],
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (search.trim()) {
        q = q.or(`user_email.ilike.%${search.trim()}%,event_type.ilike.%${search.trim()}%,entity_type.ilike.%${search.trim()}%`);
      }
      if (entityFilter !== "all") q = q.eq("entity_type", entityFilter);
      if (eventFilter !== "all") q = q.eq("event_type", eventFilter);
      if (dateFrom) q = q.gte("created_at", format(dateFrom, "yyyy-MM-dd"));
      if (dateTo) q = q.lte("created_at", format(dateTo, "yyyy-MM-dd") + "T23:59:59");

      const { data, error, count } = await q;
      if (error) throw error;
      return { logs: data as AuditLog[], total: count ?? 0 };
    },
    enabled: canView && !!profile,
  });

  const { data: filterOptions } = useQuery({
    queryKey: ["audit-filter-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("entity_type, event_type");
      if (error) throw error;
      const entities = [...new Set(data.map((d) => d.entity_type))].sort();
      const events = [...new Set(data.map((d) => d.event_type))].sort();
      return { entities, events };
    },
    enabled: canView && !!profile,
    staleTime: 5 * 60 * 1000,
  });

  function resetFilters() {
    setSearch("");
    setEntityFilter("all");
    setEventFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setPage(0);
  }

  async function handleExport() {
    setExporting(true);
    try {
      let q = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5000);

      if (search.trim()) {
        q = q.or(`user_email.ilike.%${search.trim()}%,event_type.ilike.%${search.trim()}%,entity_type.ilike.%${search.trim()}%`);
      }
      if (entityFilter !== "all") q = q.eq("entity_type", entityFilter);
      if (eventFilter !== "all") q = q.eq("event_type", eventFilter);
      if (dateFrom) q = q.gte("created_at", format(dateFrom, "yyyy-MM-dd"));
      if (dateTo) q = q.lte("created_at", format(dateTo, "yyyy-MM-dd") + "T23:59:59");

      const { data: logs, error } = await q;
      if (error) throw error;
      if (!logs?.length) { toast.info("Nessun evento da esportare"); return; }

      const csv = exportService.generateCsv(logs as Record<string, unknown>[], [
        { key: "created_at", header: "Data/Ora", formatter: (v) => v ? format(new Date(v as string), "dd/MM/yyyy HH:mm:ss") : "" },
        { key: "user_email", header: "Utente", formatter: (v) => String(v ?? "Sistema") },
        { key: "entity_type", header: "Entità", formatter: (v) => ENTITY_LABELS[v as string] ?? String(v ?? "") },
        { key: "event_type", header: "Evento", formatter: (v) => EVENT_LABELS[v as string] ?? String(v ?? "") },
        { key: "entity_id", header: "ID Entità", formatter: (v) => String(v ?? "") },
        { key: "old_state", header: "Stato precedente", formatter: (v) => v ? JSON.stringify(v) : "" },
        { key: "new_state", header: "Stato nuovo", formatter: (v) => v ? JSON.stringify(v) : "" },
      ]);

      exportService.downloadCsv(csv, `audit-log-${format(new Date(), "yyyy-MM-dd")}.csv`);
      toast.success(`${logs.length} eventi esportati`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Errore durante l'esportazione");
    } finally {
      setExporting(false);
    }
  }

  if (!canView) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Non hai i permessi per visualizzare i log di audit.</p>
      </div>
    );
  }

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/internal/dashboard" },
          { label: "Audit Log" },
        ]}
      />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Audit Log</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {data?.total ?? 0} eventi registrati
          </span>
          <Button variant="outline" size="sm" disabled={exporting} onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            {exporting ? "Esportazione..." : "Esporta CSV"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per email, evento, entità..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                />
              </div>
            </div>

            <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Entità" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le entità</SelectItem>
                {filterOptions?.entities.filter(e => e !== "__test__").map((e) => (
                  <SelectItem key={e} value={e}>{ENTITY_LABELS[e] ?? e}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={eventFilter} onValueChange={(v) => { setEventFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Evento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli eventi</SelectItem>
                {filterOptions?.events.filter(e => e !== "__verify__").map((e) => (
                  <SelectItem key={e} value={e}>{EVENT_LABELS[e] ?? e}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[130px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "dd/MM/yy") : "Da"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setPage(0); }} locale={it} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[130px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, "dd/MM/yy") : "A"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setPage(0); }} locale={it} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>

            <Button variant="ghost" size="icon" onClick={resetFilters} title="Azzera filtri">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !data?.logs.length ? (
            <div className="p-8 text-center text-muted-foreground">
              Nessun evento trovato con i filtri selezionati.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data/Ora</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Utente</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Entità</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Evento</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Dettaglio</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {log.created_at ? format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: it }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{log.user_email || "Sistema"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className={cn("text-xs", ENTITY_COLORS[log.entity_type] ?? "bg-gray-100 text-gray-700")}>
                          {ENTITY_LABELS[log.entity_type] ?? log.entity_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {EVENT_LABELS[log.event_type] ?? log.event_type}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailLog(log)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Pagina {page + 1} di {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Precedente
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              Successiva
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailLog} onOpenChange={(open) => !open && setDetailLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dettaglio evento</DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground block">Data/Ora</span>
                  <span className="font-medium">
                    {detailLog.created_at ? format(new Date(detailLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: it }) : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Utente</span>
                  <span className="font-medium">{detailLog.user_email || "Sistema"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Entità</span>
                  <Badge variant="secondary" className={cn("text-xs", ENTITY_COLORS[detailLog.entity_type])}>
                    {ENTITY_LABELS[detailLog.entity_type] ?? detailLog.entity_type}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground block">Evento</span>
                  <span className="font-medium">{EVENT_LABELS[detailLog.event_type] ?? detailLog.event_type}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block">ID Entità</span>
                  <span className="font-mono text-xs break-all">{detailLog.entity_id || "—"}</span>
                </div>
              </div>

              {detailLog.old_state && Object.keys(detailLog.old_state).length > 0 && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground block mb-1">Stato precedente</span>
                  <ScrollArea className="max-h-32">
                    <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto">
                      {JSON.stringify(detailLog.old_state, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}

              {detailLog.new_state && Object.keys(detailLog.new_state).length > 0 && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground block mb-1">Stato nuovo</span>
                  <ScrollArea className="max-h-32">
                    <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto">
                      {JSON.stringify(detailLog.new_state, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}