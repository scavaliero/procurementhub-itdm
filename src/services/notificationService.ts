import { supabase } from "@/integrations/supabase/client";
import type { Notification } from "@/types";

export const notificationService = {
  async send(params: {
    event_type: string;
    recipient_id: string;
    tenant_id: string;
    variables?: Record<string, string>;
    link_url?: string;
    related_entity_id?: string;
    related_entity_type?: string;
  }) {
    const { data, error } = await supabase.functions.invoke("send-notification", {
      body: params,
    });
    if (error) throw error;
    return data;
  },

  async list(userId: string, limit = 20): Promise<Notification[]> {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data as Notification[];
  },

  async listPaginated(userId: string, page: number, pageSize = 20, onlyUnread = false) {
    let query = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("recipient_id", userId);

    if (onlyUnread) {
      query = query.eq("is_read", false);
    }

    const from = (page - 1) * pageSize;
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    return { data: data as Notification[], count: count ?? 0 };
  },

  async countUnread(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .eq("is_read", false);
    if (error) throw error;
    return count ?? 0;
  },

  async markRead(id: string) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },

  async markAllRead(userId: string) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("recipient_id", userId)
      .eq("is_read", false);
    if (error) throw error;
  },

  /** @deprecated Use markRead instead */
  async markAsRead(id: string) {
    return this.markRead(id);
  },
};
