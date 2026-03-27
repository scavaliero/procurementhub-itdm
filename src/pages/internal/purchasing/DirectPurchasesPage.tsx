import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useGrants } from "@/hooks/useGrants";
import { useDirectPurchases } from "@/hooks/usePurchasing";
import { directPurchaseService } from "@/services/directPurchaseService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrency, formatDateIT } from "@/utils/formatters";
import { Plus, Search, Download, FileText, AlertTriangle, ShoppingBag, DollarSign } from "lucide-react";
import { toast } from "sonner";
import type { DirectPurchase } from "@/types/purchasing";

export default function DirectPurchasesPage() {
  const navigate = useNavigate();
  const { hasGrant } = useGrants();
  const [search, setSearch] = useState("");
  

  const { data: purchases = [], isLoading } = useDirectPurchases({ search: search || undefined });

  const handleDownloadInvoice = async (e: React.MouseEvent, dp: DirectPurchase) => {
    e.stopPropagation();
    if (!dp.invoice_storage_path) return;
    try {
      const url = await directPurchaseService.getInvoiceSignedUrl(dp.invoice_storage_path);
      window.open(url, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Errore nel download della fattura");
    }
  };

  const kpi = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let countMonth = 0;
    let totalMonth = 0;
    let noInvoice = 0;

    for (const dp of purchases as DirectPurchase[]) {
      const created = dp.created_at ? new Date(dp.created_at) : null;
      if (created && created >= startOfMonth) {
        countMonth++;
        totalMonth += Number(dp.amount);
      }
      if (!dp.invoice_storage_path) noInvoice++;
    }
    return { countMonth, totalMonth, noInvoice };
  }, [purchases]);

  if (!hasGrant("manage_purchase_operations") && !hasGrant("validate_purchase_request_high")) {
    return <EmptyState title="Accesso negato" description="Non hai i permessi per visualizzare questa pagina." />;
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const kpiCards = [
    { key: "month", label: "Acquisti nel mese", value: kpi.countMonth, icon: ShoppingBag, color: "text-blue-600", bg: "bg-blue-100" },
    { key: "total", label: "Totale mese", value: formatCurrency(kpi.totalMonth), icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-100", isText: true },
    { key: "noinv", label: "Senza fattura", value: kpi.noInvoice, icon: AlertTriangle, color: kpi.noInvoice > 0 ? "text-orange-600" : "text-gray-400", bg: kpi.noInvoice > 0 ? "bg-orange-100" : "bg-gray-100" },
  ];

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/internal/dashboard" },
          { label: "Acquisti Diretti" },
        ]}
      />
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
          <span className="text-base">💳</span> Acquisti Diretti
        </h2>
        {hasGrant("manage_purchase_operations") && (
          <Button onClick={() => navigate("/internal/purchasing/direct/new")}>
            <Plus className="h-4 w-4 mr-1" /> Registra acquisto
          </Button>
        )}
      </div>

      {/* KPI */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.key} className="shadow-sm">
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

      {kpi.noInvoice > 0 && (
        <Alert className="border-orange-300 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-sm text-orange-800">
            {kpi.noInvoice} acquist{kpi.noInvoice === 1 ? "o" : "i"} senza fattura allegata.
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca fornitore, oggetto, codice…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {(purchases as DirectPurchase[]).length === 0 ? (
        <EmptyState title="Nessun acquisto" description="Non ci sono acquisti diretti registrati." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Fornitore</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Importo</TableHead>
                  <TableHead>Oggetto</TableHead>
                  <TableHead>Fattura</TableHead>
                  <TableHead>Richiesta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(purchases as DirectPurchase[]).map((dp) => (
                  <TableRow key={dp.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/internal/purchasing/direct/${dp.id}`)}>
                    <TableCell className="font-mono text-sm">{dp.code ?? "—"}</TableCell>
                    <TableCell className="font-medium">{dp.supplier_name}</TableCell>
                    <TableCell className="text-sm">{formatDateIT(dp.purchase_date)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(dp.amount)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{dp.subject}</TableCell>
                    <TableCell>
                      {dp.invoice_storage_path ? (
                        <Button variant="ghost" size="sm" onClick={(e) => handleDownloadInvoice(e, dp)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {dp.purchase_request_id ? (
                        <Button variant="link" size="sm" className="p-0 h-auto"
                          onClick={() => navigate(`/internal/purchasing/requests/${dp.purchase_request_id}`)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono">{selected.code ?? "Acquisto"}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted-foreground">Fornitore</p>
                    <p className="font-medium">{selected.supplier_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Importo</p>
                    <p className="font-bold text-lg">{formatCurrency(selected.amount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Data acquisto</p>
                    <p>{formatDateIT(selected.purchase_date)}</p>
                  </div>
                  {selected.supplier_vat && (
                    <div>
                      <p className="text-muted-foreground">P.IVA</p>
                      <p className="font-mono">{selected.supplier_vat}</p>
                    </div>
                  )}
                  {selected.supplier_email && (
                    <div>
                      <p className="text-muted-foreground">Email fornitore</p>
                      <p>{selected.supplier_email}</p>
                    </div>
                  )}
                  {selected.supplier_address && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Indirizzo</p>
                      <p>{selected.supplier_address}</p>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground">Oggetto</p>
                  <p className="font-medium">{selected.subject}</p>
                </div>
                {selected.description && (
                  <div>
                    <p className="text-muted-foreground">Descrizione</p>
                    <p>{selected.description}</p>
                  </div>
                )}
                {selected.notes && (
                  <div>
                    <p className="text-muted-foreground">Note</p>
                    <p>{selected.notes}</p>
                  </div>
                )}
                {(selected.invoice_number || selected.invoice_date) && (
                  <div className="grid grid-cols-2 gap-4">
                    {selected.invoice_number && (
                      <div>
                        <p className="text-muted-foreground">Nr. Fattura</p>
                        <p className="font-mono">{selected.invoice_number}</p>
                      </div>
                    )}
                    {selected.invoice_date && (
                      <div>
                        <p className="text-muted-foreground">Data fattura</p>
                        <p>{formatDateIT(selected.invoice_date)}</p>
                      </div>
                    )}
                  </div>
                )}
                {selected.invoice_storage_path && (
                  <Button variant="outline" className="w-full" onClick={(e) => handleDownloadInvoice(e, selected)}>
                    <Download className="h-4 w-4 mr-1" /> Scarica fattura
                  </Button>
                )}
                {selected.purchase_request_id && (
                  <Button variant="link" className="w-full" onClick={() => {
                    setSelected(null);
                    navigate(`/internal/purchasing/requests/${selected.purchase_request_id}`);
                  }}>
                    <FileText className="h-4 w-4 mr-1" /> Vai alla richiesta collegata
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
