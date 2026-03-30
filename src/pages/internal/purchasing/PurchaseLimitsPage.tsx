import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGrants } from "@/hooks/useGrants";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";

interface PurchaseLimit {
  id: string;
  tenant_id: string;
  role_id: string;
  max_approval_amount: number;
  max_annual_spend: number | null;
  description: string | null;
  is_active: boolean;
}

interface Role {
  id: string;
  name: string;
  is_active: boolean;
}

export default function PurchaseLimitsPage() {
  const { profile } = useAuth();
  const { hasGrant } = useGrants();
  const qc = useQueryClient();
  const [editItem, setEditItem] = useState<PurchaseLimit | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ role_id: "", max_approval_amount: "", max_annual_spend: "", description: "" });

  const canManage = hasGrant("manage_tenant_settings");

  const { data: limits = [], isLoading } = useQuery({
    queryKey: ["purchase-limits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_limits")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as PurchaseLimit[];
    },
    enabled: !!profile,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles-for-limits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("id, name, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Role[];
    },
    enabled: !!profile,
  });

  const rolesMap = Object.fromEntries(roles.map((r) => [r.id, r.name]));

  // Filter out roles that already have a limit (unless editing)
  const availableRoles = roles.filter(
    (r) => !limits.some((l) => l.role_id === r.id) || editItem?.role_id === r.id
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Non autenticato");
      const payload = {
        tenant_id: profile.tenant_id,
        role_id: form.role_id,
        max_approval_amount: parseFloat(form.max_approval_amount) || 0,
        max_annual_spend: form.max_annual_spend ? parseFloat(form.max_annual_spend) : null,
        description: form.description || null,
      };
      if (editItem) {
        const { error } = await supabase.from("purchase_limits").update(payload).eq("id", editItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("purchase_limits").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editItem ? "Limite aggiornato" : "Limite creato");
      qc.invalidateQueries({ queryKey: ["purchase-limits"] });
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_limits").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Limite rimosso");
      qc.invalidateQueries({ queryKey: ["purchase-limits"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openCreate = () => {
    setEditItem(null);
    setForm({ role_id: "", max_approval_amount: "", max_annual_spend: "", description: "" });
    setShowDialog(true);
  };

  const openEdit = (item: PurchaseLimit) => {
    setEditItem(item);
    setForm({
      role_id: item.role_id,
      max_approval_amount: String(item.max_approval_amount),
      max_annual_spend: item.max_annual_spend ? String(item.max_annual_spend) : "",
      description: item.description || "",
    });
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditItem(null);
  };

  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(v);

  if (!canManage) {
    return (
      <div className="p-6">
        <EmptyState title="Accesso non autorizzato" description="Non hai i permessi per visualizzare questa pagina." />
      </div>
    );
  }

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb
        items={[
          { label: "Ufficio Acquisti" },
          { label: "Limiti di Acquisto" },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Limiti di Acquisto per Ruolo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configura l'importo massimo approvabile autonomamente per ogni ruolo.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Nuovo limite
        </Button>
      </div>

      {limits.length === 0 ? (
        <EmptyState
          title="Nessun limite configurato"
          description="Aggiungi un limite di acquisto per definire quanto ogni ruolo può approvare autonomamente."
        />
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {limits.map((limit) => (
            <Card key={limit.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">
                      {rolesMap[limit.role_id] || "Ruolo sconosciuto"}
                    </CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-xs">Attivo</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Soglia approvazione</p>
                  <p className="text-xl font-bold tabular-nums">{fmtCurrency(limit.max_approval_amount)}</p>
                </div>
                {limit.max_annual_spend != null && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Limite spesa annuale</p>
                    <p className="text-lg font-semibold tabular-nums">{fmtCurrency(limit.max_annual_spend)}</p>
                  </div>
                )}
                {limit.description && (
                  <p className="text-xs text-muted-foreground">{limit.description}</p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(limit)} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Modifica
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteMutation.mutate(limit.id)}
                    disabled={deleteMutation.isPending}
                    className="gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Rimuovi
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? "Modifica limite" : "Nuovo limite di acquisto"}</DialogTitle>
            <DialogDescription>
              Definisci l'importo massimo che il ruolo selezionato può approvare autonomamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Ruolo</Label>
              <Select value={form.role_id} onValueChange={(v) => setForm((p) => ({ ...p, role_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un ruolo" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Soglia approvazione (€)</Label>
              <Input
                type="number"
                min="0"
                step="100"
                value={form.max_approval_amount}
                onChange={(e) => setForm((p) => ({ ...p, max_approval_amount: e.target.value }))}
                placeholder="es. 5000"
              />
              <p className="text-xs text-muted-foreground">
                Importo massimo approvabile autonomamente. Oltre questa soglia serve approvazione superiore.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Limite spesa annuale (€) — opzionale</Label>
              <Input
                type="number"
                min="0"
                step="1000"
                value={form.max_annual_spend}
                onChange={(e) => setForm((p) => ({ ...p, max_annual_spend: e.target.value }))}
                placeholder="es. 50000"
              />
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Descrizione opzionale"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Annulla</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.role_id || !form.max_approval_amount || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Salvataggio…" : editItem ? "Aggiorna" : "Crea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
