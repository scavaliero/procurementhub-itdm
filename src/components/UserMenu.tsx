import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { User, KeyRound, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface UserMenuProps {
  /** Base path prefix, e.g. "/internal" or "/supplier" */
  basePath: string;
}

export function UserMenu({ basePath }: UserMenuProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  if (!profile) return null;

  const initials = profile.full_name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-primary-foreground hover:bg-primary-foreground/10 gap-2 px-2"
        >
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline text-sm font-medium">{profile.full_name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{profile.full_name}</p>
          <p className="text-xs text-muted-foreground">{profile.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate(`${basePath}/profile`)}>
          <User className="h-4 w-4 mr-2" />
          Il mio profilo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(`${basePath}/change-password`)}>
          <KeyRound className="h-4 w-4 mr-2" />
          Cambia password
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
