import { useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { grantService } from "@/services/grantService";
import { auditService } from "@/services/auditService";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { Plus, Settings, Users, Pencil, Trash2 } from "lucide-react";
import type { Role, Grant } from "@/types";

export default function AdminRoles() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Delete confirmation state
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => grantService.listRoles(),
  });

  const { data: grants = [] } = useQuery({
    queryKey: ["all-grants"],
    queryFn: () => grantService.listGrants(),
  });

  const { data: userCounts = {} } = useQuery({
    queryKey: ["user-roles-count"],
    queryFn: () => grantService.getUserRolesCount(),
  });

  const { data: roleGrants = [] } = useQuery({
    queryKey: ["role-grants", selectedRole?.id],
    queryFn: () => grantService.getRoleGrants(selectedRole!.id),
    enabled: !!selectedRole,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      grantService.createRole({
        name: newRoleName,
        description: newRoleDesc || undefined,
        tenant_id: profile!.tenant_id,
      }),
    onSuccess: () => {
      toast.success("Ruolo creato");
      qc.invalidateQueries({ queryKey: ["roles"] });
      setCreateOpen(false);
      setNewRoleName("");
      setNewRoleDesc("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      grantService.updateRole(selectedRole!.id, {
        name: editName,
        description: editDesc || undefined,
      }),
    onSuccess: (updated) => {
      toast.success("Ruolo aggiornato");
      qc.invalidateQueries({ queryKey: ["roles"] });
      setSelectedRole(updated);
      setEditOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => grantService.deleteRole(selectedRole!.id),
    onSuccess: () => {
      toast.success("Ruolo eliminato");
      qc.invalidateQueries({ queryKey: ["roles"] });
      qc.invalidateQueries({ queryKey: ["user-roles-count"] });
      setDeleteOpen(false);
      setSelectedRole(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleGrantMutation = useMutation({
    mutationFn: async ({ grantId, add }: { grantId: string; add: boolean }) => {
      if (add) {
        await grantService.addRoleGrant(selectedRole!.id, grantId);
      } else {
        await grantService.removeRoleGrant(selectedRole!.id, grantId);
      }
      if (profile) {
        await auditService.log({
          tenant_id: profile.tenant_id,
          entity_type: "role_grants",
          entity_id: selectedRole!.id,
          event_type: add ? "grant_assigned" : "grant_removed",
          new_state: { role_id: selectedRole!.id, grant_id: grantId, action: add ? "add" : "remove" },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-grants", selectedRole?.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openEdit = () => {
    if (!selectedRole) return;
    setEditName(selectedRole.name);
    setEditDesc(selectedRole.description || "");
    setEditOpen(true);
  };

  if (isLoading) return <PageSkeleton />;

  // Group grants by module
  const grantsByModule: Record<string, Grant[]> = {};
  grants.forEach((g) => {
    if (!grantsByModule[g.module]) grantsByModule[g.module] = [];
    grantsByModule[g.module].push(g);
  });

  const canModifySelected = selectedRole && !selectedRole.is_system;

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: "Dashboard", href: "/internal/dashboard" }, { label: "Gestione Ruoli" }]} />
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 section-accent-bar">
          <span className="text-base">🛡️</span>
          Gestione Ruoli
        </h2>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nuovo Ruolo
        </Button>
      </div>

      {roles.length === 0 ? (
        <EmptyState title="Nessun ruolo" description="Crea il primo ruolo." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role) => (
            <Card
              key={role.id}
              className="cursor-pointer hover:shadow-md transition-shadow card-top-admin"
              onClick={() => setSelectedRole(role)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{role.name}</CardTitle>
                  {role.is_system && <Badge variant="secondary" className="text-xs">Sistema</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{role.description || "—"}</p>
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {userCounts[role.id] || 0} utenti
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuovo Ruolo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrizione</Label>
              <Input value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annulla</Button>
            <Button disabled={!newRoleName} onClick={() => createMutation.mutate()}>Crea</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Ruolo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrizione</Label>
              <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annulla</Button>
            <Button disabled={!editName || updateMutation.isPending} onClick={() => updateMutation.mutate()}>
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina Ruolo</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare il ruolo <strong>{selectedRole?.name}</strong>?
              Verranno rimossi anche tutti i permessi e le assegnazioni utente associate.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Annulla</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grants drawer */}
      <Sheet open={!!selectedRole} onOpenChange={(open) => !open && setSelectedRole(null)}>
        <SheetContent className="w-[400px] sm:w-[500px] overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center justify-between pr-2">
              <SheetTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Permessi: {selectedRole?.name}
              </SheetTitle>
              {canModifySelected && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={openEdit}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            {selectedRole?.is_system && (
              <p className="text-xs text-muted-foreground">Ruolo di sistema — non modificabile nome/eliminazione</p>
            )}
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {Object.entries(grantsByModule).map(([module, moduleGrants]) => (
              <div key={module}>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  {module}
                </h3>
                <div className="space-y-2">
                  {moduleGrants.map((grant) => {
                    const isAssigned = roleGrants.includes(grant.id);
                    return (
                      <div
                        key={grant.id}
                        className="flex items-center justify-between py-1.5"
                      >
                        <div>
                          <p className="text-sm">{grant.name}</p>
                          {grant.description && (
                            <p className="text-xs text-muted-foreground">
                              {grant.description}
                            </p>
                          )}
                        </div>
                        <Switch
                          checked={isAssigned}
                          onCheckedChange={(checked) =>
                            toggleGrantMutation.mutate({
                              grantId: grant.id,
                              add: checked,
                            })
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}