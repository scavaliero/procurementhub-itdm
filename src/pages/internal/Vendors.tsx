import { useQuery } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";
import type { Supplier } from "@/types";

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pre_registered: { label: "Pre-registrato", variant: "outline" },
  pending_review: { label: "In revisione", variant: "secondary" },
  accredited: { label: "Accreditato", variant: "default" },
  suspended: { label: "Sospeso", variant: "destructive" },
  rejected: { label: "Rifiutato", variant: "destructive" },
  blacklisted: { label: "Blacklist", variant: "destructive" },
};

export default function InternalVendors() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => vendorService.listSuppliers(),
    enabled: !!profile,
  });

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Albo Fornitori</h1>

      {suppliers.length === 0 ? (
        <EmptyState
          title="Nessun fornitore"
          description="I fornitori registrati appariranno qui."
        />
      ) : (
        <div className="space-y-2">
          {suppliers.map((s) => {
            const badge = statusBadge[s.status] || statusBadge.pre_registered;
            return (
              <Card
                key={s.id}
                className="cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => navigate(`/internal/vendors/${s.id}`)}
              >
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{s.company_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.company_type || "—"} ·{" "}
                        {s.created_at
                          ? new Date(s.created_at).toLocaleDateString("it-IT")
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
