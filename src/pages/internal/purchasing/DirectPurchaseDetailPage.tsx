import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useDirectPurchase, useUpdateDirectPurchase, useDeleteDirectPurchase } from "@/hooks/usePurchasing";
import { directPurchaseService } from "@/services/directPurchaseService";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, FileUp, Download, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDateIT } from "@/utils/formatters";

const schema = z.object({
  supplier_name: z.string().trim().min(2, "Minimo 2 caratteri"),
  supplier_vat: z.string().trim().optional().or(z.literal(""))
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

export default function DirectPurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);

  const { data: dp, isLoading, error } = useDirectPurchase(id);
  const updateMut = useUpdateDirectPurchase();
  const deleteMut = useDeleteDirectPurchase();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      supplier_name: "", supplier_vat: "", supplier_email: "", supplier_address: "",
      purchase_date: "", amount: 0, subject: "", description: "",
      invoice_number: "", invoice_date: "", notes: "",
    },
  });

  useEffect(() => {
    if (dp) {
      form.reset({
        supplier_name: dp.supplier_name,
        supplier_vat: dp.supplier_vat ?? "",
        supplier_email: dp.supplier_email ?? "",
        supplier_address: dp.supplier_address ?? "",
        purchase_date: dp.purchase_date,
        amount: Number(dp.amount),
        subject: dp.subject,
        description: dp.description ?? "",
        invoice_number: dp.invoice_number ?? "",
        invoice_date: dp.invoice_date ?? "",
        notes: dp.notes ?? "",
      });
    }
  }, [dp, form]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Formato non supportato. Usa PDF, JPG o PNG.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File troppo grande. Massimo 20 MB.");
      return;
    }
    setUploading(true);
    try {
      await directPurchaseService.uploadInvoice(id, file);
      qc.invalidateQueries({ queryKey: ["direct-purchase", id] });
      qc.invalidateQueries({ queryKey: ["direct-purchases"] });
      toast.success("Fattura caricata");
    } catch (err: any) {
      toast.error(err.message || "Errore upload fattura");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!dp?.invoice_storage_path) return;
    try {
      const url = await directPurchaseService.getInvoiceSignedUrl(dp.invoice_storage_path);
      window.open(url, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Errore download");
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (!id) return;
    await updateMut.mutateAsync({ id, data: values });
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!id) return;
    await deleteMut.mutateAsync(id);
    navigate("/internal/purchasing/direct");
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !dp) {
    return <EmptyState title="Non trovato" description="Acquisto diretto non trovato." />;
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/internal/dashboard" },
          { label: "Acquisti Diretti", href: "/internal/purchasing/direct" },
          { label: dp.code ?? "Dettaglio" },
        ]}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/internal/purchasing/direct")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{dp.code ?? "Acquisto Diretto"}</h1>
            <p className="text-sm text-muted-foreground">{dp.subject}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              Modifica
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminare questo acquisto?</AlertDialogTitle>
                <AlertDialogDescription>
                  L'acquisto <strong>{dp.code}</strong> verrà eliminato. L'operazione non è reversibile.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Elimina
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Invoice section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fattura</CardTitle>
        </CardHeader>
        <CardContent>
          {dp.invoice_storage_path ? (
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="gap-1">
                <FileText className="h-3 w-3" />
                {dp.invoice_filename ?? "Fattura allegata"}
              </Badge>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" /> Scarica
              </Button>
              <div className="border-l pl-3 ml-2">
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} className="hidden" />
                <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <FileUp className="h-4 w-4 mr-1" /> Sostituisci
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Nessuna fattura allegata</span>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} className="hidden" />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <FileUp className="h-4 w-4 mr-1" /> {uploading ? "Caricamento…" : "Carica fattura"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail / Edit form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dettagli acquisto</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="supplier_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fornitore *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
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
                      <FormControl><Input type="email" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="supplier_address" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Indirizzo</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

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
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrizione</FormLabel>
                    <FormControl><Textarea rows={2} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

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

                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note</FormLabel>
                    <FormControl><Textarea rows={2} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={updateMut.isPending}>
                    <Save className="h-4 w-4 mr-1" /> Salva modifiche
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setEditing(false); form.reset(); }}>
                    Annulla
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground">Fornitore</p>
                  <p className="font-medium">{dp.supplier_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Importo</p>
                  <p className="font-bold text-lg">{formatCurrency(dp.amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Data acquisto</p>
                  <p>{formatDateIT(dp.purchase_date)}</p>
                </div>
                {dp.supplier_vat && (
                  <div>
                    <p className="text-muted-foreground">P.IVA</p>
                    <p className="font-mono">{dp.supplier_vat}</p>
                  </div>
                )}
                {dp.supplier_email && (
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p>{dp.supplier_email}</p>
                  </div>
                )}
                {dp.supplier_address && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Indirizzo</p>
                    <p>{dp.supplier_address}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-muted-foreground">Oggetto</p>
                <p className="font-medium">{dp.subject}</p>
              </div>
              {dp.description && (
                <div>
                  <p className="text-muted-foreground">Descrizione</p>
                  <p>{dp.description}</p>
                </div>
              )}
              {(dp.invoice_number || dp.invoice_date) && (
                <div className="grid grid-cols-2 gap-4">
                  {dp.invoice_number && (
                    <div>
                      <p className="text-muted-foreground">Nr. Fattura</p>
                      <p className="font-mono">{dp.invoice_number}</p>
                    </div>
                  )}
                  {dp.invoice_date && (
                    <div>
                      <p className="text-muted-foreground">Data fattura</p>
                      <p>{formatDateIT(dp.invoice_date)}</p>
                    </div>
                  )}
                </div>
              )}
              {dp.notes && (
                <div>
                  <p className="text-muted-foreground">Note</p>
                  <p>{dp.notes}</p>
                </div>
              )}
              {dp.purchase_request_id && (
                <Button variant="link" className="p-0 h-auto" onClick={() => navigate(`/internal/purchasing/requests/${dp.purchase_request_id}`)}>
                  <FileText className="h-4 w-4 mr-1" /> Vai alla richiesta collegata
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
