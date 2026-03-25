import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { billingApprovalService } from "@/services/billingApprovalService";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/EmptyState";
import { BillingAttachments } from "@/components/billing/BillingAttachments";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowLeft, FileText, ShoppingCart } from "lucide-react";

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

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}

export default function SupplierBillingApprovalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const { data: billing, isLoading } = useQuery({
    queryKey: ["supplier-billing-detail", id],
    queryFn: () => billingApprovalService.getById(id!),
    enabled: !!id && !!profile?.supplier_id,
  });

  const { data: residualData } = useQuery({
    queryKey: ["contract-residual", billing?.contract_id],
    queryFn: () => billingApprovalService.getResidual(billing!.contract_id),
    enabled: !!billing?.contract_id,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!billing) {
    return (
      <div className="p-6">
        <EmptyState title="Benestare non trovato" description="Il benestare richiesto non esiste o non è accessibile." />
        <Button variant="outline" className="mt-4" onClick={() => navigate("/supplier/billing-approvals")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Torna alla lista
        </Button>
      </div>
    );
  }

  const residualAmount = Number(residualData?.residual_amount ?? 0);

  return (
    <div className="p-4 sm:p-6 space-y-6 min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/supplier/billing-approvals")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold truncate">{billing.code || "Benestare"}</h1>
            <Badge variant="secondary" className={STATUS_COLORS[billing.status] ?? "bg-gray-100 text-gray-700"}>
              {STATUS_LABELS[billing.status] ?? billing.status}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dati benestare */}
        <Card className="card-top-billing">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Dati benestare
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Codice" value={billing.code || "—"} />
            <InfoRow
              label="Periodo"
              value={
                billing.period_start && billing.period_end
                  ? `${format(new Date(billing.period_start), "dd/MM/yyyy")} – ${format(new Date(billing.period_end), "dd/MM/yyyy")}`
                  : "—"
              }
            />
            <InfoRow
              label="Importo"
              value={`€ ${Number(billing.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`}
              bold
            />
            <InfoRow label="Descrizione attività" value={billing.activity_description || "—"} />
            <InfoRow
              label="Creato il"
              value={billing.created_at ? format(new Date(billing.created_at), "dd/MM/yyyy HH:mm", { locale: it }) : "—"}
            />
            {billing.approved_at && (
              <InfoRow
                label="Approvato il"
                value={format(new Date(billing.approved_at), "dd/MM/yyyy HH:mm", { locale: it })}
              />
            )}
          </CardContent>
        </Card>

        {/* Ordine di riferimento */}
        <Card className="card-top-billing">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Ordine di riferimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {billing.orders ? (
              <>
                <InfoRow label="Codice ordine" value={billing.orders.code ?? "—"} />
                <InfoRow label="Oggetto" value={billing.orders.subject ?? "—"} />
                <InfoRow
                  label="Importo ordine"
                  value={`€ ${Number(billing.orders.amount ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`}
                  bold
                />
                {residualData && (
                  <>
                    <Separator />
                    <InfoRow
                      label="Fatturato approvato"
                      value={`€ ${Number(residualData.approved_billing_total ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`}
                    />
                    <InfoRow
                      label="Residuo disponibile"
                      value={`€ ${residualAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`}
                      bold
                    />
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Ordine non disponibile</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Allegati (sola lettura) */}
      <BillingAttachments billingId={id!} billingStatus={billing.status} readOnly />
    </div>
  );
}
