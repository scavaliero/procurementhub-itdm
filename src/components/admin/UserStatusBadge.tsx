import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle } from "lucide-react";
import type { Profile } from "@/types";

type UserStatus = "active" | "pending_confirmation" | "disabled";

export function getUserStatus(profile: Profile): UserStatus {
  if (!profile.is_active) return "disabled";
  if (!profile.last_login_at) return "pending_confirmation";
  return "active";
}

const config: Record<UserStatus, { label: string; variant: "default" | "outline" | "secondary"; icon: typeof Clock }> = {
  active: { label: "Attivo", variant: "default", icon: CheckCircle },
  pending_confirmation: { label: "In attesa di conferma", variant: "secondary", icon: Clock },
  disabled: { label: "Disattivato", variant: "outline", icon: XCircle },
};

export function UserStatusBadge({ profile }: { profile: Profile }) {
  const status = getUserStatus(profile);
  const { label, variant, icon: Icon } = config[status];

  return (
    <Badge variant={variant} className="gap-1 text-xs whitespace-nowrap">
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}
