import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { orderService } from "@/services/orderService";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";

const STATUS_LABELS: Record<string, string> = {
  draft: "Bozza",
  pending_approval: "In approvazione",
  issued: "Emesso",
  accepted: "Accettato",
  rejected: "Rifiutato",
  in_progress: "In corso",
  completed: "Completato",
};

const STATUS_COLORS: Record<string, string> = {
  issued: "bg-blue-100 text-blue-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  in_progress: "bg-purple-100 text-purple-700",
  completed: "bg-teal-100 text-teal-700",
  pending_approval: "bg-amber-100 text-amber-700",
};

export default function SupplierOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const { data: order, isLoading } = useQuery({
    queryKey: ["supplier-order-detail", id],
    queryFn: async () => {
      const orders = await orderService.listForSupplier(profile?.supplier_id ?? "");
      return orders.find((o) => o.id === id) ?? null;
    },
    enabled: !!id && !!profile?.supplier_id,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!order) {
    return <EmptyState title="Ordine non trovato" description="L'ordine richiesto non esiste o non hai accesso." />;
  }

  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(v);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/supplier/orders")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{order.subject}</h1>
          <p className="text-sm text-muted-foreground font-mono">{order.code ?? "—"}</p>
        </div>
        <Badge variant="secondary" className={STATUS_COLORS[order.status] ?? ""}>
          {STATUS_LABELS[order.status] ?? order.status}
        </Badge>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dettagli ordine</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Importo</p>
              <p className="text-xl font-bold">{fmtCurrency(Number(order.amount))}</p>
            </div>
            {order.description && (
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Descrizione</p>
                <p className="text-sm">{order.description}</p>
              </div>
            )}
            {order.contract_conditions && (
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Condizioni contrattuali</p>
                <p className="text-sm whitespace-pre-wrap">{order.contract_conditions}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Date e scadenze</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.start_date && (
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Data inizio</p>
                <p className="text-sm">{format(new Date(order.start_date), "dd/MM/yyyy")}</p>
              </div>
            )}
            {order.end_date && (
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Data fine</p>
                <p className="text-sm">{format(new Date(order.end_date), "dd/MM/yyyy")}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Creato il</p>
              <p className="text-sm">
                {order.created_at ? format(new Date(order.created_at), "dd/MM/yyyy HH:mm") : "—"}
              </p>
            </div>
            {order.supplier_accepted_at && (
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Accettato il</p>
                <p className="text-sm">{format(new Date(order.supplier_accepted_at), "dd/MM/yyyy HH:mm")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
