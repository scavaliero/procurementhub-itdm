import { supabase } from "@/integrations/supabase/client";
import { auditService } from "@/services/auditService";
import { notificationService } from "@/services/notificationService";
import type { BillingApproval, ContractEconomicSummary } from "@/types";

export interface CreateBillingParams {
  tenantId: string;
  contractId: string;
  orderId: string;
  supplierId: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  activityDescription?: string;
  createdBy: string;
}

export interface CheckBillingLimitResult {
  valid: boolean;
  code?: string;
  message?: string;
  residual_amount?: number;
  authorized_amount?: number;
  warning?: string | null;
}

export const billingApprovalService = {
  /** Get single billing approval by ID */
  async getById(id: string) {
    const { data, error } = await supabase
      .from("billing_approvals")
      .select("*, suppliers(company_name)")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) throw error;
    return data as any;
  },

  /** Update a draft billing approval */
  async update(id: string, fields: { period_start?: string; period_end?: string; amount?: number; activity_description?: string | null }) {
    const { error } = await supabase
      .from("billing_approvals")
      .update(fields)
      .eq("id", id);
    if (error) throw error;
  },

  /** Soft delete a billing approval */
  async softDelete(id: string, tenantId: string) {
    const { error } = await supabase
      .from("billing_approvals")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;

    await auditService.log({
      tenant_id: tenantId,
      entity_type: "billing_approval",
      entity_id: id,
      event_type: "billing_deleted",
      new_state: { deleted: true },
    });
  },

  /** List all billing approvals for internal */
  async list() {
    const { data, error } = await supabase
      .from("billing_approvals")
      .select("*, suppliers(company_name)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as any[];
  },

  /** List pending approvals */
  async listPending() {
    const { data, error } = await supabase
      .from("billing_approvals")
      .select("*, suppliers(company_name)")
      .eq("status", "pending_approval")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as any[];
  },

  /** List for supplier (only approved+) */
  async listForSupplier(supplierId: string) {
    const { data, error } = await supabase
      .from("billing_approvals")
      .select("*, suppliers(company_name)")
      .eq("supplier_id", supplierId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as any[];
  },

  /** Get contract economic summary for residual check */
  async getResidual(contractId: string): Promise<ContractEconomicSummary | null> {
    const { data, error } = await supabase
      .from("contract_economic_summary")
      .select("*")
      .eq("contract_id", contractId)
      .maybeSingle();
    if (error) throw error;
    return data as ContractEconomicSummary | null;
  },

  /** List active contracts for select */
  async listActiveContracts() {
    const { data, error } = await supabase
      .from("contracts")
      .select("id, order_id, supplier_id, total_amount, status, orders(code, subject), suppliers(company_name)")
      .in("status", ["active", "planned"])
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as any[];
  },

  /** Save draft billing approval */
  async saveDraft(params: CreateBillingParams): Promise<BillingApproval> {
    const { data, error } = await supabase
      .from("billing_approvals")
      .insert({
        tenant_id: params.tenantId,
        contract_id: params.contractId,
        order_id: params.orderId,
        supplier_id: params.supplierId,
        period_start: params.periodStart,
        period_end: params.periodEnd,
        amount: params.amount,
        activity_description: params.activityDescription || null,
        created_by: params.createdBy,
        status: "draft",
      })
      .select()
      .single();
    if (error) throw error;
    return data as BillingApproval;
  },

  /** Check billing limit via edge function (RB-08) */
  async checkLimit(contractId: string, newAmount: number): Promise<CheckBillingLimitResult> {
    const { data, error } = await supabase.functions.invoke("check-billing-limit", {
      body: { contract_id: contractId, new_amount: newAmount },
    });
    if (error) throw error;
    return data as CheckBillingLimitResult;
  },

  /** Submit for approval (draft -> pending_approval) with server-side RB-08 check */
  async submitForApproval(billingId: string, tenantId: string) {
    // 1. Read the billing to get contract_id, amount and supplier info
    const { data: billing, error: readErr } = await supabase
      .from("billing_approvals")
      .select("contract_id, amount, code, supplier_id, suppliers(company_name)")
      .eq("id", billingId)
      .single();
    if (readErr) throw readErr;

    // 2. Always call Edge Function check-billing-limit (server-side enforcement)
    const limitResult = await this.checkLimit(billing.contract_id, billing.amount);
    if (!limitResult.valid) {
      throw new Error(
        limitResult.message || "Importo supera il residuo contrattuale (RB-08)"
      );
    }

    // 3. Update status
    const { error } = await supabase
      .from("billing_approvals")
      .update({ status: "pending_approval" })
      .eq("id", billingId);
    if (error) throw error;

    await auditService.log({
      tenant_id: tenantId,
      entity_type: "billing_approval",
      entity_id: billingId,
      event_type: "billing_submitted",
      new_state: { status: "pending_approval" },
    });

    const billingVars = {
      billing_code: billing.code || "",
      amount: String(billing.amount),
      company_name: (billing.suppliers as any)?.company_name || "",
    };

    // Notify approvers
    const { data: approvers } = await supabase
      .from("user_effective_grants")
      .select("user_id")
      .eq("grant_name", "approve_billing_approval");

    if (approvers) {
      for (const a of approvers) {
        if (a.user_id) {
          await notificationService.send({
            event_type: "billing_pending_approval",
            recipient_id: a.user_id,
            tenant_id: tenantId,
            variables: billingVars,
          });
        }
      }
    }
  },

  /** Approve billing */
  async approve(billingId: string, approvedBy: string, tenantId: string) {
    const { error } = await supabase
      .from("billing_approvals")
      .update({
        status: "approved",
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
      })
      .eq("id", billingId);
    if (error) throw error;

    // Get billing to notify supplier
    const { data: billing } = await supabase
      .from("billing_approvals")
      .select("supplier_id, code, amount, suppliers(company_name)")
      .eq("id", billingId)
      .single();

    if (billing?.supplier_id) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("supplier_id", billing.supplier_id)
        .limit(1);

      if (profiles?.[0]) {
        await notificationService.send({
          event_type: "billing_approved",
          recipient_id: profiles[0].id,
          tenant_id: tenantId,
          variables: {
            billing_code: billing.code || "",
            amount: String(billing.amount),
            company_name: (billing.suppliers as any)?.company_name || "",
          },
        });
      }
    }

    await auditService.log({
      tenant_id: tenantId,
      entity_type: "billing_approval",
      entity_id: billingId,
      event_type: "billing_approved",
      new_state: { status: "approved", approved_by: approvedBy },
    });
  },

  /** Reject billing */
  async reject(billingId: string, tenantId: string, reason: string) {
    const { error } = await supabase
      .from("billing_approvals")
      .update({ status: "rejected" })
      .eq("id", billingId);
    if (error) throw error;

    const { data: billing } = await supabase
      .from("billing_approvals")
      .select("supplier_id, code, amount, suppliers(company_name)")
      .eq("id", billingId)
      .single();

    if (billing?.supplier_id) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("supplier_id", billing.supplier_id)
        .limit(1);

      if (profiles?.[0]) {
        await notificationService.send({
          event_type: "billing_rejected",
          recipient_id: profiles[0].id,
          tenant_id: tenantId,
          variables: {
            billing_code: billing.code || "",
            amount: String(billing.amount),
            company_name: (billing.suppliers as any)?.company_name || "",
            reason,
          },
        });
      }
    }

    await auditService.log({
      tenant_id: tenantId,
      entity_type: "billing_approval",
      entity_id: billingId,
      event_type: "billing_rejected",
      new_state: { status: "rejected", reason },
    });
  },

  /** Upload billing attachment */
  async uploadAttachment(billingId: string, file: File): Promise<string> {
    const path = `${billingId}/${crypto.randomUUID()}_${file.name}`;
    const { error } = await supabase.storage
      .from("billing-attachments")
      .upload(path, file);
    if (error) throw error;
    return path;
  },

  /** List attachments for a billing approval */
  async listAttachments(billingId: string) {
    const { data, error } = await supabase.storage
      .from("billing-attachments")
      .list(billingId);
    if (error) throw error;
    return (data ?? []).map((f) => ({
      name: f.name,
      path: `${billingId}/${f.name}`,
      size: f.metadata?.size ?? 0,
      createdAt: f.created_at,
    }));
  },

  /** Get signed download URL */
  async getAttachmentUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from("billing-attachments")
      .createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  },

  /** Delete an attachment */
  async deleteAttachment(path: string) {
    const { error } = await supabase.storage
      .from("billing-attachments")
      .remove([path]);
    if (error) throw error;
  },
};
