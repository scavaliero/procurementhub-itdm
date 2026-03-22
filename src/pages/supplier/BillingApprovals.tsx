import { useQuery } from "@tanstack/react-query";
import { billingApprovalService } from "@/services/billingApprovalService";
import { useAuth } from "@/hooks/useAuth";
import type { BillingApproval } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { format } from "date-fns";

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

  const { data: billings = [], isLoading } = useQuery({
    queryKey: ["supplier-billings"],
    queryFn: () => billingApprovalService.listForSupplier(profile?.supplier_id ?? ""),
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
            <Table className="min-w-[500px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead className="text-right">Importo (€)</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billings.map((b: BillingApproval) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-sm">{b.code ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {b.period_start && b.period_end
                        ? `${format(new Date(b.period_start), "dd/MM/yy")} – ${format(new Date(b.period_end), "dd/MM/yy")}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      € {Number(b.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-700"}>
                        {STATUS_LABELS[b.status] ?? b.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {b.created_at ? format(new Date(b.created_at), "dd/MM/yyyy") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
