import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Mail, KeyRound } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Email di recupero inviata");
    } catch (err: any) {
      toast.error(err.message || "Errore nell'invio dell'email");
    } finally {
      setLoading(false);
    }
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
          <div className="px-6 pt-8 pb-2 text-center">
            <div className="mx-auto w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <KeyRound className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Recupera password</h1>
            <p className="text-sm text-muted-foreground mt-1">Ti invieremo un link per reimpostarla</p>
          </div>
          <CardContent className="px-6 pb-8 pt-4">
            {sent ? (
              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Abbiamo inviato un link di recupero a <strong>{email}</strong>.
                  Controlla la tua casella di posta.
                </p>
                <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
                  Invia di nuovo
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      className="pl-9"
                      placeholder="nome@azienda.it"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Invio…" : "Invia link di recupero"}
                </Button>
              </form>
            )}
            <div className="mt-5 text-center">
              <Link to="/login" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Torna al login
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="py-4 text-center text-xs text-muted-foreground border-t">
        © {new Date().getFullYear()} ITDM Group | Procurement Hub — Tutti i diritti riservati
      </footer>
    </div>
  );
}
