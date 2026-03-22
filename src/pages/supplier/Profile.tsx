import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { User, Phone, Save, Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Il nome deve avere almeno 2 caratteri").max(100, "Max 100 caratteri"),
  phone: z.string().trim().max(20, "Max 20 caratteri").optional().or(z.literal("")),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function SupplierProfile() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      full_name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: ProfileForm) => {
      if (!user) throw new Error("Utente non autenticato");
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: values.full_name, phone: values.phone || null })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profilo aggiornato con successo");
    },
    onError: (err: Error) => toast.error("Errore: " + err.message),
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <Breadcrumb items={[{ label: "Il mio profilo" }]} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" />
            Il mio profilo
          </CardTitle>
          <CardDescription>Modifica le tue informazioni personali</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <Input value={profile?.email ?? ""} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">L'email non può essere modificata</p>
              </div>
              <Separator />
              <FormField control={form.control} name="full_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome completo</FormLabel>
                  <FormControl><Input placeholder="Mario Rossi" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />Telefono</FormLabel>
                  <FormControl><Input placeholder="+39 333 1234567" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="pt-2">
                <Button type="submit" disabled={!form.formState.isDirty || mutation.isPending}>
                  {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                  Salva modifiche
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
