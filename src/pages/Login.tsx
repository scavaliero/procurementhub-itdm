import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { authService } from "@/services/authService";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { LogIn, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { profile } = useAuth();

  const loginMutation = useMutation({
    mutationFn: () => authService.signIn(email, password),
    onSuccess: () => {
      toast.success("Accesso effettuato");
      navigate("/", { replace: true });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Credenziali non valide");
    },
  });

  if (profile) {
    const dest = profile.user_type === "supplier" ? "/supplier/dashboard" : "/internal/dashboard";
    navigate(dest, { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
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

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-sm shadow-lg border-0 overflow-hidden">
          <div className="h-1.5 bg-primary" />
          <div className="px-6 pt-8 pb-2 text-center">
            <div className="mx-auto w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Accedi al portale</h1>
            <p className="text-sm text-muted-foreground mt-1">Inserisci le tue credenziali per continuare</p>
          </div>
          <CardContent className="px-6 pb-8 pt-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                loginMutation.mutate();
              }}
              className="space-y-4"
            >
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
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    className="pl-9"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full gap-2" disabled={loginMutation.isPending}>
                <LogIn className="h-4 w-4" />
                {loginMutation.isPending ? "Accesso…" : "Accedi"}
              </Button>
            </form>
            <div className="text-center mt-4">
              <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-primary hover:underline transition-colors">
                Password dimenticata?
              </Link>
            </div>
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
              <div className="relative flex justify-center"><span className="bg-card px-3 text-xs text-muted-foreground">oppure</span></div>
            </div>
            <p className="text-sm text-center text-muted-foreground">
              Sei un fornitore?{" "}
              <Link to="/register" className="text-primary font-medium hover:underline">Registrati qui</Link>
            </p>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-muted-foreground border-t">
        © {new Date().getFullYear()} ITDM Group | Procurement Hub — Tutti i diritti riservati
      </footer>
    </div>
  );
}
