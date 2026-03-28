import { supabase } from "@/integrations/supabase/client";
import { auditService } from "@/services/auditService";
import { notificationService } from "@/services/notificationService";
import type { Supplier, SupplierStatusHistory, SupplierCategory } from "@/types";

export const vendorService = {
  async registerSupplier(params: {
    company_name: string;
    vat_number: string;
    contact_name: string;
    email: string;
    phone?: string;
    pec?: string;
    password: string;
    category_id?: string;
  }) {
    const { data, error } = await supabase.functions.invoke("register-supplier", {
      body: {
        company_name: params.company_name,
        vat_number: params.vat_number,
        contact_name: params.contact_name,
        email: params.email,
        phone: params.phone || null,
        pec: params.pec || null,
        password: params.password,
        category_id: params.category_id || null,
        redirect_to: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    if (data?.resent) return { resent: true, message: data.message };
    return { userId: data.userId, supplierId: data.supplierId };
  },

  async getSupplier(id: string): Promise<Supplier | null> {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as Supplier | null;
  },

  async getMySupplier(): Promise<Supplier | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("supplier_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.supplier_id) return null;
    return this.getSupplier(profile.supplier_id);
  },

  async updateSupplier(id: string, updates: Partial<Supplier>) {
    const { data, error } = await supabase
      .from("suppliers")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data as Supplier;
  },

  /**
   * Full status change: update supplier, insert history, audit, notify supplier.
   */
  async changeStatus(params: {
    supplierId: string;
    fromStatus: string;
    toStatus: string;
    reason?: string;
    extraUpdate?: Partial<Supplier>;
  }) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: sup } = await supabase
      .from("suppliers")
      .select("tenant_id, company_name")
      .eq("id", params.supplierId)
      .single();
    if (!sup) throw new Error("Fornitore non trovato");

    // Update supplier
    const updatePayload: Record<string, unknown> = {
      status: params.toStatus,
      ...(params.extraUpdate || {}),
    };
    const { data: updData, error: updErr } = await supabase
      .from("suppliers")
      .update(updatePayload)
      .eq("id", params.supplierId)
      .select("id, status")
      .maybeSingle();
    if (updErr) throw updErr;
    if (!updData) throw new Error("Aggiornamento stato non riuscito — verifica i permessi");

    // History is auto-logged by trg_supplier_status_change trigger

    // Audit
    await auditService.log({
      tenant_id: sup.tenant_id,
      entity_type: "suppliers",
      entity_id: params.supplierId,
      event_type: "status_change",
      old_state: { status: params.fromStatus },
      new_state: { status: params.toStatus, reason: params.reason },
    });

    // Auto-qualify all pending categories when supplier becomes accredited
    if (params.toStatus === "accredited") {
      const { error: qualErr } = await supabase
        .from("supplier_categories")
        .update({
          status: "qualified",
          qualified_at: new Date().toISOString(),
        })
        .eq("supplier_id", params.supplierId)
        .eq("status", "pending");
      if (qualErr) console.error("Auto-qualify categories error:", qualErr);
    }

    // Notify supplier
    try {
      const profileId = await this.getSupplierProfileId(params.supplierId);
      if (profileId) {
        await notificationService.send({
          event_type: `supplier_${params.toStatus}`,
          recipient_id: profileId,
          tenant_id: sup.tenant_id,
          link_url: `/supplier/dashboard`,
          related_entity_id: params.supplierId,
          related_entity_type: "supplier",
          variables: {
            company_name: sup.company_name || "",
            status: params.toStatus,
            reason: params.reason || "",
          },
        });
      }
    } catch (e) {
      console.error("Notification error:", e);
    }
  },

  /** @deprecated Use changeStatus instead */
  async updateSupplierStatus(
    supplierId: string,
    toStatus: string,
    fromStatus?: string,
    reason?: string
  ) {
    await this.changeStatus({
      supplierId,
      fromStatus: fromStatus || "",
      toStatus,
      reason,
    });
  },

  async getSupplierProfileId(supplierId: string): Promise<string | null> {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("supplier_id", supplierId)
      .limit(1)
      .maybeSingle();
    return data?.id || null;
  },

  async getSupplierProfiles(supplierId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone")
      .eq("supplier_id", supplierId);
    if (error) throw error;
    return data || [];
  },

  /**
   * Paginated + filtered supplier list.
   */
  async listSuppliersPaginated(params: {
    page: number;
    pageSize: number;
    status?: string;
    categoryId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    docsAlert?: "expiring" | "expired";
  }): Promise<{ data: Supplier[]; count: number }> {
    // If filtering by docs alert, first get matching supplier IDs
    if (params.docsAlert) {
      const supplierIds = await this.getSupplierIdsWithDocAlert(params.docsAlert);
      if (supplierIds.length === 0) return { data: [], count: 0 };

      let query = supabase
        .from("suppliers")
        .select("*", { count: "exact" })
        .is("deleted_at", null)
        .in("id", supplierIds)
        .order("created_at", { ascending: false });

      if (params.status) query = query.eq("status", params.status);
      if (params.search) query = query.ilike("company_name", `%${params.search}%`);

      const { data: allData, error: allErr } = await query;
      if (allErr) throw allErr;

      const total = allData?.length ?? 0;
      const from = (params.page - 1) * params.pageSize;
      const paged = (allData || []).slice(from, from + params.pageSize);
      return { data: paged as Supplier[], count: total };
    }

    const from = (params.page - 1) * params.pageSize;
    const to = from + params.pageSize - 1;

    let query = supabase
      .from("suppliers")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (params.status) query = query.eq("status", params.status);
    if (params.search)
      query = query.ilike("company_name", `%${params.search}%`);
    if (params.dateFrom)
      query = query.gte("created_at", params.dateFrom);
    if (params.dateTo)
      query = query.lte("created_at", params.dateTo + "T23:59:59");

    const { data, error, count } = await query;
    if (error) throw error;

    // If filtering by category, we need a second query
    if (params.categoryId && data) {
      const { data: catSuppliers } = await supabase
        .from("supplier_categories")
        .select("supplier_id")
        .eq("category_id", params.categoryId);
      const ids = new Set((catSuppliers || []).map((c) => c.supplier_id));
      const filtered = data.filter((s) => ids.has(s.id));
      return { data: filtered as Supplier[], count: filtered.length };
    }

    return { data: (data || []) as Supplier[], count: count || 0 };
  },

  /** Get supplier IDs that have expiring or expired approved documents */
  async getSupplierIdsWithDocAlert(type: "expiring" | "expired"): Promise<string[]> {
    const now = new Date().toISOString().split("T")[0];

    let query = supabase
      .from("uploaded_documents")
      .select("supplier_id")
      .eq("status", "approved")
      .is("deleted_at", null);

    if (type === "expiring") {
      const future = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
      query = query.gte("expiry_date", now).lte("expiry_date", future);
    } else {
      query = query.lt("expiry_date", now);
    }

    const { data, error } = await query;
    if (error) throw error;
    return [...new Set((data || []).map((d) => d.supplier_id))];
  },

  /** Get doc alert counts (expiring + expired) per supplier for a list of supplier IDs */
  async getDocAlertCounts(supplierIds: string[]): Promise<Record<string, { expiring: number; expired: number }>> {
    if (supplierIds.length === 0) return {};
    const now = new Date().toISOString().split("T")[0];
    const future = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("uploaded_documents")
      .select("supplier_id, expiry_date")
      .eq("status", "approved")
      .is("deleted_at", null)
      .in("supplier_id", supplierIds)
      .not("expiry_date", "is", null)
      .lte("expiry_date", future);
    if (error) throw error;

    const result: Record<string, { expiring: number; expired: number }> = {};
    for (const row of data || []) {
      if (!result[row.supplier_id]) result[row.supplier_id] = { expiring: 0, expired: 0 };
      if (row.expiry_date! < now) {
        result[row.supplier_id].expired++;
      } else {
        result[row.supplier_id].expiring++;
      }
    }
    return result;
  },

  /**
   * Fetch ALL suppliers matching filters (no pagination) — for CSV export.
   */
  async listSuppliersForExport(params: {
    status?: string;
    categoryId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}): Promise<Supplier[]> {
    let query = supabase
      .from("suppliers")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (params.status) query = query.eq("status", params.status);
    if (params.search) query = query.ilike("company_name", `%${params.search}%`);
    if (params.dateFrom) query = query.gte("created_at", params.dateFrom);
    if (params.dateTo) query = query.lte("created_at", params.dateTo + "T23:59:59");

    const { data, error } = await query;
    if (error) throw error;

    let result = (data || []) as Supplier[];

    if (params.categoryId) {
      const { data: catSuppliers } = await supabase
        .from("supplier_categories")
        .select("supplier_id")
        .eq("category_id", params.categoryId);
      const ids = new Set((catSuppliers || []).map((c) => c.supplier_id));
      result = result.filter((s) => ids.has(s.id));
    }

    return result;
  },

  async listSuppliers(tenantId?: string) {
    let query = supabase
      .from("suppliers")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (tenantId) query = query.eq("tenant_id", tenantId);
    const { data, error } = await query;
    if (error) throw error;
    return data as Supplier[];
  },

  async getStatusCounts(): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from("suppliers")
      .select("status")
      .is("deleted_at", null);
    if (error) throw error;
    const counts: Record<string, number> = {};
    (data || []).forEach((s) => {
      counts[s.status] = (counts[s.status] || 0) + 1;
    });
    return counts;
  },

  async getSupplierCategories(
    supplierId: string
  ): Promise<SupplierCategory[]> {
    const { data, error } = await supabase
      .from("supplier_categories")
      .select("*, categories:category_id(id, name, code)")
      .eq("supplier_id", supplierId);
    if (error) throw error;
    return data as unknown as SupplierCategory[];
  },

  async approveCategory(id: string) {
    const { error } = await supabase
      .from("supplier_categories")
      .update({
        status: "qualified",
        qualified_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
  },

  async setSupplierCategories(supplierId: string, categoryIds: string[]) {
    await supabase
      .from("supplier_categories")
      .delete()
      .eq("supplier_id", supplierId);
    if (categoryIds.length > 0) {
      const rows = categoryIds.map((cid) => ({
        supplier_id: supplierId,
        category_id: cid,
        status: "pending" as const,
      }));
      const { error } = await supabase
        .from("supplier_categories")
        .insert(rows);
      if (error) throw error;
    }
  },

  async getStatusHistory(
    supplierId: string
  ): Promise<SupplierStatusHistory[]> {
    const { data, error } = await supabase
      .from("supplier_status_history")
      .select("*, changer:changed_by(full_name)")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as unknown as SupplierStatusHistory[];
  },
};
