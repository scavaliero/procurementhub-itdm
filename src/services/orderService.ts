import { supabase } from "@/integrations/supabase/client";
import { auditService } from "@/services/auditService";
import { notificationService } from "@/services/notificationService";
import type { Order, Award, Bid, Supplier } from "@/types";
import type { Json } from "@/integrations/supabase/types";

export interface AwardForOrder extends Award {
  suppliers: Pick<Supplier, "id" | "company_name"> | null;
  bids: Pick<Bid, "id" | "total_amount" | "execution_days" | "proposed_conditions"> | null;
}

export type OrderWithSupplier = Order & { suppliers: { company_name: string } | null };

export interface CreateOrderParams {
  tenantId: string;
  supplierId: string;
  opportunityId: string;
  awardId: string;
  subject: string;
  description?: string;
  amount: number;
  startDate: string;
  endDate: string;
  milestones?: { date: string; description: string }[];
  contractConditions?: string;
  issuedBy: string;
}

export type OrderDetail = Order & {
  suppliers: Pick<Supplier, "id" | "company_name"> | null;
  opportunities: { id: string; title: string; code: string | null } | null;
};

export const orderService = {
  /** Get single order by ID */
  async getById(orderId: string): Promise<OrderDetail> {
    const { data, error } = await supabase
      .from("orders")
      .select("*, suppliers(id, company_name), opportunities(id, title, code)")
      .eq("id", orderId)
      .single();
    if (error) throw error;
    return data as OrderDetail;
  },

  /** Get award data for order pre-fill */
  async getAwardForOrder(opportunityId: string) {
    const { data, error } = await supabase
      .from("awards")
      .select(`
        id, opportunity_id, supplier_id, winning_bid_id, justification,
        suppliers(id, company_name),
        bids!awards_winning_bid_id_fkey(id, total_amount, execution_days, proposed_conditions)
      `)
      .eq("opportunity_id", opportunityId)
      .single();
    if (error) throw error;
    return data as AwardForOrder;
  },

  /** Create order + contract */
  async createOrder(params: CreateOrderParams): Promise<Order> {
    const status = "pending_approval";

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        tenant_id: params.tenantId,
        supplier_id: params.supplierId,
        opportunity_id: params.opportunityId,
        award_id: params.awardId,
        subject: params.subject,
        description: params.description || null,
        amount: params.amount,
        start_date: params.startDate,
        end_date: params.endDate,
        milestones: (params.milestones as unknown as Json) || [],
        contract_conditions: params.contractConditions || null,
        issued_by: params.issuedBy,
        status,
      })
      .select()
      .single();
    if (error) throw error;

    // Create contract
    const { error: cErr } = await supabase
      .from("contracts")
      .insert({
        tenant_id: params.tenantId,
        order_id: order.id,
        supplier_id: params.supplierId,
        start_date: params.startDate,
        end_date: params.endDate,
        total_amount: params.amount,
        current_amount: params.amount,
        status: "planned",
      });
    if (cErr) throw cErr;

    // Audit
    await auditService.log({
      tenant_id: params.tenantId,
      entity_type: "order",
      entity_id: order.id,
      event_type: "order_created",
      new_state: { status, amount: params.amount },
    });

    // Notify supplier (non-blocking)
    try {
      const { data: supplierProfiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("supplier_id", params.supplierId)
        .limit(1);

      if (supplierProfiles?.[0]) {
        await notificationService.send({
          event_type: "order_issued",
          recipient_id: supplierProfiles[0].id,
          tenant_id: params.tenantId,
        });
      }
    } catch (e) {
      console.warn("Notification send failed (non-blocking):", e);
    }

    return order as Order;
  },

  /** List orders for internal */
  async list(tenantId: string) {
    const { data, error } = await supabase
      .from("orders")
      .select("*, suppliers(company_name)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as OrderWithSupplier[];
  },

  /** List orders for a supplier */
  async listForSupplier(supplierId: string) {
    const { data, error } = await supabase
      .from("orders")
      .select("*, suppliers(company_name)")
      .eq("supplier_id", supplierId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as OrderWithSupplier[];
  },

  /** Supplier accepts order */
  async acceptOrder(orderId: string, tenantId: string) {
    const { data: order, error } = await supabase
      .from("orders")
      .update({
        status: "accepted",
        supplier_accepted_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .select("*, opportunity_id")
      .single();
    if (error) throw error;

    // Activate contract
    await supabase
      .from("contracts")
      .update({ status: "active" })
      .eq("order_id", orderId);

    // Notify buyer
    const { data: opp } = await supabase
      .from("orders")
      .select("issued_by")
      .eq("id", orderId)
      .single();

    if (opp?.issued_by) {
      await notificationService.send({
        event_type: "order_accepted",
        recipient_id: opp.issued_by,
        tenant_id: tenantId,
      });
    }

    await auditService.log({
      tenant_id: tenantId,
      entity_type: "order",
      entity_id: orderId,
      event_type: "order_accepted",
      new_state: { status: "accepted" },
    });

    return order as Order;
  },

  /** Supplier rejects order */
  async rejectOrder(orderId: string, tenantId: string, reason: string) {
    const { data: order, error } = await supabase
      .from("orders")
      .update({
        status: "rejected",
        supplier_rejected_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .select()
      .single();
    if (error) throw error;

    const { data: opp } = await supabase
      .from("orders")
      .select("issued_by")
      .eq("id", orderId)
      .single();

    if (opp?.issued_by) {
      await notificationService.send({
        event_type: "order_rejected",
        recipient_id: opp.issued_by,
        tenant_id: tenantId,
      });
    }

    await auditService.log({
      tenant_id: tenantId,
      entity_type: "order",
      entity_id: orderId,
      event_type: "order_rejected",
      new_state: { status: "rejected", reason },
    });

    return order as Order;
  },

  /** Admin approves a pending_approval order → issued */
  async approveOrder(orderId: string, tenantId: string, approvedBy: string): Promise<Order> {
    const { data: order, error } = await supabase
      .from("orders")
      .update({ status: "issued", approved_by: approvedBy })
      .eq("id", orderId)
      .select()
      .single();
    if (error) throw error;

    // Notify supplier (non-blocking)
    try {
      const { data: supplierProfiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("supplier_id", order.supplier_id)
        .limit(1);

      if (supplierProfiles?.[0]) {
        await notificationService.send({
          event_type: "order_issued",
          recipient_id: supplierProfiles[0].id,
          tenant_id: tenantId,
        });
      }
    } catch (e) {
      console.warn("Notification send failed (non-blocking):", e);
    }

    await auditService.log({
      tenant_id: tenantId,
      entity_type: "order",
      entity_id: orderId,
      event_type: "order_approved",
      new_state: { status: "issued" },
    });

    return order as Order;
  },

  /** Admin rejects a pending_approval order */
  async rejectOrderByAdmin(orderId: string, tenantId: string): Promise<Order> {
    const { data: order, error } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId)
      .select()
      .single();
    if (error) throw error;

    await auditService.log({
      tenant_id: tenantId,
      entity_type: "order",
      entity_id: orderId,
      event_type: "order_rejected_by_admin",
      new_state: { status: "cancelled" },
    });

    return order as Order;
  },

  /** Upload order attachment */
  async uploadAttachment(orderId: string, file: File): Promise<string> {
    const path = `${orderId}/${crypto.randomUUID()}_${file.name}`;
    const { error } = await supabase.storage
      .from("order-attachments")
      .upload(path, file);
    if (error) throw error;
    return path;
  },
};
