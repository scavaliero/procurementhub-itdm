import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace("#", "?"));

    const error = params.get("error");
    const errorDescription = params.get("error_description");

    if (error) {
      setStatus("error");
      if (errorDescription?.includes("expired") || errorDescription?.includes("invalid")) {
        setErrorMessage(
          "Il link di conferma è scaduto o non è più valido. Richiedi un nuovo invio dalla pagina di registrazione."
        );
      } else {
        setErrorMessage(errorDescription || "Errore durante la conferma dell'account.");
      }
      return;
    }

    // If no error, check if we have a session (successful confirmation)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setStatus("success");
        setTimeout(() => navigate("/", { replace: true }), 1500);
      } else {
        // No error but no session — might be email confirmation without auto-login
        setStatus("success");
        setTimeout(() => navigate("/login", { replace: true }), 2000);
      }
    };

    checkSession();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6 space-y-4 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Verifica in corso…</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold">Email confermata!</h2>
              <p className="text-sm text-muted-foreground">
                Stai per essere reindirizzato…
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <h2 className="text-lg font-semibold">Conferma non riuscita</h2>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={() => navigate("/register")}>
                  Torna alla registrazione
                </Button>
                <Button variant="outline" onClick={() => navigate("/login")}>
                  Vai al Login
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}