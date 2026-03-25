import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invitationService } from "@/services/invitationService";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ChevronRight } from "lucide-react";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import SupplierOpportunitySheet from "@/components/supplier/OpportunitySheet";
import SupplierBidSheet from "@/components/supplier/BidSheet";

const INV_STATUS: Record<string, string> = {
  sent: "Nuovo",
  viewed: "Visualizzato",
  accepted: "Accettato",
  declined: "Rifiutato",
};

const INV_COLORS: Record<string, string> = {
  sent: "bg-blue-100 text-blue-700",
  viewed: "bg-gray-100 text-gray-700",
  accepted: "bg-emerald-100 text-emerald-700",
  declined: "bg-red-100 text-red-700",
};

export default function SupplierOpportunities() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);
  const [bidOppId, setBidOppId] = useState<string | null>(null);
  const [bidInvitation, setBidInvitation] = useState<any>(null);

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ["supplier-invitations", profile?.supplier_id],
    queryFn: () => invitationService.listForSupplier(profile!.supplier_id!),
    enabled: !!profile?.supplier_id,
  });

  const markViewedMutation = useMutation({
    mutationFn: (invId: string) => invitationService.markViewed(invId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplier-invitations"] }),
  });

  const handleClick = (inv: any) => {
    if (!inv.viewed_at) {
      markViewedMutation.mutate(inv.id);
    }
    setSelectedOppId(inv.opportunities?.id ?? inv.opportunity_id);
    setBidInvitation(inv);
  };

  const openBidSheet = () => {
    if (selectedOppId) {
      setBidOppId(selectedOppId);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Opportunità</h1>
      <p className="text-muted-foreground">Gare a cui sei stato invitato.</p>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : invitations.length === 0 ? (
        <EmptyState title="Nessuna opportunità" description="Non sei stato ancora invitato a nessuna gara." />
      ) : (
        <div className="space-y-3">
          {invitations.map((inv: any) => {
            const opp = inv.opportunities;
            return (
              <Card
                key={inv.id}
                className={`cursor-pointer transition-shadow hover:shadow-md card-top-opportunities ${!inv.viewed_at ? "border-l-4 border-l-primary" : ""}`}
                onClick={() => handleClick(inv)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{opp?.code ?? "—"}</span>
                      <Badge variant="secondary" className={INV_COLORS[inv.status] ?? ""}>
                        {INV_STATUS[inv.status] ?? inv.status}
                      </Badge>
                    </div>
                    <p className="font-medium truncate">{opp?.title ?? "—"}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Categoria: {opp?.categories?.name ?? "—"}</span>
                      {opp?.bids_deadline && (
                        <span>Scadenza: {format(new Date(opp.bids_deadline), "dd/MM/yyyy HH:mm")}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Opportunity Detail Sheet */}
      <Sheet open={!!selectedOppId} onOpenChange={(open) => { if (!open) setSelectedOppId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {selectedOppId && (
            <SupplierOpportunitySheet
              opportunityId={selectedOppId}
              invitation={bidInvitation}
              onOpenBid={openBidSheet}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Bid Sheet */}
      <Sheet open={!!bidOppId} onOpenChange={(open) => { if (!open) setBidOppId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {bidOppId && (
            <SupplierBidSheet
              opportunityId={bidOppId}
              invitation={bidInvitation}
              onClose={() => {
                setBidOppId(null);
                qc.invalidateQueries({ queryKey: ["supplier-invitations"] });
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
