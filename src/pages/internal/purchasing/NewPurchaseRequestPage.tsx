import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useSaveDraft, useSubmitRequest, usePurchaseRequest } from "@/hooks/usePurchasing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Send } from "lucide-react";

const schema = z.object({
  subject: z.string().trim().min(5, "Minimo 5 caratteri").max(200, "Massimo 200 caratteri"),
  description: z.string().trim().max(2000, "Massimo 2000 caratteri").optional().or(z.literal("")),
  justification: z.string().trim().min(10, "Motivazione: minimo 10 caratteri"),
  amount: z.coerce.number().gt(0, "L'importo deve essere maggiore di 0"),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  needed_by: z.string().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

export default function NewPurchaseRequestPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const draftId = searchParams.get("draft") || undefined;

  const [showConfirm, setShowConfirm] = useState(false);

  const { data: existingDraft, isLoading: draftLoading } = usePurchaseRequest(draftId);
  const saveDraft = useSaveDraft();
  const submitRequest = useSubmitRequest();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      subject: "",
      description: "",
      justification: "",
      amount: 0,
      priority: "normal",
      needed_by: "",
    },
  });

  // Populate form from existing draft
  useEffect(() => {
    if (existingDraft && draftId) {
      form.reset({
        subject: existingDraft.subject,
        description: existingDraft.description ?? "",
        justification: existingDraft.justification,
        amount: Number(existingDraft.amount),
        priority: existingDraft.priority,
        needed_by: existingDraft.needed_by ?? "",
      });
    }
  }, [existingDraft, draftId, form]);

  const handleSaveDraft = async (values: FormValues) => {
    const result = await saveDraft.mutateAsync({
      id: draftId,
      subject: values.subject,
      description: values.description || undefined,
      justification: values.justification,
      amount: values.amount,
      priority: values.priority,
      needed_by: values.needed_by || undefined,
    });
    // Update URL with draft ID after first save
    if (!draftId && result?.id) {
      setSearchParams({ draft: result.id }, { replace: true });
    }
  };

  const handleSubmit = async () => {
    const values = form.getValues();
    const valid = await form.trigger();
    if (!valid) return;

    let id = draftId;
    if (!id) {
      const result = await saveDraft.mutateAsync({
        subject: values.subject,
        description: values.description || undefined,
        justification: values.justification,
        amount: values.amount,
        priority: values.priority,
        needed_by: values.needed_by || undefined,
      });
      id = result?.id;
    } else {
      // Save latest changes before submitting
      await saveDraft.mutateAsync({
        id,
        subject: values.subject,
        description: values.description || undefined,
        justification: values.justification,
        amount: values.amount,
        priority: values.priority,
        needed_by: values.needed_by || undefined,
      });
    }

    if (id) {
      await submitRequest.mutateAsync(id);
      navigate("/internal/purchasing/requests");
    }
    setShowConfirm(false);
  };

  if (draftId && draftLoading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const isPending = saveDraft.isPending || submitRequest.isPending;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/internal" },
          { label: "Richieste di Acquisto", href: "/internal/purchasing/requests" },
          { label: draftId ? "Modifica bozza" : "Nuova richiesta" },
        ]}
      />

      <h2 className="text-sm font-bold uppercase tracking-wider">
        {draftId ? "Modifica Richiesta di Acquisto" : "Nuova Richiesta di Acquisto"}
      </h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dettagli richiesta</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSaveDraft)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Oggetto *</FormLabel>
                    <FormControl>
                      <Input placeholder="Oggetto della richiesta" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="justification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivazione *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Perché è necessario questo acquisto?"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrizione</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Dettagli aggiuntivi (facoltativo)"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Importo (EUR) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0,00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priorità *</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Bassa</SelectItem>
                          <SelectItem value="normal">Normale</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="urgent">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="needed_by"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data necessaria entro</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  variant="outline"
                  disabled={isPending}
                >
                  <Save className="h-4 w-4 mr-1" /> Salva bozza
                </Button>
                <Button
                  type="button"
                  disabled={isPending}
                  onClick={() => setShowConfirm(true)}
                >
                  <Send className="h-4 w-4 mr-1" /> Invia richiesta
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Confirm dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma invio</DialogTitle>
            <DialogDescription>
              Una volta inviata, la richiesta non potrà più essere modificata.
              Vuoi procedere?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Annulla
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              Conferma invio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
