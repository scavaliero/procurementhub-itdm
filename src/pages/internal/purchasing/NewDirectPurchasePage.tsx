import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Breadcrumb } from "@/components/Breadcrumb";
import { usePurchaseRequest, useCreateDirectPurchase } from "@/hooks/usePurchasing";
import { directPurchaseService } from "@/services/directPurchaseService";
import { purchaseRequestService } from "@/services/purchaseRequestService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, FileUp, Info } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const schema = z.object({
  supplier_name: z.string().trim().min(2, "Minimo 2 caratteri"),
  supplier_vat: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^IT[0-9]{11}$/.test(v), "Formato P.IVA: IT + 11 cifre"),
  supplier_email: z.string().trim().email("Email non valida").optional().or(z.literal("")),
  supplier_address: z.string().trim().optional().or(z.literal("")),
  purchase_date: z.string().min(1, "Data obbligatoria"),
  amount: z.coerce.number().gt(0, "L'importo deve essere maggiore di 0"),
  subject: z.string().trim().min(2, "Minimo 2 caratteri").max(200, "Massimo 200 caratteri"),
  description: z.string().trim().optional().or(z.literal("")),
  invoice_number: z.string().trim().optional().or(z.literal("")),
  invoice_date: z.string().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export default function NewDirectPurchasePage() {
  const navigate = useNavigate();
  const { reqId } = useParams<{ reqId: string }>();
  const fileRef = useRef<HTMLInputElement>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: linkedRequest, isLoading: reqLoading } = usePurchaseRequest(reqId);
  const createMut = useCreateDirectPurchase();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      supplier_name: "",
      supplier_vat: "",
      supplier_email: "",
      supplier_address: "",
      purchase_date: format(new Date(), "yyyy-MM-dd"),
      amount: 0,
      subject: "",
      description: "",
      invoice_number: "",
      invoice_date: "",
      notes: "",
    },
  });

  // Pre-fill from linked request
  useEffect(() => {
    if (linkedRequest && reqId) {
      form.setValue("subject", linkedRequest.subject);
      form.setValue("amount", Number(linkedRequest.amount));
    }
  }, [linkedRequest, reqId, form]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Formato file non supportato. Usa PDF, JPG o PNG.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File troppo grande. Massimo 20 MB.");
      return;
    }
    setInvoiceFile(file);
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const dp = await createMut.mutateAsync({
        purchase_request_id: reqId || undefined,
        supplier_name: values.supplier_name,
        supplier_vat: values.supplier_vat || undefined,
        supplier_email: values.supplier_email || undefined,
        supplier_address: values.supplier_address || undefined,
        purchase_date: values.purchase_date,
        amount: values.amount,
        subject: values.subject,
        description: values.description || undefined,
        invoice_number: values.invoice_number || undefined,
        invoice_date: values.invoice_date || undefined,
        notes: values.notes || undefined,
      });

      if (invoiceFile && dp?.id) {
        await directPurchaseService.uploadInvoice(dp.id, invoiceFile);
      }

      if (reqId) {
        await purchaseRequestService.completeWithDirectPurchase(reqId);
      }

      toast.success("Acquisto diretto registrato");
      navigate("/internal/purchasing/direct");
    } catch (err: any) {
      toast.error(err.message || "Errore durante il salvataggio");
    } finally {
      setSubmitting(false);
    }
  };

  if (reqId && reqLoading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/internal" },
          { label: "Acquisti Diretti", href: "/internal/purchasing/direct" },
          { label: "Nuovo acquisto" },
        ]}
      />

      <h2 className="text-sm font-bold uppercase tracking-wider">
        Registra Acquisto Diretto
      </h2>

      {linkedRequest && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Collegato alla richiesta <strong>{linkedRequest.code ?? linkedRequest.id}</strong>: {linkedRequest.subject}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dati acquisto</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Supplier info */}
              <FormField control={form.control} name="supplier_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fornitore *</FormLabel>
                  <FormControl><Input placeholder="Ragione sociale" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="supplier_vat" render={({ field }) => (
                  <FormItem>
                    <FormLabel>P.IVA</FormLabel>
                    <FormControl><Input placeholder="IT12345678901" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="supplier_email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" placeholder="fornitore@email.it" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="supplier_address" render={({ field }) => (
                <FormItem>
                  <FormLabel>Indirizzo</FormLabel>
                  <FormControl><Input placeholder="Via, CAP, Città" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Purchase details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="purchase_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data acquisto *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Importo (EUR) *</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="subject" render={({ field }) => (
                <FormItem>
                  <FormLabel>Oggetto *</FormLabel>
                  <FormControl><Input placeholder="Oggetto dell'acquisto" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrizione</FormLabel>
                  <FormControl><Textarea placeholder="Dettagli aggiuntivi" rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Invoice */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="invoice_number" render={({ field }) => (
                  <FormItem>
                    <FormLabel>N. Fattura</FormLabel>
                    <FormControl><Input placeholder="FT-2026-001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="invoice_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data fattura</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div>
                <FormLabel>Fattura (PDF/JPG/PNG, max 20MB)</FormLabel>
                <div className="mt-1">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                    <FileUp className="h-4 w-4 mr-1" /> {invoiceFile ? invoiceFile.name : "Seleziona file"}
                  </Button>
                </div>
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Note</FormLabel>
                  <FormControl><Textarea placeholder="Note aggiuntive" rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="pt-4">
                <Button type="submit" disabled={submitting || createMut.isPending}>
                  <Save className="h-4 w-4 mr-1" /> Salva acquisto
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
