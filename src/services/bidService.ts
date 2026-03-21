import { supabase } from "@/integrations/supabase/client";
import { auditService } from "@/services/auditService";
import { notificationService } from "@/services/notificationService";
import type { Bid, BidEvaluation } from "@/types";

export interface BidDraft {
  opportunity_id: string;
  supplier_id: string;
  tenant_id: string;
  invitation_id?: string;
  total_amount?: number;
  economic_detail?: Record<string, unknown>;
  technical_description?: string;
  execution_days?: number;
  bid_validity_date?: string;
  proposed_conditions?: string;
  notes?: string;
}

export interface ValidateBidResult {
  valid: boolean;
  code?: string;
  message?: string;
  missing_documents?: { document_type_id: string; document_name: string; reason: string }[];
}

export const bidService = {
  /** Get existing bid for a supplier on an opportunity */
  async getByOpportunityAndSupplier(opportunityId: string, supplierId: string): Promise<Bid | null> {
    const { data, error } = await supabase
      .from("bids")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .eq("supplier_id", supplierId)
      .is("deleted_at", null)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as Bid | null;
  },

  /** Create or update a draft bid */
  async saveDraft(params: BidDraft, existingBidId?: string): Promise<Bid> {
    const payload = {
      opportunity_id: params.opportunity_id,
      supplier_id: params.supplier_id,
      tenant_id: params.tenant_id,
      invitation_id: params.invitation_id || null,
      total_amount: params.total_amount ?? null,
      economic_detail: params.economic_detail ? (params.economic_detail as any) : null,
      technical_description: params.technical_description || null,
      execution_days: params.execution_days ?? null,
      bid_validity_date: params.bid_validity_date || null,
      proposed_conditions: params.proposed_conditions || null,
      notes: params.notes || null,
      status: "draft",
    };

    if (existingBidId) {
      const { data, error } = await supabase
        .from("bids")
        .update(payload)
        .eq("id", existingBidId)
        .select()
        .single();
      if (error) throw error;
      return data as Bid;
    } else {
      const { data, error } = await supabase
        .from("bids")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Bid;
    }
  },

  /** Validate bid before submission via Edge Function */
  async validate(opportunityId: string, supplierId: string): Promise<ValidateBidResult> {
    const { data, error } = await supabase.functions.invoke("validate-bid", {
      body: { opportunity_id: opportunityId, supplier_id: supplierId },
    });
    if (error) throw error;
    return data as ValidateBidResult;
  },

  /** Submit a bid (status draft -> submitted) */
  async submit(bidId: string, tenantId: string, opportunityId: string, invitationId?: string): Promise<Bid> {
    const { data, error } = await supabase
      .from("bids")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", bidId)
      .select()
      .single();
    if (error) throw error;

    // Update invitation status
    if (invitationId) {
      await supabase
        .from("opportunity_invitations")
        .update({ status: "accepted" })
        .eq("id", invitationId);
    }

    // Notify buyer (created_by on opportunity)
    const { data: opp } = await supabase
      .from("opportunities")
      .select("created_by")
      .eq("id", opportunityId)
      .single();

    if (opp?.created_by) {
      await notificationService.send({
        event_type: "bid_submitted",
        recipient_id: opp.created_by,
        tenant_id: tenantId,
      });
    }

    await auditService.log({
      tenant_id: tenantId,
      entity_type: "bid",
      entity_id: bidId,
      event_type: "bid_submitted",
      new_state: { status: "submitted" },
    });

    return data as Bid;
  },

  /** Upload bid attachment */
  async uploadAttachment(opportunityId: string, supplierId: string, file: File): Promise<string> {
    const ext = file.name.split(".").pop();
    const path = `${opportunityId}/${supplierId}/${crypto.randomUUID()}_${file.name}`;
    const { error } = await supabase.storage
      .from("bid-attachments")
      .upload(path, file);
    if (error) throw error;
    return path;
  },

  /** List bid attachments */
  async listAttachments(opportunityId: string, supplierId: string) {
    const { data, error } = await supabase.storage
      .from("bid-attachments")
      .list(`${opportunityId}/${supplierId}`);
    if (error) throw error;
    return data ?? [];
  },

  // ── Evaluation (internal) ──────────────────────────────────

  /** Get all bids for an opportunity with supplier info */
  async listForEvaluation(opportunityId: string) {
    const { data, error } = await supabase
      .from("opportunity_invitations")
      .select(`
        id,
        supplier_id,
        status,
        suppliers(company_name),
        bids:bids!bids_invitation_id_fkey(
          id, status, total_amount, execution_days, technical_description,
          submitted_at, economic_detail, bid_validity_date,
          bid_evaluations(id, criteria_scores, total_score, evaluator_id, evaluated_at)
        )
      `)
      .eq("opportunity_id", opportunityId);
    if (error) throw error;
    return data as any[];
  },

  /** Save evaluation for a bid */
  async saveEvaluation(params: {
    bidId: string;
    evaluatorId: string;
    criteriaScores: Record<string, number>;
    totalScore: number;
    tenantId: string;
  }) {
    // Upsert evaluation
    const { data: existing } = await supabase
      .from("bid_evaluations")
      .select("id")
      .eq("bid_id", params.bidId)
      .eq("evaluator_id", params.evaluatorId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("bid_evaluations")
        .update({
          criteria_scores: params.criteriaScores as any,
          total_score: params.totalScore,
          evaluated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("bid_evaluations")
        .insert({
          bid_id: params.bidId,
          evaluator_id: params.evaluatorId,
          criteria_scores: params.criteriaScores as any,
          total_score: params.totalScore,
        });
      if (error) throw error;
    }

    await auditService.log({
      tenant_id: params.tenantId,
      entity_type: "bid_evaluation",
      entity_id: params.bidId,
      event_type: "evaluation_saved",
      new_state: { total_score: params.totalScore },
    });
  },

  /** Update bid status (admit, exclude, etc.) */
  async updateBidStatus(bidId: string, status: string, tenantId: string, reason?: string) {
    const { error } = await supabase
      .from("bids")
      .update({ status })
      .eq("id", bidId);
    if (error) throw error;

    await auditService.log({
      tenant_id: tenantId,
      entity_type: "bid",
      entity_id: bidId,
      event_type: "bid_status_changed",
      new_state: { status, reason },
    });
  },
};
