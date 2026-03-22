import { useQuery } from "@tanstack/react-query";
import { grantService } from "@/services/grantService";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { UserStatusBadge, getUserStatus } from "./UserStatusBadge";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  Mail,
  Clock,
  LogIn,
  CalendarDays,
  ShieldCheck,
  Phone,
} from "lucide-react";
import type { Profile, Role } from "@/types";

interface Props {
  user: Profile | null;
  onClose: () => void;
}

export function UserInfoDrawer({ user, onClose }: Props) {
  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: () => grantService.listRoles(),
  });

  const { data: userRoles = [] } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: () => grantService.getUserRoles(user!.id),
    enabled: !!user,
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Mai";
    return format(new Date(dateStr), "dd MMM yyyy, HH:mm", { locale: it });
  };

  const status = user ? getUserStatus(user) : "active";
  const assignedRole = roles.find((r: Role) => userRoles.includes(r.id));

  return (
    <Sheet open={!!user} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[420px] sm:w-[440px] overflow-y-auto">
        {user && (
          <>
            <SheetHeader>
              <SheetTitle className="text-base">{user.full_name}</SheetTitle>
            </SheetHeader>

            <div className="mt-5 space-y-5">
              {/* Status */}
              <div className="flex items-center gap-2">
                <UserStatusBadge profile={user} />
              </div>

              {status === "pending_confirmation" && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2">
                  L'utente non ha ancora confermato l'accesso tramite email.
                </p>
              )}

              <Separator />

              {/* Contact info */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contatti</h3>
                <div className="grid gap-2.5 text-sm">
                  <div className="flex items-center gap-2 text-foreground">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  {user.phone && (
                    <div className="flex items-center gap-2 text-foreground">
                      <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>{user.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Activity */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Attività</h3>
                <div className="grid gap-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <LogIn className="h-4 w-4 shrink-0" />
                      <span>Ultimo accesso</span>
                    </div>
                    <span className="text-foreground text-xs">{formatDate(user.last_login_at)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4 shrink-0" />
                      <span>Ultima attività</span>
                    </div>
                    <span className="text-foreground text-xs">{formatDate(user.updated_at)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-4 w-4 shrink-0" />
                      <span>Creato il</span>
                    </div>
                    <span className="text-foreground text-xs">{formatDate(user.created_at)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Role */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ruolo</h3>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  {assignedRole ? (
                    <Badge variant="secondary">{assignedRole.name}</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">Nessun ruolo assegnato</span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
