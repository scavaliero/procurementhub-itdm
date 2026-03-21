import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { useRealtimeNotifications } from "@/hooks/useRealtime";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { PageSkeleton } from "@/components/PageSkeleton";
import { AlertCircle, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function SupplierRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, isLoading } = useAuth();
  const location = useLocation();

  useRealtimeNotifications();
  const { SessionTimeoutModal } = useSessionTimeout();

  const { data: supplier, isLoading: supLoading } = useQuery({
    queryKey: ["my-supplier"],
    queryFn: () => vendorService.getMySupplier(),
    enabled: !!profile && profile.user_type === "supplier",
  });

  if (isLoading || supLoading) return <PageSkeleton />;
  if (!user) return <Navigate to="/login" replace />;
  if (profile && profile.user_type !== "supplier") {
    return <Navigate to="/internal/dashboard" replace />;
  }

  // Allow access to onboarding and documents pages even when blocked
  const allowedPaths = ["/supplier/onboarding", "/supplier/documents"];
  const isAllowedPath = allowedPaths.some((p) => location.pathname.startsWith(p));

  // Block access if supplier status is "pending" (reverted due to expired docs)
  if (supplier && supplier.status === "pending" && !isAllowedPath) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-6 space-y-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold">Accesso sospeso</h2>
            <p className="text-muted-foreground text-sm">
              Il tuo accesso al portale è stato sospeso perché uno o più documenti
              obbligatori sono scaduti. Aggiorna i documenti scaduti per ripristinare
              l'accesso.
            </p>
            <Badge variant="destructive" className="text-sm">
              Stato: In attesa di rinnovo documenti
            </Badge>
            <div className="pt-2">
              <Button asChild>
                <a href="/supplier/documents">
                  <FileText className="h-4 w-4 mr-2" />
                  Vai ai Documenti
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
        <SessionTimeoutModal />
      </div>
    );
  }

  return (
    <>
      {children}
      <SessionTimeoutModal />
    </>
  );
}
