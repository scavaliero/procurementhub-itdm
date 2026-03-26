import { supabase } from "@/integrations/supabase/client";
import { auditService } from "@/services/auditService";
import { notificationService } from "@/services/notificationService";
import type { Opportunity } from "@/types";
import type { Json } from "@/integrations/supabase/types";

export interface OpportunityFilters {
  status?: string;
  category_id?: string;
  internal_ref_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface EvaluationCriterion {
  name: string;
  weight_pct: number;
  max_score: number;
  min_score_threshold: number;
}

export const opportunityService = {
  async list(filters: OpportunityFilters = {}) {
    const page = filters.page ?? 0;
    const size = filters.pageSize ?? 25;
    const from = page * size;
    const to = from + size - 1;

    // Check if current user is a purchase operator (should only see own opportunities)
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id;
    const { data: isOperator } = await supabase.rpc("is_purchase_operator");

    let q = supabase
      .from("opportunities")
      .select("*, categories!opportunities_category_id_fkey(name), opportunity_invitations(id)", { count: "exact" })
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (isOperator === true && currentUserId) {
      q = q.eq("created_by", currentUserId);
    }

    if (filters.status) q = q.eq("status", filters.status);
    if (filters.category_id) q = q.eq("category_id", filters.category_id);
    if (filters.internal_ref_id) q = q.eq("internal_ref_id", filters.internal_ref_id);
    if (filters.date_from) q = q.gte("bids_deadline", filters.date_from);
    if (filters.date_to) q = q.lte("bids_deadline", filters.date_to);
    if (filters.search) q = q.ilike("title", `%${filters.search}%`);

    const { data, error, count } = await q;
    if (error) throw error;
    return { data: data as (Opportunity & { categories: { name: string } | null; opportunity_invitations: { id: string }[] })[], count: count ?? 0 };
  },

  async getStatusCounts() {
    const statuses = ["draft", "pending_approval", "open", "collecting_bids", "evaluating", "awarded", "closed"] as const;
    const counts: Record<string, number> = {};
    for (const s of statuses) {
      const { count } = await supabase
        .from("opportunities")
        .select("id", { count: "exact", head: true })
        .eq("status", s)
        .is("deleted_at", null);
      counts[s] = count ?? 0;
    }
    return counts;
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from("opportunities")
      .select("*, categories!opportunities_category_id_fkey(name, code)")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as Opportunity & { categories: { name: string; code: string } | null };
  },

  async create(opp: {
    tenant_id: string;
    title: string;
    description?: string;
    category_id?: string;
    internal_ref_id?: string;
    requesting_unit?: string;
    opens_at?: string;
    bids_deadline?: string;
    start_date?: string;
    end_date?: string;
    budget_estimated?: number;
    budget_max?: number;
    evaluation_criteria?: EvaluationCriterion[];
    participation_conditions?: string;
    operational_notes?: string;
    status: string;
    created_by?: string;
  }) {
    const { data, error } = await supabase
      .from("opportunities")
      .insert({
        ...opp,
        evaluation_criteria: opp.evaluation_criteria ? (opp.evaluation_criteria as unknown as Json) : [],
      })
      .select()
      .single();
    if (error) throw error;

    await auditService.log({
      tenant_id: opp.tenant_id,
      entity_type: "opportunity",
      entity_id: data.id,
      event_type: "opportunity_created",
      new_state: { status: opp.status, title: opp.title },
    });

    return data as Opportunity;
  },

  async update(id: string, updates: Partial<Opportunity>) {
    const { data, error } = await supabase
      .from("opportunities")
      .update(updates as unknown as Record<string, unknown>)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Opportunity;
  },

  async uploadAttachment(opportunityId: string, file: File, attachmentType?: string) {
    const ext = file.name.split(".").pop();
    const folder = attachmentType
      ? `${opportunityId}/${attachmentType}`
      : opportunityId;
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("opportunity-attachments")
      .upload(path, file);
    if (error) throw error;
    return path;
  },

  async listAttachments(opportunityId: string) {
    const { data, error } = await supabase.storage
      .from("opportunity-attachments")
      .list(opportunityId);
    if (error) throw error;
    return data ?? [];
  },

  async listTypedAttachments(opportunityId: string, attachmentType: string) {
    const { data, error } = await supabase.storage
      .from("opportunity-attachments")
      .list(`${opportunityId}/${attachmentType}`);
    if (error) throw error;
    return (data ?? []).filter((f) => f.name !== ".emptyFolderPlaceholder");
  },

  async deleteAttachment(path: string) {
    const { error } = await supabase.storage
      .from("opportunity-attachments")
      .remove([path]);
    if (error) throw error;
  },

  async getAttachmentUrl(path: string) {
    const { data, error } = await supabase.storage
      .from("opportunity-attachments")
      .createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  },

  async getInternalProfiles(): Promise<{ id: string; full_name: string; email: string }[]> {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("user_type", "internal")
      .eq("is_active", true)
      .order("full_name");
    if (error) throw error;
    return data ?? [];
  },

  /** Notify all invited suppliers that the opportunity has been updated */
  async notifyInvitedSuppliersOfUpdate(params: {
    opportunityId: string;
    tenantId: string;
    opportunityTitle: string;
    opportunityCode: string;
    invitations: { supplier_id: string }[];
  }) {
    const uniqueSupplierIds = [...new Set(params.invitations.map((i) => i.supplier_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, supplier_id")
      .in("supplier_id", uniqueSupplierIds);

    if (!profiles) return;

    for (const sp of profiles) {
      try {
        await notificationService.send({
          event_type: "opportunity_updated",
          recipient_id: sp.id,
          tenant_id: params.tenantId,
          link_url: `/supplier/opportunities/${params.opportunityId}`,
          related_entity_id: params.opportunityId,
          related_entity_type: "opportunity",
          variables: {
            opportunity_title: params.opportunityTitle,
            opportunity_code: params.opportunityCode,
          },
        });
      } catch (e) {
        console.warn("Non-blocking notification error:", e);
      }
    }
  },
};
