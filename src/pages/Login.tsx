import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { authService } from "@/services/authService";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

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

  // If already logged in, redirect
  if (profile) {
    const dest = profile.user_type === "supplier" ? "/supplier/dashboard" : "/internal/dashboard";
    navigate(dest, { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">VendorHub</CardTitle>
          <CardDescription>Accedi al tuo account</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loginMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Accesso…" : "Accedi"}
            </Button>
          </form>
          <div className="text-center mt-3">
            <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-primary hover:underline">
              Password dimenticata?
            </Link>
          </div>
          <p className="text-sm text-center text-muted-foreground mt-2">
            Non hai un account?{" "}
            <Link to="/register" className="text-primary hover:underline">Registrati</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
