import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { grantService } from "@/services/grantService";
import { auditService } from "@/services/auditService";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { Plus, ShieldCheck, UserCircle } from "lucide-react";
import type { Profile, Role } from "@/types";

export default function AdminUsers() {
  const { profile: currentProfile } = useAuth();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["internal-profiles"],
    queryFn: () => grantService.listProfiles("internal"),
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: () => grantService.listRoles(),
  });

  const { data: userRoles = [] } = useQuery({
    queryKey: ["user-roles", selectedUser?.id],
    queryFn: () => grantService.getUserRoles(selectedUser!.id),
    enabled: !!selectedUser,
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      // Use edge function for admin invite
      const { supabase } = await import("@/integrations/supabase/client");
      // Create profile directly since we can't use admin APIs from client
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: inviteEmail,
        password: crypto.randomUUID() + "Aa1!", // Temp password, user resets via email
        options: {
          data: { full_name: inviteName },
          emailRedirectTo: window.location.origin,
        },
      });
      if (authErr) throw authErr;
      if (!authData.user) throw new Error("Utente non creato");

      // Insert profile
      const { error: profErr } = await supabase.from("profiles").insert({
        id: authData.user.id,
        email: inviteEmail,
        full_name: inviteName,
        user_type: "internal",
        tenant_id: currentProfile!.tenant_id,
      });
      if (profErr) throw profErr;
    },
    onSuccess: () => {
      toast.success("Utente invitato");
      qc.invalidateQueries({ queryKey: ["internal-profiles"] });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleRoleMutation = useMutation({
    mutationFn: async ({ roleId, assign }: { roleId: string; assign: boolean }) => {
      if (assign) {
        await grantService.assignRole(selectedUser!.id, roleId);
      } else {
        await grantService.unassignRole(selectedUser!.id, roleId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-roles", selectedUser?.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestione Utenti</h1>
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Invita Utente
        </Button>
      </div>

      {profiles.length === 0 ? (
        <EmptyState title="Nessun utente interno" />
      ) : (
        <div className="space-y-2">
          {(profiles as Profile[]).map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer hover:shadow-sm transition-shadow"
              onClick={() => setSelectedUser(p)}
            >
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserCircle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground">{p.email}</p>
                  </div>
                </div>
                <Badge variant={p.is_active ? "default" : "outline"}>
                  {p.is_active ? "Attivo" : "Inattivo"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invita Utente Interno</DialogTitle>
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

      {/* User roles drawer */}
      <Sheet open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <SheetContent className="w-[400px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Ruoli: {selectedUser?.full_name}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {roles.map((role) => {
              const isAssigned = userRoles.includes(role.id);
              return (
                <label
                  key={role.id}
                  className={`flex items-center gap-3 border rounded-lg p-3 cursor-pointer transition-colors ${
                    isAssigned ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"
                  }`}
                >
                  <Checkbox
                    checked={isAssigned}
                    onCheckedChange={(checked) =>
                      toggleRoleMutation.mutate({ roleId: role.id, assign: !!checked })
                    }
                  />
                  <div>
                    <p className="text-sm font-medium">{role.name}</p>
                    {role.description && (
                      <p className="text-xs text-muted-foreground">{role.description}</p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
