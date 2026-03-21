import { supabase } from "@/integrations/supabase/client";

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
};
