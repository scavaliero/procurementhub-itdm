import { supabase } from "@/integrations/supabase/client";
import type { Profile, UserEffectiveGrant } from "@/types";

export const authService = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signUp(email: string, password: string, metadata?: { full_name?: string }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentProfile(): Promise<Profile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;
    return data as Profile | null;
  },

  async getUserGrants(): Promise<string[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("user_effective_grants")
      .select("grant_name")
      .eq("user_id", user.id);

    if (error) throw error;
    return (data as UserEffectiveGrant[])
      .map((g) => g.grant_name)
      .filter((n): n is string => n !== null);
  },

  async inviteInternalUser(params: {
    email: string;
    fullName: string;
    tenantId: string;
  }): Promise<string> {
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: params.email,
      password: crypto.randomUUID() + "Aa1!",
      options: {
        data: { full_name: params.fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (authErr) throw authErr;
    if (!authData.user) throw new Error("Utente non creato");

    const { error: profErr } = await supabase.from("profiles").insert({
      id: authData.user.id,
      email: params.email,
      full_name: params.fullName,
      user_type: "internal",
      tenant_id: params.tenantId,
    });
    if (profErr) throw profErr;

    return authData.user.id;
  },
};
