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
} from "@/components/ui/dialog";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { Plus, Settings, Users } from "lucide-react";
import type { Role, Grant } from "@/types";

export default function AdminRoles() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => grantService.listRoles(),
  });

  const { data: grants = [] } = useQuery({
    queryKey: ["grants"],
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

  if (isLoading) return <PageSkeleton />;

  // Group grants by module
  const grantsByModule: Record<string, Grant[]> = {};
  grants.forEach((g) => {
    if (!grantsByModule[g.module]) grantsByModule[g.module] = [];
    grantsByModule[g.module].push(g);
  });

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: "Dashboard", href: "/internal" }, { label: "Gestione Ruoli" }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestione Ruoli</h1>
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
              className="cursor-pointer hover:shadow-md transition-shadow"
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

      {/* Grants drawer */}
      <Sheet open={!!selectedRole} onOpenChange={(open) => !open && setSelectedRole(null)}>
        <SheetContent className="w-[400px] sm:w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Permessi: {selectedRole?.name}
            </SheetTitle>
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
