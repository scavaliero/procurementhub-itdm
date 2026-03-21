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
    password: string;
    category_id?: string;
  }) {
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: { full_name: params.contact_name },
        emailRedirectTo: window.location.origin,
      },
    });
    if (authErr) throw authErr;
    const userId = authData.user?.id;
    if (!userId) throw new Error("Registrazione fallita: utente non creato");

    const { data: tenants } = await supabase
      .from("tenants")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .single();
    const tenantId = tenants?.id;
    if (!tenantId) throw new Error("Nessun tenant configurato");

    const { data: supplier, error: supErr } = await supabase
      .from("suppliers")
      .insert({
        company_name: params.company_name,
        vat_number_hash: btoa(params.vat_number),
        status: "pre_registered",
        tenant_id: tenantId,
      })
      .select("id")
      .single();
    if (supErr) throw supErr;

    const { error: profErr } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        email: params.email,
        full_name: params.contact_name,
        phone: params.phone || null,
        user_type: "supplier",
        supplier_id: supplier.id,
        tenant_id: tenantId,
      });
    if (profErr) throw profErr;

    const { error: histErr } = await supabase
      .from("supplier_status_history")
      .insert({
        supplier_id: supplier.id,
        to_status: "pre_registered",
        changed_by: userId,
      });
    if (histErr) console.error("Status history error:", histErr);

    if (params.category_id) {
      await supabase.from("supplier_categories").insert({
        supplier_id: supplier.id,
        category_id: params.category_id,
        status: "pending",
      });
    }

    try {
      // Notify supplier
      await supabase.functions.invoke("send-notification", {
        body: {
          event_type: "pre_registration",
          recipient_id: userId,
          tenant_id: tenantId,
          variables: { company_name: params.company_name },
        },
      });
      // Notify procurement team
      await supabase.functions.invoke("send-notification", {
        body: {
          event_type: "pre_registration",
          recipient_email: "procurement@itdm.it",
          tenant_id: tenantId,
          variables: { company_name: params.company_name, contact_name: params.contact_name, email: params.email },
        },
      });
    } catch (e) {
      console.error("Notification error:", e);
    }

    return { userId, supplierId: supplier.id };
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
      .single();
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
      .select("tenant_id")
      .eq("id", params.supplierId)
      .single();
    if (!sup) throw new Error("Fornitore non trovato");

    // Update supplier
    const updatePayload: Record<string, unknown> = {
      status: params.toStatus,
      ...(params.extraUpdate || {}),
    };
    const { error: updErr } = await supabase
      .from("suppliers")
      .update(updatePayload)
      .eq("id", params.supplierId);
    if (updErr) throw updErr;

    // Insert history
    const { error: histErr } = await supabase
      .from("supplier_status_history")
      .insert({
        supplier_id: params.supplierId,
        from_status: params.fromStatus,
        to_status: params.toStatus,
        changed_by: user?.id || null,
        reason: params.reason || null,
      });
    if (histErr) console.error("History error:", histErr);

    // Audit
    await auditService.log({
      tenant_id: sup.tenant_id,
      entity_type: "suppliers",
      entity_id: params.supplierId,
      event_type: "status_change",
      old_state: { status: params.fromStatus },
      new_state: { status: params.toStatus, reason: params.reason },
    });

    // Notify supplier
    try {
      const profileId = await this.getSupplierProfileId(params.supplierId);
      if (profileId) {
        await notificationService.send({
          event_type: `supplier_${params.toStatus}`,
          recipient_id: profileId,
          tenant_id: sup.tenant_id,
          variables: { status: params.toStatus, reason: params.reason || "" },
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
  }): Promise<{ data: Supplier[]; count: number }> {
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
