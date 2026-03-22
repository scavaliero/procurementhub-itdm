import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle, KeyRound, Lock } from "lucide-react";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setHasSession(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setHasSession(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setHasSession(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 12) {
      toast.error("La password deve essere di almeno 12 caratteri");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Le password non coincidono");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      toast.success("Password aggiornata con successo");
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    } catch (err: any) {
      toast.error(err.message || "Errore nell'aggiornamento della password");
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (!hasSession) {
      return (
        <>
          <div className="px-6 pt-8 pb-2 text-center">
            <div className="mx-auto w-14 h-14 rounded-xl bg-destructive/10 flex items-center justify-center mb-4">
              <KeyRound className="h-7 w-7 text-destructive" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Link non valido</h1>
            <p className="text-sm text-muted-foreground mt-1">Il link di recupero è scaduto o non è valido</p>
          </div>
          <CardContent className="px-6 pb-8 pt-4 text-center">
            <Button className="w-full" onClick={() => navigate("/forgot-password")}>
              Richiedi nuovo link
            </Button>
          </CardContent>
        </>
      );
    }

    return (
      <>
        <div className="px-6 pt-8 pb-2 text-center">
          <div className="mx-auto w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <KeyRound className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Nuova password</h1>
          <p className="text-sm text-muted-foreground mt-1">Imposta la tua nuova password</p>
        </div>
        <CardContent className="px-6 pb-8 pt-4">
          {success ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-accent" />
              </div>
              <p className="text-sm text-muted-foreground">
                Password aggiornata. Reindirizzamento al login…
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nuova password (min. 12 caratteri)</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    className="pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={12}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Conferma password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    className="pl-9"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={12}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Aggiornamento…" : "Aggiorna password"}
              </Button>
            </form>
          )}
        </CardContent>
      </>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">ITDM</span>
            <span className="text-xs font-medium opacity-80">GROUP</span>
            <span className="ml-1 border-l border-primary-foreground/30 pl-2 text-sm font-semibold">
              Procurement Hub
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-sm shadow-lg border-0 overflow-hidden">
          <div className="h-1.5 bg-primary" />
          {renderContent()}
        </Card>
      </main>

      <footer className="py-4 text-center text-xs text-muted-foreground border-t">
        © {new Date().getFullYear()} ITDM Group | Procurement Hub — Tutti i diritti riservati
      </footer>
    </div>
  );
}
