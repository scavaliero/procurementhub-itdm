import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { authService } from "@/services/authService";
import { useAuth } from "./useAuth";

export function useGrants() {
  const { user } = useAuth();

  const { data: grants = [] } = useQuery<string[]>({
    queryKey: ["grants"],
    queryFn: () => authService.getUserGrants(),
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  const hasGrant = useCallback(
    (grantName: string) => grants.includes(grantName),
    [grants]
  );

  return { grants, hasGrant };
}
