import { useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { grantService } from "@/services/grantService";
import { authService } from "@/services/authService";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { UserStatusBadge } from "@/components/admin/UserStatusBadge";
import { UserInfoDrawer } from "@/components/admin/UserInfoDrawer";
import { ManageRoleDialog } from "@/components/admin/ManageRoleDialog";
import { toast } from "sonner";
import {
  Plus,
  ShieldCheck,
  UserCircle,
  MoreVertical,
  Mail,
  UserCheck,
  UserX,
  Trash2,
} from "lucide-react";
import type { Profile } from "@/types";

export default function AdminUsers() {
  const { profile: currentProfile } = useAuth();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [roleUser, setRoleUser] = useState<Profile | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    action: string;
    user: Profile;
    label: string;
    description: string;
    variant: "default" | "destructive";
  } | null>(null);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["internal-profiles"],
    queryFn: () => grantService.listProfiles("internal"),
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      await authService.inviteInternalUser({
        email: inviteEmail,
        fullName: inviteName,
        tenantId: currentProfile!.tenant_id,
      });
    },
    onSuccess: () => {
      toast.success("Utente invitato — email con link per impostare la password inviata");
      qc.invalidateQueries({ queryKey: ["internal-profiles"] });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const manageUserMutation = useMutation({
    mutationFn: async ({ action, userId }: { action: string; userId: string }) => {
      return authService.manageUser(action, userId);
    },
    onSuccess: (data) => {
      toast.success(data.message || "Operazione completata");
      qc.invalidateQueries({ queryKey: ["internal-profiles"] });
      setConfirmAction(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setConfirmAction(null);
    },
  });

  const handleAction = (action: string, user: Profile) => {
    const actions: Record<string, { label: string; description: string; variant: "default" | "destructive" }> = {
      resend_invite: {
        label: "Re-invia Invito",
        description: `Verrà inviata una nuova email a ${user.email} con il link per impostare la password.`,
        variant: "default",
      },
      activate: {
        label: "Attiva Utente",
        description: `L'utente ${user.full_name} verrà riattivato e potrà accedere nuovamente alla piattaforma.`,
        variant: "default",
      },
      deactivate: {
        label: "Disattiva Utente",
        description: `L'utente ${user.full_name} verrà disattivato e non potrà più accedere alla piattaforma.`,
        variant: "destructive",
      },
      delete: {
        label: "Elimina Utente",
        description: `L'utente ${user.full_name} (${user.email}) verrà eliminato definitivamente. Questa azione è irreversibile.`,
        variant: "destructive",
      },
    };
    const cfg = actions[action];
    if (cfg) setConfirmAction({ action, user, ...cfg });
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="p-4 sm:p-6 space-y-6 min-w-0">
      <Breadcrumb items={[{ label: "Dashboard", href: "/internal" }, { label: "Gestione Utenti" }]} />
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 section-accent-bar">
          <span className="text-base">👥</span>
          Gestione Utenti
        </h2>
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Invita Utente
        </Button>
      </div>

      {profiles.length === 0 ? (
        <EmptyState title="Nessun utente interno" />
      ) : (
        <div className="space-y-2">
          {(profiles as Profile[]).map((p) => {
            const isSelf = p.id === currentProfile?.id;
            return (
              <Card key={p.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="py-3 flex items-center justify-between gap-2">
                  <div
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                    onClick={() => setSelectedUser(p)}
                  >
                    <UserCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {p.full_name}
                        {isSelf && (
                          <span className="text-xs text-muted-foreground ml-2">(tu)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <UserStatusBadge profile={p} />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedUser(p)}>
                          <ShieldCheck className="h-4 w-4 mr-2" />
                          Dettagli & Ruoli
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction("resend_invite", p)}>
                          <Mail className="h-4 w-4 mr-2" />
                          Re-invia Invito
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {p.is_active ? (
                          <DropdownMenuItem
                            onClick={() => handleAction("deactivate", p)}
                            disabled={isSelf}
                            className="text-destructive/80"
                          >
                            <UserX className="h-4 w-4 mr-2" />
                            Disattiva
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleAction("activate", p)}>
                            <UserCheck className="h-4 w-4 mr-2" />
                            Riattiva
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleAction("delete", p)}
                          disabled={isSelf}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invita Utente Interno</DialogTitle>
            <DialogDescription>
              L'utente riceverà un'email con un link per impostare la password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome completo *</Label>
              <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Annulla</Button>
            <Button
              disabled={!inviteEmail || !inviteName || inviteMutation.isPending}
              onClick={() => inviteMutation.mutate()}
            >
              {inviteMutation.isPending ? "Invio…" : "Invita"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmAction?.label}</DialogTitle>
            <DialogDescription>{confirmAction?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Annulla
            </Button>
            <Button
              variant={confirmAction?.variant || "default"}
              disabled={manageUserMutation.isPending}
              onClick={() => {
                if (confirmAction) {
                  manageUserMutation.mutate({
                    action: confirmAction.action,
                    userId: confirmAction.user.id,
                  });
                }
              }}
            >
              {manageUserMutation.isPending ? "Elaborazione…" : "Conferma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User info & roles drawer */}
      <UserInfoDrawer user={selectedUser} onClose={() => setSelectedUser(null)} />
    </div>
  );
}
