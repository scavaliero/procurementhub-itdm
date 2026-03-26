import { supabase } from "@/integrations/supabase/client";
import { auditService } from "@/services/auditService";
import { notificationService } from "@/services/notificationService";
import type { PurchaseRequest, PurchaseRequestStatusHistory } from "@/types/purchasing";

interface ListFilters {
  status?: string;
  mine?: boolean;
  search?: string;
}

interface SaveDraftData {
  id?: string;
  subject: string;
  description?: string;
  justification: string;
  amount: number;
  priority: string;
  needed_by?: string | null;
}

async function _currentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autenticato");
  return user;
}

async function _currentTenantId(): Promise<string> {
  const user = await _currentUser();
  const { data } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!data) throw new Error("Profilo non trovato");
  return data.tenant_id;
}

async function _logHistory(
  requestId: string,
  fromStatus: string | null,
  toStatus: string,
  reason?: string | null,
  notes?: string | null
) {
  const user = await _currentUser();
  await supabase.rpc("insert_purchase_request_history", {
    p_purchase_request_id: requestId,
    p_from_status: fromStatus,
    p_to_status: toStatus,
    p_changed_by: user.id,
    p_reason: reason ?? null,
    p_notes: notes ?? null,
  });
}

async function _notifyByGrant(
  grantName: string,
  params: Omit<Parameters<typeof notificationService.send>[0], "recipient_id">
) {
  const { data: users } = await supabase
    .from("user_effective_grants")
    .select("user_id")
    .eq("grant_name", grantName);

  if (users) {
    for (const u of users) {
      if (u.user_id) {
        try {
          await notificationService.send({ ...params, recipient_id: u.user_id });
        } catch (e) {
          console.warn("Notification failed (non-blocking):", e);
        }
      }
    }
  }
}

export const purchaseRequestService = {
  async getApprovalThreshold(): Promise<number> {
    const tenantId = await _currentTenantId();
    const { data, error } = await supabase
      .from("tenants")
      .select("settings")
      .eq("id", tenantId)
      .single();
    if (error) throw error;
    const settings = data?.settings as Record<string, unknown> | null;
    return Number(settings?.purchase_approval_threshold ?? 5000);
  },

  async list(filters?: ListFilters): Promise<PurchaseRequest[]> {
    let query = supabase
      .from("purchase_requests")
      .select("*, requester:profiles!purchase_requests_requested_by_fkey(full_name, email), validator:profiles!purchase_requests_validated_by_fkey(full_name)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.mine) {
      const user = await _currentUser();
      query = query.eq("requested_by", user.id);
    }
    if (filters?.search) {
      query = query.or(`subject.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as unknown as PurchaseRequest[];
  },

  async getById(id: string): Promise<PurchaseRequest> {
    const { data, error } = await supabase
      .from("purchase_requests")
      .select("*, requester:profiles!purchase_requests_requested_by_fkey(full_name, email), validator:profiles!purchase_requests_validated_by_fkey(full_name)")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as unknown as PurchaseRequest;
  },

  async getHistory(id: string): Promise<PurchaseRequestStatusHistory[]> {
    const { data, error } = await supabase
      .from("purchase_request_status_history")
      .select("*")
      .eq("purchase_request_id", id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data as PurchaseRequestStatusHistory[];
  },

  async saveDraft(input: SaveDraftData): Promise<PurchaseRequest> {
    const user = await _currentUser();
    const tenantId = await _currentTenantId();

    if (input.id) {
      // Update existing draft
      const { data, error } = await supabase
        .from("purchase_requests")
        .update({
          subject: input.subject,
          description: input.description || null,
          justification: input.justification,
          amount: input.amount,
          priority: input.priority,
          needed_by: input.needed_by || null,
        })
        .eq("id", input.id)
        .eq("status", "draft")
        .select()
        .single();
      if (error) throw error;
      return data as unknown as PurchaseRequest;
    }

    // Create new
    const { data, error } = await supabase
      .from("purchase_requests")
      .insert({
        tenant_id: tenantId,
        requested_by: user.id,
        subject: input.subject,
        description: input.description || null,
        justification: input.justification,
        amount: input.amount,
        priority: input.priority,
        needed_by: input.needed_by || null,
        status: "draft",
      })
      .select()
      .single();
    if (error) throw error;

    await _logHistory(data.id, null, "draft");

    return data as unknown as PurchaseRequest;
  },

  async submit(id: string) {
    const pr = await this.getById(id);
    const tenantId = await _currentTenantId();

    const { error } = await supabase
      .from("purchase_requests")
      .update({ status: "submitted" })
      .eq("id", id);
    if (error) throw error;

    await _logHistory(id, pr.status, "submitted");

    await auditService.log({
      tenant_id: tenantId,
      entity_type: "purchase_request",
      entity_id: id,
      event_type: "purchase_request_submitted",
      old_state: { status: pr.status },
      new_state: { status: "submitted" },
    });

    // Notify only validate_purchase_request holders (NOT finance)
    await _notifyByGrant("validate_purchase_request", {
      event_type: "purchase_request_submitted",
      tenant_id: tenantId,
      link_url: `/internal/purchase-requests/${id}`,
      related_entity_id: id,
      related_entity_type: "purchase_request",
      variables: { code: pr.code || "", subject: pr.subject, amount: String(pr.amount) },
    });
  },

  async approve(id: string, notes?: string) {
    const pr = await this.getById(id);
    const tenantId = await _currentTenantId();
    const threshold = await this.getApprovalThreshold();

    if (pr.amount > threshold) {
      throw new Error("Importo sopra soglia.");
    }

    const user = await _currentUser();
    const { error } = await supabase
      .from("purchase_requests")
      .update({
        status: "approved",
        validated_by: user.id,
        validated_at: new Date().toISOString(),
        validation_notes: notes || null,
      })
      .eq("id", id);
    if (error) throw error;

    await _logHistory(id, pr.status, "approved", null, notes);

    await auditService.log({
      tenant_id: tenantId,
      entity_type: "purchase_request",
      entity_id: id,
      event_type: "purchase_request_approved",
      new_state: { status: "approved" },
    });

    // Notify requester
    try {
      await notificationService.send({
        event_type: "purchase_request_approved",
        recipient_id: pr.requested_by,
        tenant_id: tenantId,
        link_url: `/internal/purchase-requests/${id}`,
        related_entity_id: id,
        related_entity_type: "purchase_request",
        variables: { code: pr.code || "" },
      });
    } catch (e) {
      console.warn("Notification failed:", e);
    }

    // Notify operators
    await _notifyByGrant("manage_purchase_operations", {
      event_type: "purchase_request_ready_for_purchase",
      tenant_id: tenantId,
      link_url: `/internal/purchase-requests/${id}`,
      related_entity_id: id,
      related_entity_type: "purchase_request",
      variables: { code: pr.code || "" },
    });
  },

  async escalateToFinance(id: string) {
    const pr = await this.getById(id);
    const tenantId = await _currentTenantId();
    const threshold = await this.getApprovalThreshold();

    if (pr.amount <= threshold) {
      throw new Error("Importo sotto soglia.");
    }

    const { error } = await supabase
      .from("purchase_requests")
      .update({ status: "pending_validation" })
      .eq("id", id);
    if (error) throw error;

    await _logHistory(id, pr.status, "pending_validation");

    await auditService.log({
      tenant_id: tenantId,
      entity_type: "purchase_request",
      entity_id: id,
      event_type: "purchase_request_escalated_finance",
      new_state: { status: "pending_validation" },
    });

    // Notify finance_approver
    await _notifyByGrant("validate_purchase_request_high", {
      event_type: "purchase_request_needs_finance",
      tenant_id: tenantId,
      link_url: `/internal/purchase-requests/${id}`,
      related_entity_id: id,
      related_entity_type: "purchase_request",
      variables: { code: pr.code || "", amount: String(pr.amount) },
    });
  },

  async approveFinance(id: string, notes?: string) {
    const pr = await this.getById(id);
    if (pr.status !== "pending_validation") {
      throw new Error("La richiesta non è in attesa di validazione finance.");
    }
    const tenantId = await _currentTenantId();
    const user = await _currentUser();

    const { error } = await supabase
      .from("purchase_requests")
      .update({
        status: "approved_finance",
        validated_by: user.id,
        validated_at: new Date().toISOString(),
        validation_notes: notes || null,
      })
      .eq("id", id);
    if (error) throw error;

    await _logHistory(id, pr.status, "approved_finance", null, notes);

    await auditService.log({
      tenant_id: tenantId,
      entity_type: "purchase_request",
      entity_id: id,
      event_type: "purchase_request_approved_finance",
      new_state: { status: "approved_finance" },
    });

    // Notify requester
    try {
      await notificationService.send({
        event_type: "purchase_request_approved",
        recipient_id: pr.requested_by,
        tenant_id: tenantId,
        link_url: `/internal/purchase-requests/${id}`,
        related_entity_id: id,
        related_entity_type: "purchase_request",
        variables: { code: pr.code || "" },
      });
    } catch (e) {
      console.warn("Notification failed:", e);
    }

    // Notify operators
    await _notifyByGrant("manage_purchase_operations", {
      event_type: "purchase_request_ready_for_purchase",
      tenant_id: tenantId,
      link_url: `/internal/purchase-requests/${id}`,
      related_entity_id: id,
      related_entity_type: "purchase_request",
      variables: { code: pr.code || "" },
    });
  },

  async reject(id: string, reason: string) {
    const pr = await this.getById(id);
    const tenantId = await _currentTenantId();
    const user = await _currentUser();

    const { error } = await supabase
      .from("purchase_requests")
      .update({
        status: "rejected",
        rejected_by: user.id,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq("id", id);
    if (error) throw error;

    await _logHistory(id, pr.status, "rejected", reason);

    await auditService.log({
      tenant_id: tenantId,
      entity_type: "purchase_request",
      entity_id: id,
      event_type: "purchase_request_rejected",
      new_state: { status: "rejected", reason },
    });

    // Notify requester
    try {
      await notificationService.send({
        event_type: "purchase_request_rejected",
        recipient_id: pr.requested_by,
        tenant_id: tenantId,
        link_url: `/internal/purchase-requests/${id}`,
        related_entity_id: id,
        related_entity_type: "purchase_request",
        variables: { code: pr.code || "", reason },
      });
    } catch (e) {
      console.warn("Notification failed:", e);
    }
  },

  async setInPurchase(id: string) {
    const pr = await this.getById(id);
    const tenantId = await _currentTenantId();

    const { error } = await supabase
      .from("purchase_requests")
      .update({ status: "in_purchase" })
      .eq("id", id);
    if (error) throw error;

    await _logHistory(id, pr.status, "in_purchase");

    await auditService.log({
      tenant_id: tenantId,
      entity_type: "purchase_request",
      entity_id: id,
      event_type: "purchase_request_in_purchase",
      new_state: { status: "in_purchase" },
    });
  },

  async completeWithOpportunity(id: string, opportunityId: string) {
    const pr = await this.getById(id);
    const tenantId = await _currentTenantId();

    const { error } = await supabase
      .from("purchase_requests")
      .update({
        status: "completed",
        outcome: "opportunity",
        linked_opportunity_id: opportunityId,
      })
      .eq("id", id);
    if (error) throw error;

    await _logHistory(id, pr.status, "completed", null, `Collegata a opportunità ${opportunityId}`);

    await auditService.log({
      tenant_id: tenantId,
      entity_type: "purchase_request",
      entity_id: id,
      event_type: "purchase_request_completed",
      new_state: { status: "completed", outcome: "opportunity", linked_opportunity_id: opportunityId },
    });
  },

  async completeWithDirectPurchase(id: string) {
    const pr = await this.getById(id);
    const tenantId = await _currentTenantId();

    const { error } = await supabase
      .from("purchase_requests")
      .update({ status: "completed", outcome: "direct_purchase" })
      .eq("id", id);
    if (error) throw error;

    await _logHistory(id, pr.status, "completed", null, "Acquisto diretto");

    await auditService.log({
      tenant_id: tenantId,
      entity_type: "purchase_request",
      entity_id: id,
      event_type: "purchase_request_completed",
      new_state: { status: "completed", outcome: "direct_purchase" },
    });
  },

  async cancel(id: string) {
    const pr = await this.getById(id);
    if (pr.status !== "draft") {
      throw new Error("Solo le bozze possono essere annullate.");
    }
    const tenantId = await _currentTenantId();

    const { error } = await supabase
      .from("purchase_requests")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) throw error;

    await _logHistory(id, pr.status, "cancelled");

    await auditService.log({
      tenant_id: tenantId,
      entity_type: "purchase_request",
      entity_id: id,
      event_type: "purchase_request_cancelled",
      new_state: { status: "cancelled" },
    });
  },
};
