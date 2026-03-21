import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

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
    const { error } = await supabase.from("audit_logs").insert([{
      tenant_id: params.tenant_id,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      event_type: params.event_type,
      user_id: user?.id || null,
      user_email: user?.email || null,
      old_state: (params.old_state as unknown as Json) || null,
      new_state: (params.new_state as unknown as Json) || null,
    }]);
    if (error) console.error("Audit log error:", error);
  },
};
