import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { grantService } from "@/services/grantService";
import { auditService } from "@/services/auditService";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Save, ShieldCheck } from "lucide-react";
import type { Profile, Role } from "@/types";

interface Props {
  user: Profile | null;
  open: boolean;
  onClose: () => void;
}

export function ManageRoleDialog({ user, open, onClose }: Props) {
  const { profile: currentProfile } = useAuth();
  const qc = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: () => grantService.listRoles(),
  });

  const { data: userRoles = [], isSuccess: rolesLoaded } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: () => grantService.getUserRoles(user!.id),
    enabled: !!user && open,
  });

  useEffect(() => {
    if (rolesLoaded) {
      setSelectedRoleId(userRoles.length > 0 ? userRoles[0] : null);
      setDirty(false);
    }
  }, [rolesLoaded, userRoles]);

  const saveRoleMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const currentRole = userRoles.length > 0 ? userRoles[0] : null;

      if (currentRole && currentRole !== selectedRoleId) {
        await grantService.unassignRole(user.id, currentRole);
      }
      if (selectedRoleId && selectedRoleId !== currentRole) {
        await grantService.assignRole(user.id, selectedRoleId);
      }

      if (currentProfile && currentRole !== selectedRoleId) {
        await auditService.log({
          tenant_id: currentProfile.tenant_id,
          entity_type: "user_roles",
          entity_id: user.id,
          event_type: "role_changed",
          old_state: { role_id: currentRole },
          new_state: { role_id: selectedRoleId },
        });
      }
    },
    onSuccess: () => {
      toast.success("Ruolo aggiornato");
      qc.invalidateQueries({ queryKey: ["user-roles", user?.id] });
      setDirty(false);
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleRoleChange = (roleId: string) => {
    setSelectedRoleId(roleId);
    const currentRole = userRoles.length > 0 ? userRoles[0] : null;
    setDirty(roleId !== currentRole);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Gestisci Ruolo: {user?.full_name}
          </DialogTitle>
          <DialogDescription>
            Seleziona il ruolo da assegnare all'utente. Ogni utente può avere un solo ruolo.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={selectedRoleId ?? ""}
          onValueChange={handleRoleChange}
          className="space-y-2"
        >
          {roles.map((role: Role) => (
            <label
              key={role.id}
              className={`flex items-center gap-3 border rounded-lg p-3 cursor-pointer transition-colors ${
                selectedRoleId === role.id
                  ? "border-primary bg-primary/5"
                  : "hover:border-muted-foreground/30"
              }`}
            >
              <RadioGroupItem value={role.id} />
              <div className="min-w-0">
                <p className="text-sm font-medium">{role.name}</p>
                {role.description && (
                  <p className="text-xs text-muted-foreground">{role.description}</p>
                )}
              </div>
            </label>
          ))}
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button
            disabled={!dirty || saveRoleMutation.isPending}
            onClick={() => saveRoleMutation.mutate()}
          >
            <Save className="h-4 w-4 mr-1" />
            {saveRoleMutation.isPending ? "Salvataggio…" : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
