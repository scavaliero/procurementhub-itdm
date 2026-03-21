import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentService } from "@/services/documentService";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";
import type { DocumentType } from "@/types";

interface DtForm {
  code: string;
  name: string;
  description: string;
  is_mandatory: boolean;
  is_blocking: boolean;
  requires_expiry: boolean;
  needs_manual_review: boolean;
  max_size_mb: number;
  allowed_formats: string;
}

const defaultForm: DtForm = {
  code: "",
  name: "",
  description: "",
  is_mandatory: false,
  is_blocking: false,
  requires_expiry: false,
  needs_manual_review: true,
  max_size_mb: 10,
  allowed_formats: "pdf,jpg,png,docx",
};

export default function ConfigDocumentTypes() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentType | null>(null);
  const [form, setForm] = useState<DtForm>(defaultForm);

  const { data: docTypes = [], isLoading } = useQuery({
    queryKey: ["document-types-all"],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase
        .from("document_types")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as DocumentType[];
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      documentService.createDocumentType({
        ...form,
        tenant_id: profile!.tenant_id,
        allowed_formats: form.allowed_formats.split(",").map((s) => s.trim()),
      }),
    onSuccess: () => {
      toast.success("Tipo documento creato");
      qc.invalidateQueries({ queryKey: ["document-types-all"] });
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      documentService.updateDocumentType(editing!.id, {
        ...form,
        allowed_formats: form.allowed_formats.split(",").map((s) => s.trim()),
      } as any),
    onSuccess: () => {
      toast.success("Tipo documento aggiornato");
      qc.invalidateQueries({ queryKey: ["document-types-all"] });
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentService.deleteDocumentType(id),
    onSuccess: () => {
      toast.success("Tipo documento disattivato");
      qc.invalidateQueries({ queryKey: ["document-types-all"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm(defaultForm);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (dt: DocumentType) => {
    setEditing(dt);
    setForm({
      code: dt.code,
      name: dt.name,
      description: dt.description || "",
      is_mandatory: dt.is_mandatory ?? false,
      is_blocking: dt.is_blocking ?? false,
      requires_expiry: dt.requires_expiry ?? false,
      needs_manual_review: dt.needs_manual_review ?? true,
      max_size_mb: dt.max_size_mb ?? 10,
      allowed_formats: dt.allowed_formats?.join(",") || "pdf,jpg,png,docx",
    });
    setDialogOpen(true);
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tipi Documento</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Nuovo Tipo
        </Button>
      </div>

      {docTypes.length === 0 ? (
        <EmptyState
          title="Nessun tipo documento"
          description="Configura i documenti richiesti ai fornitori."
          action={<Button onClick={openCreate}>Crea Tipo Documento</Button>}
        />
      ) : (
        <div className="space-y-2">
          {docTypes.map((dt) => (
            <Card key={dt.id}>
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{dt.code}</span>
                      <span className="text-sm">{dt.name}</span>
                      {dt.is_mandatory && <Badge variant="secondary" className="text-xs">Obbligatorio</Badge>}
                      {!dt.is_active && <Badge variant="outline" className="text-xs">Inattivo</Badge>}
                    </div>
                    {dt.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{dt.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(dt)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {dt.is_active && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteMutation.mutate(dt.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica Tipo Documento" : "Nuovo Tipo Documento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Codice *</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrizione</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Formati consentiti</Label>
                <Input value={form.allowed_formats} onChange={(e) => setForm({ ...form, allowed_formats: e.target.value })} placeholder="pdf,jpg,png" />
              </div>
              <div className="space-y-1.5">
                <Label>Max MB</Label>
                <Input type="number" value={form.max_size_mb} onChange={(e) => setForm({ ...form, max_size_mb: Number(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-3">
              {[
                { key: "is_mandatory" as const, label: "Obbligatorio" },
                { key: "is_blocking" as const, label: "Bloccante" },
                { key: "requires_expiry" as const, label: "Richiede scadenza" },
                { key: "needs_manual_review" as const, label: "Revisione manuale" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label>{label}</Label>
                  <Switch
                    checked={form[key]}
                    onCheckedChange={(v) => setForm({ ...form, [key]: v })}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Annulla</Button>
            <Button
              disabled={!form.code || !form.name}
              onClick={() => (editing ? updateMutation.mutate() : createMutation.mutate())}
            >
              {editing ? "Salva" : "Crea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
