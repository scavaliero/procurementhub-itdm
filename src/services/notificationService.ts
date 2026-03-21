import { supabase } from "@/integrations/supabase/client";
import type { Notification } from "@/types";

export const notificationService = {
  async send(params: {
    event_type: string;
    recipient_id: string;
    tenant_id: string;
    variables?: Record<string, string>;
  }) {
    const { data, error } = await supabase.functions.invoke("send-notification", {
      body: params,
    });
    if (error) throw error;
    return data;
  },

  async list(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data as Notification[];
  },

  async markAsRead(id: string) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },
};