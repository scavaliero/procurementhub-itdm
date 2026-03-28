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
    const { error } = await supabase.rpc("insert_audit_log", {
      p_tenant_id: params.tenant_id,
      p_entity_type: params.entity_type,
      p_entity_id: params.entity_id,
      p_event_type: params.event_type,
      p_old_state: params.old_state ? JSON.parse(JSON.stringify(params.old_state)) : null,
      p_new_state: params.new_state ? JSON.parse(JSON.stringify(params.new_state)) : null,
    });
    if (error) console.error("Audit log error:", error);
  },
};
