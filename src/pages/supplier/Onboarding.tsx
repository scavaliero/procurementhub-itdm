import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { categoryService } from "@/services/categoryService";
import { contactService } from "@/services/contactService";
import { changeRequestService } from "@/services/changeRequestService";
import { notificationService } from "@/services/notificationService";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PageSkeleton } from "@/components/PageSkeleton";
import { toast } from "sonner";
import {
  Building2, Users, FolderTree, Plus, Trash2, Check, Save, Pencil, X, Clock, Send,
} from "lucide-react";
import type { Supplier } from "@/types";

interface Contact {
  nome: string;
  cognome: string;
  ruolo: string;
  email: string;
  phone: string;
}

const COMPANY_TYPES = ["SRL", "SPA", "SAS", "SNC", "Ditta Individuale", "Cooperativa", "Altro"];

export default function SupplierOnboarding() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: supplier, isLoading: supLoading } = useQuery({
    queryKey: ["my-supplier"],
    queryFn: () => vendorService.getMySupplier(),
    enabled: !!profile,
  });

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

  const { data: pendingRequest } = useQuery({
    queryKey: ["pending-change-request", supplier?.id],
    queryFn: () => changeRequestService.getPendingForSupplier(supplier!.id),
    enabled: !!supplier && !["pre_registered"].includes(supplier?.status || ""),
  });

  // Determine mode
  const isOnboarding = supplier?.status === "pre_registered";
  const isPostOnboarding = supplier && !["pre_registered", "pending_review"].includes(supplier.status);
  const hasPendingRequest = !!pendingRequest;

  const [editing, setEditing] = useState(false);

  // Form state
  const [companyData, setCompanyData] = useState<Partial<Supplier>>({});
  const [address, setAddress] = useState<Record<string, string>>({});
  const [contacts, setContacts] = useState<Contact[]>([
    { nome: "", cognome: "", ruolo: "", email: "", phone: "" },
  ]);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [initDone, setInitDone] = useState(false);
  const [contactsInitDone, setContactsInitDone] = useState(false);

  // Init from supplier data
  useEffect(() => {
    if (supplier && !initDone) {
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
      setInitDone(true);
    }
  }, [supplier, existingCats, initDone]);

  useEffect(() => {
    if (existingContacts && existingContacts.length > 0 && !contactsInitDone) {
      setContacts(
        existingContacts.map((c) => ({
          nome: c.first_name,
          cognome: c.last_name || "",
          ruolo: c.role || "",
          email: c.email,
          phone: c.phone || "",
        }))
      );
      setContactsInitDone(true);
    }
  }, [existingContacts, contactsInitDone]);

  // Auto-enable editing for onboarding
  useEffect(() => {
    if (isOnboarding) setEditing(true);
  }, [isOnboarding]);

  const saveContactsToDB = async () => {
    if (!supplier || !profile) return;
    const validContacts = contacts.filter((c) => c.nome && c.email);
    await contactService.upsertAll(
      supplier.id,
      profile.tenant_id,
      validContacts.map((c) => ({
        first_name: c.nome,
        last_name: c.cognome || undefined,
        role: c.ruolo || undefined,
        email: c.email,
        phone: c.phone || undefined,
      }))
    );
  };

  // Onboarding finalize: save everything + change status
  const finalizeMutation = useMutation({
    mutationFn: async () => {
      if (!supplier || !profile) return;
      await vendorService.updateSupplier(supplier.id, {
        ...companyData,
        legal_address: address as any,
      } as any);
      await saveContactsToDB();
      await vendorService.setSupplierCategories(supplier.id, selectedCats);
      await vendorService.updateSupplierStatus(supplier.id, "pending_review", supplier.status);
      try {
        await notificationService.send({
          event_type: "onboarding_completed",
          recipient_id: profile.id,
          tenant_id: profile.tenant_id,
          link_url: `/supplier/dashboard`,
          related_entity_id: supplier.id,
          related_entity_type: "supplier",
          variables: { company_name: companyData.company_name || supplier.company_name },
        });
      } catch (e) { console.error(e); }
    },
    onSuccess: async () => {
      toast.success("Dati inviati con successo! La tua richiesta è in fase di revisione.");
      await qc.invalidateQueries({ queryKey: ["my-supplier"] });
      await qc.refetchQueries({ queryKey: ["my-supplier"] });
      navigate("/supplier/dashboard");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Post-onboarding: create a change request
  const changeRequestMutation = useMutation({
    mutationFn: async () => {
      if (!supplier || !profile) throw new Error("Dati mancanti");

      // Compute diff — only include changed fields
      const changedCompanyData: Record<string, any> = {};
      if (companyData.company_name !== supplier.company_name) changedCompanyData.company_name = companyData.company_name;
      if ((companyData.company_type || "") !== (supplier.company_type || "")) changedCompanyData.company_type = companyData.company_type || "";
      if ((companyData.pec || "") !== (supplier.pec || "")) changedCompanyData.pec = companyData.pec || "";
      if ((companyData.website || "") !== (supplier.website || "")) changedCompanyData.website = companyData.website || "";

      const currentAddress = (supplier.legal_address && typeof supplier.legal_address === "object") ? supplier.legal_address as Record<string, string> : {};
      const changedAddress: Record<string, string> = {};
      for (const key of ["street", "city", "zip", "province", "country"]) {
        if ((address[key] || "") !== (currentAddress[key] || "")) changedAddress[key] = address[key] || "";
      }

      const hasCompanyChanges = Object.keys(changedCompanyData).length > 0;
      const hasAddressChanges = Object.keys(changedAddress).length > 0;

      // Categories diff
      const currentCatIds = existingCats.map((c: any) => c.category_id).sort();
      const newCatIds = [...selectedCats].sort();
      const hasCatChanges = JSON.stringify(currentCatIds) !== JSON.stringify(newCatIds);

      // Contacts diff (simplified: always include if editing)
      const validContacts = contacts.filter((c) => c.nome && c.email);

      if (!hasCompanyChanges && !hasAddressChanges && !hasCatChanges) {
        throw new Error("Nessuna modifica rilevata rispetto ai dati attuali.");
      }

      const requestedChanges: Record<string, any> = {};
      if (hasCompanyChanges) requestedChanges.company_data = changedCompanyData;
      if (hasAddressChanges) requestedChanges.address = { ...currentAddress, ...changedAddress };
      if (hasCatChanges) requestedChanges.categories = selectedCats;
      if (validContacts.length > 0) requestedChanges.contacts = validContacts;

      await changeRequestService.create({
        supplier_id: supplier.id,
        tenant_id: profile.tenant_id,
        requested_by: profile.id,
        requested_changes: requestedChanges,
      });
    },
    onSuccess: () => {
      toast.success("Richiesta di modifica inviata. Verrà esaminata dall'amministratore.");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["pending-change-request"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

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

  const canFinalize = !!companyData.company_name && contacts.some((c) => c.nome && c.email) && selectedCats.length > 0;

  if (supLoading) return <PageSkeleton />;
  if (!supplier) {
    return <div className="p-6"><p className="text-muted-foreground">Profilo fornitore non trovato.</p></div>;
  }

  // Pending review: waiting screen
  if (supplier.status === "pending_review") {
    const submittedDate = supplier.updated_at
      ? new Date(supplier.updated_at).toLocaleDateString("it-IT", {
          day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
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
        </div>
        <Badge variant="secondary" className="text-sm">Stato: In valutazione</Badge>
      </div>
    );
  }

  const readOnly = !editing;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {isOnboarding ? "Onboarding Fornitore" : "Anagrafica Azienda"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isOnboarding
              ? "Completa il tuo profilo per essere qualificato."
              : "Visualizza e gestisci i dati della tua azienda."}
          </p>
        </div>

        {isPostOnboarding && !editing && (
          <div className="flex items-center gap-2">
            {hasPendingRequest && (
              <Badge variant="secondary" className="gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Modifica in attesa di approvazione
              </Badge>
            )}
            {!hasPendingRequest && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4 mr-1.5" /> Richiedi modifica
              </Button>
            )}
          </div>
        )}

        {isPostOnboarding && editing && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => {
              setEditing(false);
              // Reset to original values
              setInitDone(false);
              setContactsInitDone(false);
            }}>
              <X className="h-4 w-4 mr-1" /> Annulla
            </Button>
            <Button
              onClick={() => changeRequestMutation.mutate()}
              disabled={changeRequestMutation.isPending}
            >
              <Send className="h-4 w-4 mr-1.5" />
              {changeRequestMutation.isPending ? "Invio…" : "Invia richiesta"}
            </Button>
          </div>
        )}
      </div>

      {/* Enabled status banner */}
      {supplier.status === "enabled" && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Account abilitato</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Carica i documenti obbligatori per completare il processo di qualifica.
              </p>
            </div>
            <Button size="sm" onClick={() => navigate("/supplier/documents")}>
              Vai ai documenti
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Section 1: Company Data */}
      <Card className="card-top-suppliers">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5" /> Dati Azienda
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldInput
              label="Ragione sociale"
              required
              value={companyData.company_name || ""}
              onChange={(v) => setCompanyData({ ...companyData, company_name: v })}
              readOnly={readOnly}
            />
            <div className="space-y-1.5">
              <Label className="text-sm">Tipo società</Label>
              {readOnly ? (
                <p className="text-sm font-medium py-2">{companyData.company_type || "—"}</p>
              ) : (
                <Select
                  value={companyData.company_type || ""}
                  onValueChange={(v) => setCompanyData({ ...companyData, company_type: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>
                    {COMPANY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldInput label="PEC" value={companyData.pec || ""} onChange={(v) => setCompanyData({ ...companyData, pec: v })} readOnly={readOnly} type="email" />
            <FieldInput label="Sito Web" value={companyData.website || ""} onChange={(v) => setCompanyData({ ...companyData, website: v })} readOnly={readOnly} />
          </div>

          <Separator />
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Dati dal profilo</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Referente</Label>
              <p className="text-sm font-medium py-2">{profile?.full_name || "—"}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Email</Label>
              <p className="text-sm font-medium py-2">{profile?.email || "—"}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Telefono</Label>
              <p className="text-sm font-medium py-2">{profile?.phone || "—"}</p>
            </div>
          </div>

          <Separator />
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Sede legale</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FieldInput label="Via/Piazza" value={address.street || ""} onChange={(v) => setAddress({ ...address, street: v })} readOnly={readOnly} />
            <FieldInput label="Città" value={address.city || ""} onChange={(v) => setAddress({ ...address, city: v })} readOnly={readOnly} />
            <FieldInput label="CAP" value={address.zip || ""} onChange={(v) => setAddress({ ...address, zip: v })} readOnly={readOnly} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldInput label="Provincia" value={address.province || ""} onChange={(v) => setAddress({ ...address, province: v })} readOnly={readOnly} />
            <FieldInput label="Nazione" value={address.country || "IT"} onChange={(v) => setAddress({ ...address, country: v })} readOnly={readOnly} />
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Contacts */}
      <Card className="card-top-suppliers">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2"><Users className="h-5 w-5" /> Referenti</span>
            {!readOnly && (
              <Button size="sm" variant="outline" onClick={addContact}>
                <Plus className="h-4 w-4 mr-1" /> Aggiungi
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {readOnly ? (
            contacts.filter((c) => c.nome).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun referente inserito.</p>
            ) : (
              <div className="space-y-3">
                {contacts.filter((c) => c.nome).map((c, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-1">
                    <p className="text-sm font-medium">{c.nome} {c.cognome}</p>
                    {c.ruolo && <p className="text-xs text-muted-foreground">{c.ruolo}</p>}
                    <p className="text-xs">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p>
                  </div>
                ))}
              </div>
            )
          ) : (
            contacts.map((c, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-3 relative">
                {contacts.length > 1 && (
                  <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-7 w-7" onClick={() => removeContact(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input placeholder="Nome *" value={c.nome} onChange={(e) => updateContact(i, "nome", e.target.value)} />
                  <Input placeholder="Cognome" value={c.cognome} onChange={(e) => updateContact(i, "cognome", e.target.value)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input placeholder="Ruolo" value={c.ruolo} onChange={(e) => updateContact(i, "ruolo", e.target.value)} />
                  <Input placeholder="Email *" type="email" value={c.email} onChange={(e) => updateContact(i, "email", e.target.value)} />
                  <Input placeholder="Telefono" type="tel" value={c.phone} onChange={(e) => updateContact(i, "phone", e.target.value)} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Section 3: Categories */}
      <Card className="card-top-suppliers">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderTree className="h-5 w-5" /> Categorie Merceologiche
          </CardTitle>
        </CardHeader>
        <CardContent>
          {readOnly ? (
            selectedCats.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna categoria selezionata.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedCats.map((id) => {
                  const cat = categories.find((c) => c.id === id);
                  return cat ? (
                    <Badge key={id} variant="secondary">{cat.code} — {cat.name}</Badge>
                  ) : null;
                })}
              </div>
            )
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                Seleziona almeno una categoria per cui desideri qualificarti.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {categories.filter((c) => c.is_active).map((cat) => (
                  <label
                    key={cat.id}
                    className={`flex items-start gap-3 border rounded-lg p-3 cursor-pointer transition-colors ${
                      selectedCats.includes(cat.id)
                        ? "border-primary bg-primary/5"
                        : "hover:border-muted-foreground/30"
                    }`}
                  >
                    <Checkbox checked={selectedCats.includes(cat.id)} onCheckedChange={() => toggleCat(cat.id)} />
                    <div>
                      <p className="text-sm font-medium">{cat.code} — {cat.name}</p>
                      {cat.description && <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>}
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Onboarding submit */}
      {isOnboarding && (
        <div className="flex justify-end">
          <Button
            onClick={() => finalizeMutation.mutate()}
            disabled={!canFinalize || finalizeMutation.isPending}
            size="lg"
          >
            <Send className="h-4 w-4 mr-1.5" />
            {finalizeMutation.isPending ? "Invio…" : "Invia Richiesta"}
          </Button>
        </div>
      )}
    </div>
  );
}

function FieldInput({
  label, value, onChange, readOnly, required, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void;
  readOnly: boolean; required?: boolean; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}{required && " *"}</Label>
      {readOnly ? (
        <p className="text-sm font-medium py-2">{value || "—"}</p>
      ) : (
        <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
