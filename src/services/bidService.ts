import { supabase } from "@/integrations/supabase/client";
import { auditService } from "@/services/auditService";
import { notificationService } from "@/services/notificationService";
import type { Bid, BidEvaluation } from "@/types";
import type { Json } from "@/integrations/supabase/types";

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

export interface EvaluationInvitation {
  id: string;
  supplier_id: string;
  status: string;
  suppliers: { company_name: string } | null;
  bids: Array<{
    id: string;
    status: string;
    total_amount: number | null;
    execution_days: number | null;
    technical_description: string | null;
    submitted_at: string | null;
    economic_detail: Json | null;
    bid_validity_date: string | null;
    bid_evaluations: Array<{
      id: string;
      criteria_scores: Json;
      total_score: number | null;
      evaluator_id: string;
      evaluated_at: string | null;
    }>;
  }>;
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
      .not("status", "eq", "withdrawn")
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
      economic_detail: params.economic_detail ? (params.economic_detail as unknown as Json) : null,
      technical_description: params.technical_description || null,
      execution_days: params.execution_days ?? null,
      bid_validity_date: params.bid_validity_date || null,
      proposed_conditions: params.proposed_conditions || null,
      notes: params.notes || null,
      status: "draft",
    };

    // Auto-detect existing bid if not provided
    let bidId = existingBidId;
    if (!bidId) {
      const existing = await this.getByOpportunityAndSupplier(params.opportunity_id, params.supplier_id);
      if (existing && existing.status === "draft") {
        bidId = existing.id;
      }
    }

    if (bidId) {
      const { data, error } = await supabase
        .from("bids")
        .update(payload)
        .eq("id", bidId)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Impossibile aggiornare l'offerta — verifica che sia ancora in stato bozza");
      return data as Bid;
    } else {
      // Get max version for this supplier+opportunity to increment
      const { data: maxVersionRow } = await supabase
        .from("bids")
        .select("version")
        .eq("opportunity_id", params.opportunity_id)
        .eq("supplier_id", params.supplier_id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextVersion = (maxVersionRow?.version ?? 0) + 1;

      const { data, error } = await supabase
        .from("bids")
        .insert({ ...payload, version: nextVersion })
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
      .select("created_by, title, code")
      .eq("id", opportunityId)
      .single();

    // Get supplier name
    const { data: supplierData } = await supabase
      .from("suppliers")
      .select("company_name")
      .eq("id", data.supplier_id)
      .single();

    if (opp?.created_by) {
      await notificationService.send({
        event_type: "bid_submitted",
        recipient_id: opp.created_by,
        tenant_id: tenantId,
        link_url: `/internal/opportunities/${opportunityId}`,
        related_entity_id: opportunityId,
        related_entity_type: "opportunity",
        variables: {
          opportunity_title: opp.title || "",
          opportunity_code: opp.code || "",
          company_name: supplierData?.company_name || "",
          amount: data.total_amount ? String(data.total_amount) : "",
        },
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

  /** Upload typed bid attachment (technical_offer / economic_offer) */
  async uploadTypedAttachment(params: {
    bidId: string;
    opportunityId: string;
    supplierId: string;
    tenantId: string;
    attachmentType: "technical_offer" | "economic_offer";
    file: File;
  }): Promise<void> {
    const path = `${params.opportunityId}/${params.supplierId}/${params.attachmentType}_${crypto.randomUUID()}_${params.file.name}`;
    const { error: storageErr } = await supabase.storage
      .from("bid-attachments")
      .upload(path, params.file);
    if (storageErr) throw storageErr;

    // Remove previous attachment of same type for this bid
    const { data: existing } = await supabase
      .from("bid_attachments")
      .select("id, storage_path")
      .eq("bid_id", params.bidId)
      .eq("attachment_type", params.attachmentType);
    if (existing && existing.length > 0) {
      for (const old of existing) {
        if (old.storage_path) {
          await supabase.storage.from("bid-attachments").remove([old.storage_path]);
        }
      }
      await supabase
        .from("bid_attachments")
        .delete()
        .eq("bid_id", params.bidId)
        .eq("attachment_type", params.attachmentType);
    }

    const { error } = await supabase
      .from("bid_attachments")
      .insert({
        bid_id: params.bidId,
        opportunity_id: params.opportunityId,
        supplier_id: params.supplierId,
        tenant_id: params.tenantId,
        attachment_type: params.attachmentType,
        storage_path: path,
        original_filename: params.file.name,
        mime_type: params.file.type,
        file_size_bytes: params.file.size,
      });
    if (error) throw error;
  },

  /** List typed attachments for a bid */
  async listTypedAttachments(bidId: string) {
    const { data, error } = await supabase
      .from("bid_attachments")
      .select("*")
      .eq("bid_id", bidId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  /** Get signed URL for bid attachment */
  async getBidAttachmentUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from("bid-attachments")
      .createSignedUrl(storagePath, 3600);
    if (error) throw error;
    return data.signedUrl;
  },

  // ── Evaluation (internal) ──────────────────────────────────

  /** Get all bids for an opportunity with supplier info */
  async listForEvaluation(opportunityId: string) {
    // Get invitations with supplier info
    const { data: invData, error: invErr } = await supabase
      .from("opportunity_invitations")
      .select(`
        id,
        supplier_id,
        status,
        suppliers(company_name)
      `)
      .eq("opportunity_id", opportunityId);
    if (invErr) throw invErr;

    // Get all non-withdrawn bids for this opportunity
    const { data: bidsData, error: bidsErr } = await supabase
      .from("bids")
      .select(`
        id, status, total_amount, execution_days, technical_description,
        submitted_at, economic_detail, bid_validity_date, supplier_id, invitation_id, version,
        bid_evaluations(id, criteria_scores, total_score, evaluator_id, evaluated_at)
      `)
      .eq("opportunity_id", opportunityId)
      .not("status", "eq", "withdrawn")
      .is("deleted_at", null)
      .order("version", { ascending: false });
    if (bidsErr) throw bidsErr;

    // Map bids to invitations — take the latest active bid per supplier
    const result = (invData ?? []).map((inv) => {
      const supplierBids = (bidsData ?? []).filter((b) => b.supplier_id === inv.supplier_id);
      // Take the first one (highest version due to ordering)
      const latestBid = supplierBids[0];
      return {
        ...inv,
        bids: latestBid ? [latestBid] : [],
      };
    });

    return result as EvaluationInvitation[];
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
          criteria_scores: params.criteriaScores as unknown as Json,
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
          criteria_scores: params.criteriaScores as unknown as Json,
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

  /** Update bid status (admit, exclude, etc.) — notifies supplier on exclusion */
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

    // Notify supplier on exclusion
    if (status === "excluded") {
      try {
        const { data: bid } = await supabase
          .from("bids")
          .select("supplier_id, opportunity_id")
          .eq("id", bidId)
          .single();
        if (bid) {
          const { data: opp } = await supabase
            .from("opportunities")
            .select("title, code")
            .eq("id", bid.opportunity_id)
            .single();
          const { data: profileData } = await supabase
            .from("profiles")
            .select("id")
            .eq("supplier_id", bid.supplier_id)
            .limit(1)
            .maybeSingle();
          if (profileData) {
            await notificationService.send({
              event_type: "bid_excluded",
              recipient_id: profileData.id,
              tenant_id: tenantId,
              link_url: `/supplier/opportunities/${bid.opportunity_id}`,
              related_entity_id: bid.opportunity_id,
              related_entity_type: "opportunity",
              variables: {
                opportunity_title: opp?.title || "",
                opportunity_code: opp?.code || "",
                reason: reason || "Nessuna motivazione fornita",
              },
            });
          }
        }
      } catch (e) {
        console.warn("Non-blocking exclusion notification error:", e);
      }
    }
  },

  /** Withdraw a submitted bid (supplier action) — keeps history */
  async withdraw(bidId: string, tenantId: string, opportunityId: string): Promise<void> {
    const { error } = await supabase
      .from("bids")
      .update({ status: "withdrawn" })
      .eq("id", bidId);
    if (error) throw error;

    await auditService.log({
      tenant_id: tenantId,
      entity_type: "bid",
      entity_id: bidId,
      event_type: "bid_withdrawn",
      new_state: { status: "withdrawn" },
    });

    // Notify buyer
    const { data: opp } = await supabase
      .from("opportunities")
      .select("created_by, title, code")
      .eq("id", opportunityId)
      .single();

    const { data: bid } = await supabase
      .from("bids")
      .select("supplier_id")
      .eq("id", bidId)
      .single();

    const { data: supplierData } = await supabase
      .from("suppliers")
      .select("company_name")
      .eq("id", bid?.supplier_id ?? "")
      .single();

    if (opp?.created_by) {
      await notificationService.send({
        event_type: "bid_withdrawn",
        recipient_id: opp.created_by,
        tenant_id: tenantId,
        link_url: `/internal/opportunities/${opportunityId}`,
        related_entity_id: opportunityId,
        related_entity_type: "opportunity",
        variables: {
          opportunity_title: opp.title || "",
          opportunity_code: opp.code || "",
          company_name: supplierData?.company_name || "",
        },
      });
    }
  },

  /** Award opportunity to a winning bid */
  async awardOpportunity(params: {
    opportunityId: string;
    winningBidId: string;
    supplierId: string;
    awardedBy: string;
    justification: string;
    tenantId: string;
    allBidIds: string[];
  }) {
    // 1. Insert award
    const { data: award, error: awardErr } = await supabase
      .from("awards")
      .insert({
        opportunity_id: params.opportunityId,
        winning_bid_id: params.winningBidId,
        supplier_id: params.supplierId,
        awarded_by: params.awardedBy,
        justification: params.justification,
      })
      .select()
      .single();
    if (awardErr) throw awardErr;

    // 2. Update winning bid status
    await supabase
      .from("bids")
      .update({ status: "winning" })
      .eq("id", params.winningBidId);

    // 3. Update other bids to not_awarded
    const loserIds = params.allBidIds.filter((id) => id !== params.winningBidId);
    if (loserIds.length > 0) {
      await supabase
        .from("bids")
        .update({ status: "not_awarded" })
        .in("id", loserIds);
    }

    // 3b. Update invitation statuses
    await supabase
      .from("opportunity_invitations")
      .update({ status: "accepted" })
      .eq("opportunity_id", params.opportunityId)
      .eq("supplier_id", params.supplierId);
    
    // Mark non-winning invitations as declined
    const { data: otherInvs } = await supabase
      .from("opportunity_invitations")
      .select("id")
      .eq("opportunity_id", params.opportunityId)
      .neq("supplier_id", params.supplierId);
    if (otherInvs && otherInvs.length > 0) {
      await supabase
        .from("opportunity_invitations")
        .update({ status: "declined" })
        .in("id", otherInvs.map(i => i.id));
    }

    // 4. Update opportunity status
    await supabase
      .from("opportunities")
      .update({ status: "awarded" })
      .eq("id", params.opportunityId);

    // 5. Audit
    await auditService.log({
      tenant_id: params.tenantId,
      entity_type: "award",
      entity_id: award.id,
      event_type: "opportunity_awarded",
      new_state: {
        winning_bid_id: params.winningBidId,
        supplier_id: params.supplierId,
      },
    });

    // 6. Notify all invited suppliers (non-blocking — don't let notification failures break award)
    try {
      // Get opportunity details for variables
      const { data: oppData } = await supabase
        .from("opportunities")
        .select("title, code")
        .eq("id", params.opportunityId)
        .single();

      // Get winning supplier name
      const { data: winnerSup } = await supabase
        .from("suppliers")
        .select("company_name")
        .eq("id", params.supplierId)
        .single();

      const { data: invitations } = await supabase
        .from("opportunity_invitations")
        .select("supplier_id, suppliers(id)")
        .eq("opportunity_id", params.opportunityId);

      if (invitations) {
        const { data: supplierProfiles } = await supabase
          .from("profiles")
          .select("id, supplier_id")
          .in("supplier_id", invitations.map((i: any) => i.supplier_id));

        if (supplierProfiles) {
          for (const sp of supplierProfiles) {
            try {
              await notificationService.send({
                event_type: "opportunity_awarded",
                recipient_id: sp.id,
                tenant_id: params.tenantId,
                link_url: `/supplier/opportunities/${params.opportunityId}`,
                related_entity_id: params.opportunityId,
                related_entity_type: "opportunity",
                variables: {
                  opportunity_title: oppData?.title || "",
                  opportunity_code: oppData?.code || "",
                  company_name: winnerSup?.company_name || "",
                  is_winner: sp.supplier_id === params.supplierId ? "true" : "false",
                },
              });
            } catch (notifErr) {
              console.warn("Non-blocking notification error:", notifErr);
            }
          }
        }
      }
    } catch (notifErr) {
      console.warn("Non-blocking notification error:", notifErr);
    }

    return award;
  },
};
