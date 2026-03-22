import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useNavigate } from "react-router-dom";
import { orderService } from "@/services/orderService";
import { useAuth } from "@/hooks/useAuth";
import { useGrants } from "@/hooks/useGrants";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle, XCircle } from "lucide-react";

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
  const { hasGrant } = useGrants();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["internal-orders"],
    queryFn: () => orderService.list(profile?.tenant_id ?? ""),
    enabled: !!profile,
  });

  const approveMutation = useMutation({
    mutationFn: (orderId: string) => orderService.approveOrder(orderId, profile!.tenant_id, profile!.id),
    onSuccess: () => {
      toast.success("Ordine approvato e emesso");
      qc.invalidateQueries({ queryKey: ["internal-orders"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: (orderId: string) => orderService.rejectOrderByAdmin(orderId, profile!.tenant_id),
    onSuccess: () => {
      toast.success("Ordine rifiutato");
      qc.invalidateQueries({ queryKey: ["internal-orders"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canManage = hasGrant("manage_orders");

  if (isLoading) {
    return <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: "Dashboard", href: "/internal" }, { label: "Ordini" }]} />
      <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 section-accent-bar-green">
        <span className="text-base">🛒</span>
        Ordini
      </h2>

      {orders.length === 0 ? (
        <EmptyState title="Nessun ordine" description="Non ci sono ordini registrati." />
      ) : (
        <Card className="card-top-orders">
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
                  {canManage && <TableHead className="text-center">Azioni</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o: any) => (
                  <TableRow
                    key={o.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/internal/orders/${o.id}`)}
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
                    {canManage && (
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        {o.status === "pending_approval" ? (
                          <div className="flex gap-1 justify-center">
                            <Button
                              size="sm"
                              variant="default"
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                              onClick={() => approveMutation.mutate(o.id)}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approva
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                              onClick={() => rejectMutation.mutate(o.id)}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Rifiuta
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
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
