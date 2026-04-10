import { supabase } from "@/integrations/supabase/client";

export interface SupplierChangeRequest {
  id: string;
  supplier_id: string;
  tenant_id: string;
  requested_by: string;
  requested_changes: Record<string, any>;
  status: "pending" | "approved" | "rejected";
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export const changeRequestService = {
  /** Create a new change request */
  async create(params: {
    supplier_id: string;
    tenant_id: string;
    requested_by: string;
    requested_changes: Record<string, any>;
  }): Promise<SupplierChangeRequest> {
    const { data, error } = await supabase
      .from("supplier_change_requests")
      .insert(params)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as SupplierChangeRequest;
  },

  /** Get pending request for a supplier (latest) */
  async getPendingForSupplier(supplierId: string): Promise<SupplierChangeRequest | null> {
    const { data, error } = await supabase
      .from("supplier_change_requests")
      .select("*")
      .eq("supplier_id", supplierId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as unknown as SupplierChangeRequest | null;
  },

  /** Get all requests for a supplier */
  async listForSupplier(supplierId: string): Promise<SupplierChangeRequest[]> {
    const { data, error } = await supabase
      .from("supplier_change_requests")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as unknown as SupplierChangeRequest[];
  },

  /** Admin: Get all pending requests */
  async listPending(): Promise<(SupplierChangeRequest & { suppliers?: { company_name: string } })[]> {
    const { data, error } = await supabase
      .from("supplier_change_requests")
      .select("*, suppliers(company_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []) as any;
  },

  /** Admin: Approve a change request and apply changes to supplier */
  async approve(id: string, reviewerId: string, supplierId: string, changes: Record<string, any>) {
    // Apply changes to supplier
    const { company_data, address, contacts: _contacts, categories: _categories } = changes;
    const supplierUpdate: Record<string, any> = {};
    if (company_data) {
      if (company_data.company_name) supplierUpdate.company_name = company_data.company_name;
      if (company_data.company_type !== undefined) supplierUpdate.company_type = company_data.company_type;
      if (company_data.pec !== undefined) supplierUpdate.pec = company_data.pec;
      if (company_data.website !== undefined) supplierUpdate.website = company_data.website;
    }
    if (address) {
      supplierUpdate.legal_address = address;
    }

    // Check if supplier is currently rejected — if so, move back to pending_review
    const { data: currentSupplier } = await supabase
      .from("suppliers")
      .select("status")
      .eq("id", supplierId)
      .single();
    if (currentSupplier?.status === "rejected") {
      supplierUpdate.status = "pending_review";
    }

    if (Object.keys(supplierUpdate).length > 0) {
      const { error: updErr } = await supabase
        .from("suppliers")
        .update(supplierUpdate as any)
        .eq("id", supplierId);
      if (updErr) throw updErr;
    }

    // Update request status
    const { error } = await supabase
      .from("supplier_change_requests")
      .update({
        status: "approved",
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
  },

  /** Admin: Reject a change request */
  async reject(id: string, reviewerId: string, reviewNotes: string) {
    const { error } = await supabase
      .from("supplier_change_requests")
      .update({
        status: "rejected",
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes,
      })
      .eq("id", id);
    if (error) throw error;
  },
};
