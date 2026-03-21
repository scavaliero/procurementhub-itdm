import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { authService } from "@/services/authService";
import type { Profile } from "@/types";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setIsLoading(false);
        if (!session?.user) {
          qc.removeQueries({ queryKey: ["profile"] });
          qc.removeQueries({ queryKey: ["grants"] });
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [qc]);

  const { data: profile, isLoading: profileLoading } = useQuery<Profile | null>({
    queryKey: ["profile"],
    queryFn: () => authService.getCurrentProfile(),
    enabled: !!user,
  });

  const signOut = useCallback(async () => {
    await authService.signOut();
    qc.clear();
  }, [qc]);

  return {
    user,
    profile: profile ?? null,
    isLoading: isLoading || (!!user && profileLoading),
    signOut,
  };
}
