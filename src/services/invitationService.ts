import { supabase } from "@/integrations/supabase/client";
import { auditService } from "@/services/auditService";
import { notificationService } from "@/services/notificationService";
import type { OpportunityInvitation } from "@/types";

export const invitationService = {
  async getInvitableSuppliers(categoryId: string) {
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, company_name, status, supplier_categories!inner(category_id, status, valid_until)")
      .eq("status", "accredited")
      .is("deleted_at", null)
      .eq("supplier_categories.category_id", categoryId)
      .in("supplier_categories.status", ["qualified", "pending"]);
    if (error) throw error;
    // Filter valid_until client-side (null = no expiry, or > today)
    const today = new Date().toISOString().slice(0, 10);
    return (data ?? []).filter((s) => {
      const cats = s.supplier_categories as Array<{ category_id: string; status: string; valid_until: string | null }>;
      return cats.some(
        (sc) => sc.valid_until === null || sc.valid_until > today
      );
    });
  },

  async getInvitationsByOpportunity(opportunityId: string) {
    const { data, error } = await supabase
      .from("opportunity_invitations")
      .select("*, suppliers(company_name)")
      .eq("opportunity_id", opportunityId)
      .order("invited_at", { ascending: false });
    if (error) throw error;
    return data as (OpportunityInvitation & { suppliers: { company_name: string } })[];
  },

  async sendInvitations(params: {
    opportunityId: string;
    supplierIds: string[];
    tenantId: string;
    invitedBy: string;
  }) {
    const rows = params.supplierIds.map((sid) => ({
      opportunity_id: params.opportunityId,
      supplier_id: sid,
      invited_by: params.invitedBy,
      status: "sent" as const,
    }));

    const { data, error } = await supabase
      .from("opportunity_invitations")
      .insert(rows)
      .select();
    if (error) throw error;

    // Send notification to each supplier's profile
    for (const sid of params.supplierIds) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("supplier_id", sid)
        .limit(1)
        .maybeSingle();
      if (profile) {
        await notificationService.send({
          event_type: "opportunity_invited",
          recipient_id: profile.id,
          tenant_id: params.tenantId,
        });
      }
    }

    await auditService.log({
      tenant_id: params.tenantId,
      entity_type: "opportunity",
      entity_id: params.opportunityId,
      event_type: "invitations_sent",
      new_state: { supplier_ids: params.supplierIds, count: params.supplierIds.length },
    });

    return data;
  },

  /** Supplier-facing: list invitations for current supplier */
  async listForSupplier(supplierId: string) {
    const { data, error } = await supabase
      .from("opportunity_invitations")
      .select("*, opportunities(id, title, code, status, bids_deadline, category_id, categories:categories!opportunities_category_id_fkey(name))")
      .eq("supplier_id", supplierId)
      .order("invited_at", { ascending: false });
    if (error) throw error;
    return data as (OpportunityInvitation & { opportunities: Record<string, unknown> })[];
  },

  async markViewed(invitationId: string) {
    const { error } = await supabase
      .from("opportunity_invitations")
      .update({ viewed_at: new Date().toISOString(), status: "viewed" })
      .eq("id", invitationId);
    if (error) throw error;
  },
};
