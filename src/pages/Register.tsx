import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { registrationSchema, type RegistrationForm } from "@/lib/validations";
import { vendorService } from "@/services/vendorService";
import { categoryService } from "@/services/categoryService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

export default function RegisterPage() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { privacy: false as unknown as true },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoryService.list(),
  });

  const mutation = useMutation({
    mutationFn: (data: RegistrationForm) =>
      vendorService.registerSupplier({
        company_name: data.company_name,
        vat_number: data.vat_number,
        contact_name: data.contact_name,
        email: data.email,
        phone: data.phone || undefined,
        pec: data.pec || undefined,
        password: data.password,
        category_id: data.category_id || undefined,
      }),
    onSuccess: (result: any) => {
      if (result?.resent) {
        toast.success("Email di conferma re-inviata. Controlla la tua casella di posta.");
      } else {
        toast.success("Registrazione completata! Controlla la tua email per confermare l'account.");
      }
      navigate("/login");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Errore nella registrazione");
    },
  });

  const privacy = watch("privacy");

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
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-lg shadow-lg border-0 overflow-hidden">
          <div className="h-1.5 bg-primary" />
          <div className="px-6 pt-8 pb-2 text-center">
            <div className="mx-auto w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Registra la tua azienda</h1>
            <p className="text-sm text-muted-foreground mt-1">Compila i dati per accedere al portale fornitori</p>
          </div>
          <CardContent className="px-6 pb-8 pt-4">
            <form
              onSubmit={handleSubmit((data) => mutation.mutate(data))}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="company_name">Ragione sociale *</Label>
                  <Input id="company_name" {...register("company_name")} />
                  {errors.company_name && (
                    <p className="text-xs text-destructive">{errors.company_name.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vat_number">Partita IVA *</Label>
                  <Input id="vat_number" maxLength={11} {...register("vat_number")} />
                  {errors.vat_number && (
                    <p className="text-xs text-destructive">{errors.vat_number.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fiscal_code">Codice Fiscale</Label>
                <Input id="fiscal_code" maxLength={16} {...register("fiscal_code")} />
                {errors.fiscal_code && (
                  <p className="text-xs text-destructive">{errors.fiscal_code.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="contact_name">Nome referente *</Label>
                  <Input id="contact_name" {...register("contact_name")} />
                  {errors.contact_name && (
                    <p className="text-xs text-destructive">{errors.contact_name.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Telefono</Label>
                  <Input id="phone" type="tel" {...register("phone")} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" {...register("email")} />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pec">PEC</Label>
                <Input id="pec" type="email" {...register("pec")} />
                {errors.pec && (
                  <p className="text-xs text-destructive">{errors.pec.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password * (min. 12 caratteri)</Label>
                <Input id="password" type="password" {...register("password")} />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              {categories.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Categoria merceologica</Label>
                  <Select onValueChange={(v) => setValue("category_id", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories
                        .filter((c) => c.is_active)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.code} — {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-start gap-2">
                <Checkbox
                  id="privacy"
                  checked={privacy === true}
                  onCheckedChange={(checked) =>
                    setValue("privacy", checked === true ? true : (false as unknown as true), {
                      shouldValidate: true,
                    })
                  }
                />
                <Label htmlFor="privacy" className="text-sm leading-tight">
                  Accetto l'informativa sulla privacy e i termini di servizio *
                </Label>
              </div>
              {errors.privacy && (
                <p className="text-xs text-destructive">{errors.privacy.message}</p>
              )}

              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                {mutation.isPending ? "Registrazione…" : "Registra Azienda"}
              </Button>
            </form>
            <p className="text-sm text-center text-muted-foreground mt-5">
              Hai già un account?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">Accedi</Link>
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
