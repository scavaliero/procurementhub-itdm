import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { grantService } from "@/services/grantService";
import { auditService } from "@/services/auditService";
import { useAuth } from "@/hooks/useAuth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { UserStatusBadge, getUserStatus } from "./UserStatusBadge";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  ShieldCheck,
  Mail,
  Clock,
  LogIn,
  CalendarDays,
  Save,
} from "lucide-react";
import type { Profile, Role } from "@/types";

interface Props {
  user: Profile | null;
  onClose: () => void;
}

export function UserInfoDrawer({ user, onClose }: Props) {
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
    enabled: !!user,
  });

  // Sync selected role when data loads
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

      // Remove old role if exists and different
      if (currentRole && currentRole !== selectedRoleId) {
        await grantService.unassignRole(user.id, currentRole);
      }
      // Assign new role if selected and different
      if (selectedRoleId && selectedRoleId !== currentRole) {
        await grantService.assignRole(user.id, selectedRoleId);
      }

      // Audit log
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
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleRoleChange = (roleId: string) => {
    setSelectedRoleId(roleId);
    const currentRole = userRoles.length > 0 ? userRoles[0] : null;
    setDirty(roleId !== currentRole);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Mai";
    return format(new Date(dateStr), "dd MMM yyyy, HH:mm", { locale: it });
  };

  const status = user ? getUserStatus(user) : "active";

  return (
    <Sheet open={!!user} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[420px] sm:w-[440px] overflow-y-auto">
        {user && (
          <>
            <SheetHeader>
              <SheetTitle className="text-base">{user.full_name}</SheetTitle>
            </SheetHeader>

            {/* User info section */}
            <div className="mt-5 space-y-4">
              <div className="flex items-center gap-2">
                <UserStatusBadge profile={user} />
              </div>

              <div className="grid gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <LogIn className="h-4 w-4 shrink-0" />
                  <span>Ultimo accesso: {formatDate(user.last_login_at)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>Ultima attività: {formatDate(user.updated_at)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  <span>Creato il: {formatDate(user.created_at)}</span>
                </div>
              </div>

              {status === "pending_confirmation" && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2">
                  L'utente non ha ancora confermato l'accesso tramite email.
                </p>
              )}
            </div>

            <Separator className="my-5" />

            {/* Role assignment section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Ruolo assegnato
              </h3>

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

              <Button
                className="w-full mt-3"
                disabled={!dirty || saveRoleMutation.isPending}
                onClick={() => saveRoleMutation.mutate()}
              >
                <Save className="h-4 w-4 mr-1" />
                {saveRoleMutation.isPending ? "Salvataggio…" : "Salva Ruolo"}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
