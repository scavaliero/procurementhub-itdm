import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Save, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "La password deve avere almeno 8 caratteri")
      .regex(/[A-Z]/, "Deve contenere almeno una lettera maiuscola")
      .regex(/[0-9]/, "Deve contenere almeno un numero")
      .regex(/[^A-Za-z0-9]/, "Deve contenere almeno un carattere speciale"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Le password non coincidono",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password aggiornata con successo");
      form.reset();
    },
    onError: (err: Error) => {
      toast.error("Errore: " + err.message);
    },
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <Breadcrumb items={[{ label: "Cambia Password" }]} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5" />
            Cambia Password
          </CardTitle>
          <CardDescription>Inserisci la nuova password per il tuo account</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-5">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nuova password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conferma password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <p className="text-xs text-muted-foreground">
                La password deve contenere almeno 8 caratteri, una lettera maiuscola, un numero e un carattere speciale.
              </p>

              <div className="pt-2">
                <Button type="submit" disabled={!form.formState.isDirty || mutation.isPending}>
                  {mutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <Save className="h-4 w-4 mr-1.5" />
                  )}
                  Aggiorna password
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
