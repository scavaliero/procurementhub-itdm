import { supabase } from "@/integrations/supabase/client";

export const auditService = {
  async log(params: {
    tenant_id: string;
    entity_type: string;
    entity_id: string;
    event_type: string;
    old_state?: Record<string, unknown>;
    new_state?: Record<string, unknown>;
  }) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("audit_logs").insert({
      ...params,
      user_id: user?.id || null,
      user_email: user?.email || null,
      old_state: params.old_state || null,
      new_state: params.new_state || null,
    });
    if (error) console.error("Audit log error:", error);
  },
};
