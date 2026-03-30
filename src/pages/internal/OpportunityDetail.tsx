import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { opportunityService } from "@/services/opportunityService";
import { invitationService } from "@/services/invitationService";
import { orderService } from "@/services/orderService";
import { auditService } from "@/services/auditService";
import { useAuth } from "@/hooks/useAuth";
import { useGrants } from "@/hooks/useGrants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { ArrowLeft, Users, Send, Search, FileText, CheckCircle, Play, ClipboardList, Award, ShoppingCart, Pencil, ExternalLink, Paperclip, Trash2 } from "lucide-react";
import OpportunityAttachments from "@/components/opportunity/OpportunityAttachments";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { formatCurrency } from "@/utils/formatters";

const STATUS_LABELS: Record<string, string> = {
  draft: "Bozza", pending_approval: "In approvazione", open: "Aperta",
  collecting_bids: "Raccolta offerte", evaluating: "In valutazione",
  awarded: "Aggiudicata", closed: "Chiusa", cancelled: "Annullata",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700", pending_approval: "bg-amber-100 text-amber-700",
  open: "bg-emerald-100 text-emerald-700", collecting_bids: "bg-blue-100 text-blue-700",
  evaluating: "bg-purple-100 text-purple-700", awarded: "bg-green-100 text-green-800",
  closed: "bg-gray-200 text-gray-600", cancelled: "bg-red-100 text-red-700",
};

/** Valid next statuses per current status */
const STATUS_TRANSITIONS: Record<string, { next: string; label: string; icon: any; variant?: "default" | "outline" | "destructive" }[]> = {
  draft: [
    { next: "pending_approval", label: "Invia in approvazione", icon: Send, variant: "default" },
  ],
  pending_approval: [
    { next: "open", label: "Approva e pubblica", icon: CheckCircle, variant: "default" },
    { next: "draft", label: "Rimanda in bozza", icon: ArrowLeft, variant: "outline" },
  ],
  // "collecting_bids" → "evaluating" is handled ONLY via the evaluation page "Chiudi raccolta e valuta"
  // "evaluating" → "awarded" is handled ONLY via the evaluation page "Seleziona vincitore"
  awarded: [
    { next: "closed", label: "Chiudi opportunità", icon: CheckCircle, variant: "outline" },
  ],
};

export default function InternalOpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { hasGrant } = useGrants();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: opp, isLoading } = useQuery({
    queryKey: ["opportunity", id],
    queryFn: () => opportunityService.getById(id!),
    enabled: !!id && !!profile,
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ["invitations", id],
    queryFn: () => invitationService.getInvitationsByOpportunity(id!),
    enabled: !!id && !!profile,
  });

  const { data: hasOrder = false } = useQuery({
    queryKey: ["order-exists-for-opp", id],
    queryFn: () => orderService.existsForOpportunity(id!),
    enabled: !!id && !!profile,
  });

  const { data: orderForOpp } = useQuery({
    queryKey: ["order-for-opp", id],
    queryFn: () => orderService.getByOpportunityId(id!),
    enabled: !!id && hasOrder,
  });

  const statusMutation = useMutation({
    mutationFn: async (nextStatus: string) => {
      const updated = await opportunityService.update(id!, { status: nextStatus } as any);
      await auditService.log({
        tenant_id: profile!.tenant_id,
        entity_type: "opportunity",
        entity_id: id!,
        event_type: "opportunity_status_changed",
        old_state: { status: opp!.status },
        new_state: { status: nextStatus },
      });
      return updated;
    },
    onSuccess: (_, nextStatus) => {
      toast.success(`Stato aggiornato a "${STATUS_LABELS[nextStatus] ?? nextStatus}"`);
      qc.invalidateQueries({ queryKey: ["opportunity", id] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["opportunities-counts"] });
    },
    onError: (err: Error) => toast.error(err.message || "Errore aggiornamento stato"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await opportunityService.update(id!, { deleted_at: new Date().toISOString() } as any);
      await auditService.log({
        tenant_id: profile!.tenant_id,
        entity_type: "opportunity",
        entity_id: id!,
        event_type: "opportunity_deleted",
        new_state: { deleted: true },
      });
    },
    onSuccess: () => {
      toast.success("Opportunità eliminata");
      navigate("/internal/opportunities");
      qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (err: Error) => toast.error(err.message || "Errore nell'eliminazione"),
  });

  if (isLoading) return <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  if (!opp) return <EmptyState title="Opportunità non trovata" />;

   const criteria = Array.isArray(opp.evaluation_criteria) ? opp.evaluation_criteria : [];
  const canInvite = hasGrant("invite_suppliers") && ["open", "collecting_bids"].includes(opp.status);
  const canEdit = (hasGrant("create_opportunity") || hasGrant("approve_opportunity")) && !["awarded", "closed", "cancelled"].includes(opp.status) && !hasOrder;
  const canChangeStatus = (hasGrant("create_opportunity") || hasGrant("approve_opportunity")) && !hasOrder;
  const isAdmin = hasGrant("manage_tenant_settings");
  const canDelete = (hasGrant("create_opportunity") || hasGrant("approve_opportunity")) && !hasOrder && (
    isAdmin || (invitations.length === 0 && ["draft", "pending_approval", "open"].includes(opp.status))
  );
  const transitions = STATUS_TRANSITIONS[opp.status] ?? [];

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: "Dashboard", href: "/internal/dashboard" }, { label: "Opportunità", href: "/internal/opportunities" }, { label: opp.title }]} />
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/internal/opportunities")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{opp.title}</h1>
          <p className="text-sm text-muted-foreground font-mono">{opp.code}</p>
        </div>
        <Badge className={STATUS_COLORS[opp.status] ?? ""} variant="secondary">
          {STATUS_LABELS[opp.status] ?? opp.status}
        </Badge>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <Button variant="outline" onClick={() => navigate(`/internal/opportunities/${id}/edit`)}>
            <Pencil className="mr-2 h-4 w-4" /> Modifica
          </Button>
        )}
        {canChangeStatus && transitions.map((t) => {
          const Icon = t.icon;
          return (
            <Button
              key={t.next}
              variant={t.variant ?? "default"}
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate(t.next)}
            >
              <Icon className="mr-2 h-4 w-4" />
              {t.label}
            </Button>
          );
        })}

        {/* Link to evaluation page */}
        {canChangeStatus && ["collecting_bids", "evaluating"].includes(opp.status) && (
          <Button variant="outline" onClick={() => navigate(`/internal/opportunities/${id}/evaluation`)}>
            <ClipboardList className="mr-2 h-4 w-4" /> Vai alla valutazione
          </Button>
        )}

        {/* Link to create order — only if awarded and no order exists yet */}
        {canChangeStatus && opp.status === "awarded" && !hasOrder && (
          <Button variant="default" onClick={() => navigate(`/internal/opportunities/${id}/create-order`)}>
            <ShoppingCart className="mr-2 h-4 w-4" /> Genera ordine
          </Button>
        )}
        {hasOrder && (
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 py-1.5 px-3">
            ✓ Ordine già generato
          </Badge>
        )}
        {canDelete && (
          <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)} disabled={deleteMutation.isPending}>
            <Trash2 className="mr-2 h-4 w-4" /> Elimina
          </Button>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina opportunità</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare questa opportunità? L'azione è irreversibile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Annulla</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
              {deleteMutation.isPending ? "Eliminazione…" : "Conferma eliminazione"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Dettagli</TabsTrigger>
          <TabsTrigger value="criteria">Criteri ({criteria.length})</TabsTrigger>
          <TabsTrigger value="attachments"><Paperclip className="h-4 w-4 mr-1" /> Allegati</TabsTrigger>
          <TabsTrigger value="invitations">Inviti ({invitations.length})</TabsTrigger>
          {canInvite && <TabsTrigger value="invite">Invita fornitori</TabsTrigger>}
          {hasOrder && <TabsTrigger value="order">Ordine</TabsTrigger>}
        </TabsList>

        <TabsContent value="details">
          <Card className="card-top-opportunities">
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Detail label="Categoria" value={opp.categories?.name} />
              <Detail label="Unità richiedente" value={opp.requesting_unit} />
              <Detail label="Scadenza offerte" value={opp.bids_deadline ? format(new Date(opp.bids_deadline), "dd/MM/yyyy HH:mm") : undefined} />
              <Detail label="Apertura" value={opp.opens_at ? format(new Date(opp.opens_at), "dd/MM/yyyy HH:mm") : undefined} />
              <Detail label="Data inizio" value={opp.start_date} />
              <Detail label="Data fine" value={opp.end_date} />
              {opp.budget_estimated != null && <Detail label="Budget stimato" value={formatCurrency(opp.budget_estimated)} />}
              {opp.budget_max != null && <Detail label="Offerta massima" value={formatCurrency(opp.budget_max)} />}
              {opp.description && (
                <div className="md:col-span-2">
                  <p className="text-sm text-muted-foreground">Descrizione</p>
                  <p className="text-sm whitespace-pre-wrap">{opp.description}</p>
                </div>
              )}
              {opp.participation_conditions && (
                <div className="md:col-span-2">
                  <p className="text-sm text-muted-foreground">Condizioni di partecipazione</p>
                  <p className="text-sm whitespace-pre-wrap">{opp.participation_conditions}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="criteria">
          <Card className="card-top-opportunities">
            <CardContent className="p-6">
              {criteria.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nessun criterio definito.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Criterio</TableHead>
                      <TableHead className="text-center">Peso %</TableHead>
                      <TableHead className="text-center">Punteggio max</TableHead>
                      <TableHead className="text-center">Soglia minima</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {criteria.map((c: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-center">{c.weight_pct}%</TableCell>
                        <TableCell className="text-center">{c.max_score}</TableCell>
                        <TableCell className="text-center">{c.min_score_threshold}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attachments">
          <OpportunityAttachments opportunityId={opp.id} readOnly={!hasGrant("manage_opportunity_attachments")} />
        </TabsContent>

        <TabsContent value="invitations">
          <Card className="card-top-opportunities">
            <CardContent className="p-6">
              {invitations.length === 0 ? (
                <EmptyState title="Nessun invito" description="Non sono stati ancora inviati inviti per questa opportunità." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fornitore</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Invitato il</TableHead>
                      <TableHead>Visualizzato il</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.suppliers?.company_name ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{inv.status}</Badge>
                        </TableCell>
                        <TableCell>{inv.invited_at ? format(new Date(inv.invited_at), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
                        <TableCell>{inv.viewed_at ? format(new Date(inv.viewed_at), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canInvite && (
          <TabsContent value="invite">
            <InviteSuppliers opportunityId={opp.id} categoryId={opp.category_id} tenantId={opp.tenant_id} />
          </TabsContent>
        )}

        {hasOrder && orderForOpp && (
          <TabsContent value="order">
            <Card className="card-top-orders">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" /> Ordine collegato
                  </CardTitle>
                  <Link to={`/internal/orders/${orderForOpp.id}`}>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" /> Vai al dettaglio
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Detail label="Codice" value={orderForOpp.code} />
                <Detail label="Stato" value={orderForOpp.status === "draft" ? "Bozza" : orderForOpp.status === "pending_approval" ? "In approvazione" : orderForOpp.status === "issued" ? "Emesso" : orderForOpp.status === "accepted" ? "Accettato" : orderForOpp.status === "completed" ? "Completato" : orderForOpp.status} />
                <Detail label="Oggetto" value={orderForOpp.subject} />
                <Detail label="Fornitore" value={(orderForOpp as any).suppliers?.company_name} />
                <Detail label="Importo" value={orderForOpp.amount != null ? `€ ${Number(orderForOpp.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : undefined} />
                <Detail label="Periodo" value={orderForOpp.start_date && orderForOpp.end_date ? `${orderForOpp.start_date} — ${orderForOpp.end_date}` : undefined} />
                {orderForOpp.description && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground">Descrizione</p>
                    <p className="text-sm whitespace-pre-wrap">{orderForOpp.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function InviteSuppliers({ opportunityId, categoryId, tenantId }: { opportunityId: string; categoryId: string | null; tenantId: string }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["invitable-suppliers", categoryId],
    queryFn: () => invitationService.getInvitableSuppliers(categoryId!),
    enabled: !!categoryId,
  });

  const { data: existing = [] } = useQuery({
    queryKey: ["invitations", opportunityId],
    queryFn: () => invitationService.getInvitationsByOpportunity(opportunityId),
  });

  const existingIds = new Set(existing.map((e) => e.supplier_id));
  const filtered = suppliers
    .filter((s: any) => !existingIds.has(s.id))
    .filter((s: any) => s.company_name.toLowerCase().includes(search.toLowerCase()));

  const sendMutation = useMutation({
    mutationFn: () =>
      invitationService.sendInvitations({
        opportunityId,
        supplierIds: Array.from(selected),
        tenantId,
        invitedBy: profile!.id,
      }),
    onSuccess: () => {
      toast.success(`${selected.size} invit${selected.size === 1 ? "o" : "i"} inviat${selected.size === 1 ? "o" : "i"}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["invitations", opportunityId] });
    },
    onError: (err: Error) => toast.error(err.message || "Errore nell'invio"),
  });

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((s: any) => s.id)));
    }
  };

  if (!categoryId) return <p className="p-4 text-muted-foreground">Nessuna categoria associata all'opportunità.</p>;

  return (
    <Card className="card-top-opportunities">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Seleziona fornitori da invitare</CardTitle>
          <Button onClick={() => sendMutation.mutate()} disabled={selected.size === 0 || sendMutation.isPending}>
            <Send className="mr-2 h-4 w-4" /> Invia {selected.size > 0 && `(${selected.size})`}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Filtra fornitori..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nessun fornitore qualificato trovato per questa categoria.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 pb-2 border-b">
              <Checkbox
                checked={selected.size === filtered.length && filtered.length > 0}
                onCheckedChange={toggleAll}
              />
              <span className="text-sm font-medium">Seleziona tutti ({filtered.length})</span>
            </div>
            <div className="max-h-[400px] overflow-y-auto space-y-1">
              {filtered.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded hover:bg-muted/50">
                  <Checkbox
                    checked={selected.has(s.id)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selected);
                      checked ? next.add(s.id) : next.delete(s.id);
                      setSelected(next);
                    }}
                  />
                  <span className="text-sm">{s.company_name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
