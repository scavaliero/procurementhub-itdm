import { supabase } from "@/integrations/supabase/client";
import type { Profile, UserEffectiveGrant } from "@/types";

export const authService = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Update last_login_at on profile
    if (data.user) {
      supabase
        .from("profiles")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", data.user.id)
        .then(({ error: updErr }) => {
          if (updErr) console.error("Failed to update last_login_at:", updErr);
        });
    }

    // Log login event asynchronously (don't block login flow)
    this.logAuthEvent(data.user?.id ?? null, email, "login").catch((e) => console.error("Audit login fire-and-forget error:", e));

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
    // Log logout event before signing out
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await this.logAuthEvent(user.id, user.email || "", "logout");
      }
    } catch (e) { console.error("Audit logout exception:", e); }

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async logAuthEvent(userId: string | null, email: string, eventType: "login" | "logout") {
    try {
      const profile = await this.getCurrentProfile();
      if (!profile) {
        console.warn(`Audit ${eventType}: no profile found`);
        return;
      }
      const newState = eventType === "login" ? { method: "password" } : undefined;
      const { error: auditErr } = await supabase.rpc("insert_audit_log", {
        p_tenant_id: profile.tenant_id,
        p_entity_type: "auth",
        p_entity_id: userId,
        p_event_type: eventType,
        p_old_state: null,
        p_new_state: newState ? JSON.parse(JSON.stringify(newState)) : null,
      });
      if (auditErr) {
        console.error(`Audit ${eventType} insert error:`, auditErr);
      } else {
        console.info(`Audit ${eventType} logged for ${email}`);
      }
    } catch (e) {
      console.error(`Audit ${eventType} exception:`, e);
    }
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
    const { data, error } = await supabase.functions.invoke("invite-user", {
      body: {
        email: params.email,
        full_name: params.fullName,
        tenant_id: params.tenantId,
        redirect_to: `${window.location.origin}/reset-password`,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data.userId;
  },

  async manageUser(action: string, userId: string): Promise<{ success: boolean; message: string }> {
    const { data, error } = await supabase.functions.invoke("manage-internal-user", {
      body: {
        action,
        user_id: userId,
        redirect_to: `${window.location.origin}/reset-password`,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  },
};
