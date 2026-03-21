import { useQuery } from "@tanstack/react-query";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useNavigate } from "react-router-dom";
import { orderService } from "@/services/orderService";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { format } from "date-fns";

const STATUS_LABELS: Record<string, string> = {
  draft: "Bozza",
  pending_approval: "In approvazione",
  issued: "Emesso",
  accepted: "Accettato",
  rejected: "Rifiutato",
  in_progress: "In corso",
  completed: "Completato",
  cancelled: "Annullato",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_approval: "bg-amber-100 text-amber-700",
  issued: "bg-blue-100 text-blue-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  in_progress: "bg-purple-100 text-purple-700",
  completed: "bg-teal-100 text-teal-700",
};

export default function InternalOrders() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["internal-orders"],
    queryFn: () => orderService.list(profile?.tenant_id ?? ""),
    enabled: !!profile,
  });

  if (isLoading) {
    return <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Ordini</h1>

      {orders.length === 0 ? (
        <EmptyState title="Nessun ordine" description="Non ci sono ordini registrati." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Oggetto</TableHead>
                  <TableHead>Fornitore</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Importo (€)</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o: any) => (
                  <TableRow
                    key={o.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={async () => {
                      try {
                        const { contractService } = await import("@/services/contractService");
                        const contract = await contractService.getByOrderId(o.id);
                        if (contract) {
                          navigate(`/internal/contracts/${contract.id}`);
                        }
                      } catch {
                        // No contract yet
                      }
                    }}
                  >
                    <TableCell className="font-mono text-sm">{o.code ?? "—"}</TableCell>
                    <TableCell className="font-medium">{o.subject}</TableCell>
                    <TableCell>{o.suppliers?.company_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_COLORS[o.status] ?? ""}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      € {Number(o.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.created_at ? format(new Date(o.created_at), "dd/MM/yyyy") : "—"}
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
