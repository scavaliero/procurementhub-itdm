import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orderService } from "@/services/orderService";
import { contractService } from "@/services/contractService";
import { useAuth } from "@/hooks/useAuth";
import { useGrants } from "@/hooks/useGrants";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Building2,
  Calendar,
  FileText,
  MapPin,
  ExternalLink,
} from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

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
  draft: "bg-muted text-muted-foreground",
  pending_approval: "bg-amber-100 text-amber-700",
  issued: "bg-blue-100 text-blue-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  in_progress: "bg-purple-100 text-purple-700",
  completed: "bg-teal-100 text-teal-700",
  cancelled: "bg-gray-100 text-gray-500",
};

function fmtCurrency(v: number | null | undefined) {
  return `€ ${Number(v ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return format(new Date(d), "dd/MM/yyyy");
}

interface Milestone {
  date: string;
  description: string;
}

export default function InternalOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { hasGrant } = useGrants();
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => orderService.getById(id!),
    enabled: !!id,
  });

  const { data: contract } = useQuery({
    queryKey: ["contract-by-order", id],
    queryFn: async () => {
      try {
        return await contractService.getByOrderId(id!);
      } catch {
        return null;
      }
    },
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => orderService.approveOrder(id!, profile!.tenant_id, profile!.id),
    onSuccess: () => {
      toast.success("Ordine approvato e emesso");
      qc.invalidateQueries({ queryKey: ["order", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: () => orderService.rejectOrderByAdmin(id!, profile!.tenant_id),
    onSuccess: () => {
      toast.success("Ordine rifiutato");
      qc.invalidateQueries({ queryKey: ["order", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canManage = hasGrant("manage_orders");

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!order) {
    return <EmptyState title="Ordine non trovato" description="L'ordine richiesto non esiste." />;
  }

  const milestones = (order.milestones as unknown as Milestone[]) ?? [];

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/internal" },
          { label: "Ordini", href: "/internal/orders" },
          { label: order.code ?? order.subject },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold truncate">{order.subject}</h1>
            <Badge variant="secondary" className={STATUS_COLORS[order.status] ?? ""}>
              {STATUS_LABELS[order.status] ?? order.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            {order.code ?? "Codice non assegnato"}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold tabular-nums">{fmtCurrency(order.amount)}</p>
          <p className="text-xs text-muted-foreground">Importo ordine</p>
        </div>
      </div>

      {/* Admin actions */}
      {canManage && order.status === "pending_approval" && (
        <div className="flex gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50">
          <div className="flex-1">
            <p className="font-medium text-amber-800">Ordine in attesa di approvazione</p>
            <p className="text-sm text-amber-600">Approva per emetterlo o rifiuta per annullarlo.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              disabled={approveMutation.isPending || rejectMutation.isPending}
              onClick={() => approveMutation.mutate()}
            >
              <CheckCircle className="h-4 w-4 mr-1" /> Approva
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={approveMutation.isPending || rejectMutation.isPending}
              onClick={() => rejectMutation.mutate()}
            >
              <XCircle className="h-4 w-4 mr-1" /> Rifiuta
            </Button>
          </div>
        </div>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column — Order info */}
        <Card className="card-top-orders">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" /> Dettagli ordine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {order.description && (
                <div>
                  <dt className="text-muted-foreground">Descrizione</dt>
                  <dd className="mt-0.5">{order.description}</dd>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-muted-foreground">Data inizio</dt>
                  <dd className="font-medium">{fmtDate(order.start_date)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Data fine</dt>
                  <dd className="font-medium">{fmtDate(order.end_date)}</dd>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-muted-foreground">Creato il</dt>
                  <dd className="font-medium">{fmtDate(order.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Aggiornato il</dt>
                  <dd className="font-medium">{fmtDate(order.updated_at)}</dd>
                </div>
              </div>
              {order.supplier_accepted_at && (
                <div>
                  <dt className="text-muted-foreground">Accettato dal fornitore</dt>
                  <dd className="font-medium text-emerald-600">{fmtDate(order.supplier_accepted_at)}</dd>
                </div>
              )}
              {order.supplier_rejected_at && (
                <div>
                  <dt className="text-muted-foreground">Rifiutato dal fornitore</dt>
                  <dd className="font-medium text-red-600">{fmtDate(order.supplier_rejected_at)}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Right column — Supplier & links */}
        <div className="space-y-6">
          <Card className="card-top-orders">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Fornitore
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{order.suppliers?.company_name ?? "—"}</p>
              {order.suppliers?.id && (
                <Link
                  to={`/internal/vendors/${order.suppliers.id}`}
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1"
                >
                  Vedi scheda fornitore <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </CardContent>
          </Card>

          {order.opportunities && (
            <Card className="card-top-orders">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Opportunità collegata
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{order.opportunities.title}</p>
                <p className="text-xs text-muted-foreground font-mono">{order.opportunities.code}</p>
                <Link
                  to={`/internal/opportunities/${order.opportunities.id}`}
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1"
                >
                  Vedi opportunità <ExternalLink className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          )}

          {contract && (
            <Card className="card-top-orders">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Contratto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <Badge variant="secondary" className={contract.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}>
                      {contract.status === "active" ? "Attivo" : contract.status === "planned" ? "Pianificato" : contract.status}
                    </Badge>
                    <p className="text-sm mt-1">
                      {fmtDate(contract.start_date)} — {fmtDate(contract.end_date)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/internal/contracts/${contract.id}`}>
                      <Button variant="outline" size="sm">
                        Dettaglio <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Contract conditions */}
      {order.contract_conditions && (
        <Card className="card-top-orders">
          <CardHeader>
            <CardTitle className="text-sm">Condizioni contrattuali</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{order.contract_conditions}</p>
          </CardContent>
        </Card>
      )}

      {/* Milestones */}
      {milestones.length > 0 && (
        <Card className="card-top-orders">
          <CardHeader>
            <CardTitle className="text-sm">Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {milestones.map((m, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{m.description}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(m.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
