import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function PostLoginRedirect() {
  const { user, profile, isLoading, signOut } = useAuth();

  if (isLoading) return <PageSkeleton />;
  if (!user) return <Navigate to="/login" replace />;

  // Profile not found — account may be incomplete or RLS is blocking
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 space-y-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold">Profilo non trovato</h2>
            <p className="text-sm text-muted-foreground">
              Il tuo account è stato creato ma il profilo non è ancora disponibile.
              Prova a effettuare il login oppure contatta l'amministratore.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                await signOut();
                window.location.href = "/login";
              }}
            >
              Torna al Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return profile.user_type === "supplier"
    ? <Navigate to="/supplier/dashboard" replace />
    : <Navigate to="/internal/dashboard" replace />;
}
