import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { categoryService } from "@/services/categoryService";
import { contactService } from "@/services/contactService";
import { notificationService } from "@/services/notificationService";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageSkeleton } from "@/components/PageSkeleton";
import { toast } from "sonner";
import { Plus, Trash2, Check, ArrowLeft, ArrowRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { Supplier } from "@/types";

interface Contact {
  nome: string;
  cognome: string;
  ruolo: string;
  email: string;
  phone: string;
}

export default function SupplierOnboarding() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);

  const { data: supplier, isLoading: supLoading } = useQuery({
    queryKey: ["my-supplier"],
    queryFn: () => vendorService.getMySupplier(),
    enabled: !!profile,
  });

  // Profile data (email, phone, full_name from registration)
  const profileEmail = profile?.email || "";
  const profilePhone = profile?.phone || "";
  const profileName = profile?.full_name || "";

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoryService.list(),
  });

  const { data: existingCats = [] } = useQuery({
    queryKey: ["supplier-categories", supplier?.id],
    queryFn: () => vendorService.getSupplierCategories(supplier!.id),
    enabled: !!supplier,
  });

  const { data: existingContacts } = useQuery({
    queryKey: ["supplier-contacts", supplier?.id],
    queryFn: () => contactService.list(supplier!.id),
    enabled: !!supplier,
  });

  // Step 1 state
  const [companyData, setCompanyData] = useState<Partial<Supplier>>({});
  const [address, setAddress] = useState<Record<string, string>>({});

  // Step 2 state
  const [contacts, setContacts] = useState<Contact[]>([
    { nome: "", cognome: "", ruolo: "", email: "", phone: "" },
  ]);
  const [contactsInitDone, setContactsInitDone] = useState(false);

  // Step 3 state
  const [selectedCats, setSelectedCats] = useState<string[]>([]);

  // Init from supplier data
  const initDone = useState(false);
  if (supplier && !initDone[0]) {
    setCompanyData({
      company_name: supplier.company_name,
      company_type: supplier.company_type,
      pec: supplier.pec,
      website: supplier.website,
    });
    if (supplier.legal_address && typeof supplier.legal_address === "object") {
      setAddress(supplier.legal_address as Record<string, string>);
    }
    if (existingCats.length > 0) {
      setSelectedCats(existingCats.map((c: any) => c.category_id));
    }
    initDone[1](true);
  }

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (!supplier) return;
      await vendorService.updateSupplier(supplier.id, {
        ...companyData,
        legal_address: address as any,
      } as any);
    },
    onError: () => toast.error("Errore nel salvataggio bozza"),
  });

  const saveDraft = useCallback(() => {
    if (supplier) saveDraftMutation.mutate();
  }, [supplier, saveDraftMutation]);

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      if (!supplier || !profile) return;
      // Save company data
      await vendorService.updateSupplier(supplier.id, {
        ...companyData,
        legal_address: address as any,
      } as any);
      // Save categories
      await vendorService.setSupplierCategories(supplier.id, selectedCats);
      // Update status
      await vendorService.updateSupplierStatus(
        supplier.id,
        "pending_review",
        supplier.status
      );
      // Send notification
      try {
        await notificationService.send({
          event_type: "onboarding_completed",
          recipient_id: profile.id,
          tenant_id: profile.tenant_id,
          variables: { company_name: companyData.company_name || supplier.company_name },
        });
      } catch (e) {
        console.error(e);
      }
    },
    onSuccess: async () => {
      toast.success("Dati inviati con successo! La tua richiesta è in fase di revisione.");
      await qc.invalidateQueries({ queryKey: ["my-supplier"] });
      await qc.refetchQueries({ queryKey: ["my-supplier"] });
      navigate("/supplier/dashboard");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (supLoading) return <PageSkeleton />;
  if (!supplier) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Profilo fornitore non trovato.</p>
      </div>
    );
  }

  // ── After submission: read-only waiting screen ──
  if (supplier.status === "pending_review") {
    const submittedDate = supplier.updated_at
      ? new Date(supplier.updated_at).toLocaleDateString("it-IT", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

    return (
      <div className="p-6 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Check className="h-7 w-7 text-primary" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold">Richiesta inviata</h1>
          <p className="text-muted-foreground text-sm">
            La tua richiesta di registrazione è stata inviata
            {submittedDate && <> in data <strong>{submittedDate}</strong></>} ed
            è attualmente in fase di valutazione da parte dell'amministratore.
          </p>
          <p className="text-muted-foreground text-sm">
            Riceverai una notifica via email quando la tua richiesta sarà elaborata.
            Non è necessaria alcuna ulteriore azione da parte tua.
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          Stato: In valutazione
        </Badge>
      </div>
    );
  }

  // ── Enabled: show read-only profile summary + redirect to documents ──
  if (supplier.status === "enabled") {
    const addr = supplier.legal_address as Record<string, string> | null;
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Check className="h-7 w-7 text-primary" />
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-xl font-semibold">Account abilitato</h1>
            <p className="text-muted-foreground text-sm">
              Il tuo account è stato abilitato. Ora devi caricare i documenti obbligatori
              per completare il processo di qualifica.
            </p>
          </div>
          <Badge variant="default" className="text-sm">Stato: Abilitato</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Riepilogo Anagrafica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <span className="text-muted-foreground">Ragione sociale</span>
              <span className="font-medium">{supplier.company_name}</span>
              {supplier.company_type && (
                <>
                  <span className="text-muted-foreground">Tipo società</span>
                  <span>{supplier.company_type}</span>
                </>
              )}
              {supplier.pec && (
                <>
                  <span className="text-muted-foreground">PEC</span>
                  <span>{supplier.pec}</span>
                </>
              )}
              {supplier.website && (
                <>
                  <span className="text-muted-foreground">Sito Web</span>
                  <span>{supplier.website}</span>
                </>
              )}
              {addr && (addr.street || addr.city) && (
                <>
                  <span className="text-muted-foreground">Sede legale</span>
                  <span>{[addr.street, addr.city, addr.province, addr.zip, addr.country].filter(Boolean).join(", ")}</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Button className="w-full" onClick={() => navigate("/supplier/documents")}>
          Vai al caricamento documenti
        </Button>
      </div>
    );
  }

  const steps = ["Dati Azienda", "Referenti", "Categorie", "Riepilogo"];
  const progress = ((step + 1) / steps.length) * 100;

  const canNext = () => {
    if (step === 0) return !!companyData.company_name;
    if (step === 1) return contacts.some((c) => c.nome && c.email);
    if (step === 2) return selectedCats.length > 0;
    return true;
  };

  const handleNext = () => {
    saveDraft();
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const addContact = () =>
    setContacts([...contacts, { nome: "", cognome: "", ruolo: "", email: "", phone: "" }]);
  const removeContact = (i: number) =>
    setContacts(contacts.filter((_, idx) => idx !== i));
  const updateContact = (i: number, field: keyof Contact, value: string) =>
    setContacts(contacts.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));

  const toggleCat = (id: string) =>
    setSelectedCats((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Onboarding Fornitore</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Completa il tuo profilo per essere qualificato.
        </p>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          {steps.map((s, i) => (
            <span key={s} className={i <= step ? "text-primary font-medium" : ""}>
              {s}
            </span>
          ))}
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step 1 */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dati Azienda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Ragione sociale *</Label>
                <Input
                  value={companyData.company_name || ""}
                  onChange={(e) =>
                    setCompanyData({ ...companyData, company_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo società</Label>
                <Select
                  value={companyData.company_type || ""}
                  onValueChange={(v) =>
                    setCompanyData({ ...companyData, company_type: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona" />
                  </SelectTrigger>
                  <SelectContent>
                    {["SRL", "SPA", "SAS", "SNC", "Ditta Individuale", "Cooperativa", "Altro"].map(
                      (t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>PEC</Label>
                <Input
                  type="email"
                  value={companyData.pec || ""}
                  onChange={(e) =>
                    setCompanyData({ ...companyData, pec: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sito Web</Label>
                <Input
                  value={companyData.website || ""}
                  onChange={(e) =>
                    setCompanyData({ ...companyData, website: e.target.value })
                  }
                />
              </div>
            </div>
            <Separator className="my-2" />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Dati dal profilo di registrazione</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Referente</Label>
                <Input value={profileName} disabled className="bg-muted" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={profileEmail} disabled className="bg-muted" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefono</Label>
                <Input value={profilePhone || "—"} disabled className="bg-muted" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Indirizzo sede legale</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  placeholder="Via/Piazza"
                  value={address.street || ""}
                  onChange={(e) => setAddress({ ...address, street: e.target.value })}
                />
                <Input
                  placeholder="Città"
                  value={address.city || ""}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                />
                <Input
                  placeholder="CAP"
                  value={address.zip || ""}
                  onChange={(e) => setAddress({ ...address, zip: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <Input
                  placeholder="Provincia"
                  value={address.province || ""}
                  onChange={(e) => setAddress({ ...address, province: e.target.value })}
                />
                <Input
                  placeholder="Nazione"
                  value={address.country || "IT"}
                  onChange={(e) => setAddress({ ...address, country: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Contacts */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Referenti
              <Button size="sm" variant="outline" onClick={addContact}>
                <Plus className="h-4 w-4 mr-1" /> Aggiungi
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {contacts.map((c, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-3 relative">
                {contacts.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => removeContact(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    placeholder="Nome *"
                    value={c.nome}
                    onChange={(e) => updateContact(i, "nome", e.target.value)}
                  />
                  <Input
                    placeholder="Cognome"
                    value={c.cognome}
                    onChange={(e) => updateContact(i, "cognome", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    placeholder="Ruolo"
                    value={c.ruolo}
                    onChange={(e) => updateContact(i, "ruolo", e.target.value)}
                  />
                  <Input
                    placeholder="Email *"
                    type="email"
                    value={c.email}
                    onChange={(e) => updateContact(i, "email", e.target.value)}
                  />
                  <Input
                    placeholder="Telefono"
                    type="tel"
                    value={c.phone}
                    onChange={(e) => updateContact(i, "phone", e.target.value)}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Categories */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Categorie Merceologiche</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Seleziona almeno una categoria per cui desideri qualificarti.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {categories
                .filter((c) => c.is_active)
                .map((cat) => (
                  <label
                    key={cat.id}
                    className={`flex items-start gap-3 border rounded-lg p-3 cursor-pointer transition-colors ${
                      selectedCats.includes(cat.id)
                        ? "border-primary bg-primary/5"
                        : "hover:border-muted-foreground/30"
                    }`}
                  >
                    <Checkbox
                      checked={selectedCats.includes(cat.id)}
                      onCheckedChange={() => toggleCat(cat.id)}
                    />
                    <div>
                      <p className="text-sm font-medium">
                        {cat.code} — {cat.name}
                      </p>
                      {cat.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {cat.description}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
            </div>
            {categories.filter((c) => c.is_active).length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nessuna categoria disponibile al momento.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Summary */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Riepilogo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-1">Azienda</h3>
              <p className="text-sm">
                {companyData.company_name}{" "}
                {companyData.company_type && `(${companyData.company_type})`}
              </p>
              {companyData.pec && (
                <p className="text-xs text-muted-foreground">PEC: {companyData.pec}</p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-1">Referenti</h3>
              {contacts
                .filter((c) => c.nome)
                .map((c, i) => (
                  <p key={i} className="text-sm">
                    {c.nome} {c.cognome} — {c.email}
                    {c.ruolo && ` (${c.ruolo})`}
                  </p>
                ))}
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-1">Categorie selezionate</h3>
              <div className="flex flex-wrap gap-1.5">
                {selectedCats.map((id) => {
                  const cat = categories.find((c) => c.id === id);
                  return cat ? (
                    <Badge key={id} variant="secondary">
                      {cat.code} — {cat.name}
                    </Badge>
                  ) : null;
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(s - 1, 0))}
          disabled={step === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Indietro
        </Button>
        {step < steps.length - 1 ? (
          <Button onClick={handleNext} disabled={!canNext()}>
            Avanti <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={() => finalizeMutation.mutate()}
            disabled={finalizeMutation.isPending}
          >
            <Check className="h-4 w-4 mr-1" />
            {finalizeMutation.isPending ? "Invio…" : "Invia Richiesta"}
          </Button>
        )}
      </div>
    </div>
  );
}
