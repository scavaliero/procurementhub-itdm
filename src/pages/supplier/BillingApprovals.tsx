import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { billingApprovalService } from "@/services/billingApprovalService";
import { useAuth } from "@/hooks/useAuth";
import type { BillingApproval } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { format } from "date-fns";
import { ExternalLink } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  approved: "Approvato",
  invoiced: "Fatturato",
  closed: "Chiuso",
};

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  invoiced: "bg-blue-100 text-blue-700",
  closed: "bg-teal-100 text-teal-700",
};

export default function SupplierBillingApprovals() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data: billings = [], isLoading } = useQuery({
    queryKey: ["supplier-billings"],
    queryFn: () => billingApprovalService.listForSupplierWithOrder(profile?.supplier_id ?? ""),
    enabled: !!profile?.supplier_id,
  });

  if (isLoading) {
    return <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 min-w-0 overflow-hidden">
      <h1 className="text-2xl font-bold">Benestare di Fatturazione</h1>

      {billings.length === 0 ? (
        <EmptyState title="Nessun benestare" description="Non ci sono benestare visibili." />
      ) : (
        <Card className="card-top-billing">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Ordine</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead className="text-right">Importo (€)</TableHead>
                  <TableHead className="text-right">Residuo ordine (€)</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-center">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billings.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-sm">{b.code ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 h-auto text-xs"
                        onClick={() => navigate(`/supplier/orders`)}
                      >
                        {b.orders?.code ?? "—"}
                      </Button>
                    </TableCell>
                    <TableCell className="text-sm">
                      {b.period_start && b.period_end
                        ? `${format(new Date(b.period_start), "dd/MM/yy")} – ${format(new Date(b.period_end), "dd/MM/yy")}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      € {Number(b.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {b.residual_amount != null
                        ? `€ ${Number(b.residual_amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-700"}>
                        {STATUS_LABELS[b.status] ?? b.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {b.created_at ? format(new Date(b.created_at), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/supplier/billing-approvals/${b.id}`)}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Dettaglio
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
