import { supabase } from "@/integrations/supabase/client";
import type { Role, Grant } from "@/types";

export const grantService = {
  async listRoles(): Promise<Role[]> {
    const { data, error } = await supabase
      .from("roles")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw error;
    return data as Role[];
  },

  async createRole(role: { name: string; description?: string; tenant_id: string }) {
    const { data, error } = await supabase
      .from("roles")
      .insert(role)
      .select()
      .single();
    if (error) throw error;
    return data as Role;
  },

  async updateRole(id: string, updates: Partial<Role>) {
    const { data, error } = await supabase
      .from("roles")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Role;
  },

  async listGrants(): Promise<Grant[]> {
    const { data, error } = await supabase
      .from("grants")
      .select("*")
      .order("module", { ascending: true });
    if (error) throw error;
    return data as Grant[];
  },

  async getRoleGrants(roleId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("role_grants")
      .select("grant_id")
      .eq("role_id", roleId);
    if (error) throw error;
    return data.map((rg) => rg.grant_id);
  },

  async addRoleGrant(roleId: string, grantId: string) {
    const { error } = await supabase
      .from("role_grants")
      .insert({ role_id: roleId, grant_id: grantId });
    if (error) throw error;
  },

  async removeRoleGrant(roleId: string, grantId: string) {
    const { error } = await supabase
      .from("role_grants")
      .delete()
      .eq("role_id", roleId)
      .eq("grant_id", grantId);
    if (error) throw error;
  },

  async getUserRolesCount(): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role_id");
    if (error) throw error;
    const counts: Record<string, number> = {};
    data.forEach((ur) => {
      counts[ur.role_id] = (counts[ur.role_id] || 0) + 1;
    });
    return counts;
  },

  async listProfiles(userType?: string) {
    let query = supabase
      .from("profiles")
      .select("*")
      .order("full_name", { ascending: true });
    if (userType) query = query.eq("user_type", userType);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getUserRoles(userId: string) {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role_id")
      .eq("user_id", userId);
    if (error) throw error;
    return data.map((ur) => ur.role_id);
  },

  async assignRole(userId: string, roleId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role_id: roleId, assigned_by: user?.id });
    if (error) throw error;
  },

  async unassignRole(userId: string, roleId: string) {
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role_id", roleId);
    if (error) throw error;
  },
};
