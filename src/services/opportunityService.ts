import { supabase } from "@/integrations/supabase/client";
import { auditService } from "@/services/auditService";
import { notificationService } from "@/services/notificationService";
import type { Opportunity } from "@/types";

export interface OpportunityFilters {
  status?: string;
  category_id?: string;
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

    let q = supabase
      .from("opportunities")
      .select("*, categories!opportunities_category_id_fkey(name), opportunity_invitations(id)", { count: "exact" })
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filters.status) q = q.eq("status", filters.status);
    if (filters.category_id) q = q.eq("category_id", filters.category_id);
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
        evaluation_criteria: opp.evaluation_criteria ? (opp.evaluation_criteria as any) : [],
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
      .update(updates as any)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Opportunity;
  },

  async uploadAttachment(opportunityId: string, file: File) {
    const ext = file.name.split(".").pop();
    const path = `${opportunityId}/${crypto.randomUUID()}.${ext}`;
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
};
