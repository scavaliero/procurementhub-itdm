import { supabase } from "@/integrations/supabase/client";

export interface SuppliersByStatus {
  status: string;
  count: number;
}

export interface OpportunitiesByStatus {
  status: string;
  count: number;
}

export const dashboardService = {
  // ── Internal KPIs ─────────────────────────────────────────

  /** Count suppliers grouped by status */
  async suppliersByStatus(): Promise<SuppliersByStatus[]> {
    const { data, error } = await supabase
      .from("suppliers")
      .select("status")
      .is("deleted_at", null);
    if (error) throw error;

    const map = new Map<string, number>();
    for (const row of data ?? []) {
      map.set(row.status, (map.get(row.status) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([status, count]) => ({ status, count }));
  },

  /** Count approved documents expiring within N days */
  async expiringDocuments(days = 30): Promise<number> {
    const now = new Date().toISOString().split("T")[0];
    const future = new Date(Date.now() + days * 86400000).toISOString().split("T")[0];

    const { count, error } = await supabase
      .from("uploaded_documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .is("deleted_at", null)
      .gte("expiry_date", now)
      .lte("expiry_date", future);
    if (error) throw error;
    return count ?? 0;
  },

  /** Count expired documents (expiry_date < today, status approved) */
  async expiredDocuments(): Promise<number> {
    const now = new Date().toISOString().split("T")[0];

    const { count, error } = await supabase
      .from("uploaded_documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .is("deleted_at", null)
      .lt("expiry_date", now);
    if (error) throw error;
    return count ?? 0;
  },

  /** Count opportunities grouped by status */
  async opportunitiesByStatus(): Promise<OpportunitiesByStatus[]> {
    const { data, error } = await supabase
      .from("opportunities")
      .select("status")
      .is("deleted_at", null);
    if (error) throw error;

    const map = new Map<string, number>();
    for (const row of data ?? []) {
      map.set(row.status, (map.get(row.status) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([status, count]) => ({ status, count }));
  },

  /** Count active contracts */
  async activeContracts(): Promise<number> {
    const { count, error } = await supabase
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");
    if (error) throw error;
    return count ?? 0;
  },

  /** Count pending billing approvals */
  async pendingBillingApprovals(): Promise<number> {
    const { count, error } = await supabase
      .from("billing_approvals")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_approval")
      .is("deleted_at", null);
    if (error) throw error;
    return count ?? 0;
  },

  /** Count contracts with residual_pct < 10 (budget alert) */
  async lowBudgetContracts(): Promise<number> {
    const { data, error } = await supabase
      .from("contract_economic_summary")
      .select("contract_id")
      .lt("residual_pct", 10);
    if (error) throw error;
    return data?.length ?? 0;
  },

  /** Last N opportunities */
  async recentOpportunities(limit = 5) {
    const { data, error } = await supabase
      .from("opportunities")
      .select("id, code, title, status, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  /** Last N pending billing approvals */
  async recentPendingBillings(limit = 5) {
    const { data, error } = await supabase
      .from("billing_approvals")
      .select("id, code, amount, status, created_at, suppliers(company_name)")
      .eq("status", "pending_approval")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  // ── Supplier KPIs ─────────────────────────────────────────

  /** Get supplier status for the current user's supplier */
  async supplierStatus(supplierId: string) {
    const { data, error } = await supabase
      .from("suppliers")
      .select("status, company_name")
      .eq("id", supplierId)
      .single();
    if (error) throw error;
    return data;
  },

  /** Count documents that need attention (rejected, expired, or uploaded awaiting review) */
  async supplierPendingDocs(supplierId: string): Promise<number> {
    const { count, error } = await supabase
      .from("uploaded_documents")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", supplierId)
      .is("deleted_at", null)
      .in("status", ["uploaded", "rejected"]);
    if (error) throw error;
    return count ?? 0;
  },

  /** Count unseen invitations for supplier */
  async supplierUnseenInvitations(supplierId: string): Promise<number> {
    const { count, error } = await supabase
      .from("opportunity_invitations")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", supplierId)
      .eq("status", "sent")
      .is("viewed_at", null);
    if (error) throw error;
    return count ?? 0;
  },

  /** Count bids submitted this month by supplier */
  async supplierBidsThisMonth(supplierId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from("bids")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", supplierId)
      .eq("status", "submitted")
      .gte("submitted_at", startOfMonth.toISOString());
    if (error) throw error;
    return count ?? 0;
  },
};
