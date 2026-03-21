import { supabase } from "@/integrations/supabase/client";
import type { Supplier } from "@/types";

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
    // 1. Auth signup
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

    // We need a tenant_id. For supplier self-registration we use a default tenant.
    // The edge function / trigger should handle this, but for now we fetch it.
    const { data: tenants } = await supabase
      .from("tenants")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .single();
    const tenantId = tenants?.id;
    if (!tenantId) throw new Error("Nessun tenant configurato");

    // 2. Insert supplier
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

    // 3. Insert profile
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

    // 4. Insert supplier_status_history
    const { error: histErr } = await supabase
      .from("supplier_status_history")
      .insert({
        supplier_id: supplier.id,
        to_status: "pre_registered",
        changed_by: userId,
      });
    if (histErr) console.error("Status history error:", histErr);

    // 5. Insert supplier_categories if selected
    if (params.category_id) {
      await supabase.from("supplier_categories").insert({
        supplier_id: supplier.id,
        category_id: params.category_id,
        status: "pending",
      });
    }

    // 6. Send notification via edge function
    try {
      await supabase.functions.invoke("send-notification", {
        body: {
          event_type: "pre_registration",
          recipient_id: userId,
          tenant_id: tenantId,
          variables: { company_name: params.company_name },
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
    const { data: { user } } = await supabase.auth.getUser();
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

  async updateSupplierStatus(
    supplierId: string,
    toStatus: string,
    fromStatus?: string,
    reason?: string
  ) {
    const { data: { user } } = await supabase.auth.getUser();
    // Update supplier
    await supabase
      .from("suppliers")
      .update({ status: toStatus })
      .eq("id", supplierId);
    // Insert history
    await supabase.from("supplier_status_history").insert({
      supplier_id: supplierId,
      to_status: toStatus,
      from_status: fromStatus || null,
      changed_by: user?.id || null,
      reason: reason || null,
    });
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

  async getSupplierCategories(supplierId: string) {
    const { data, error } = await supabase
      .from("supplier_categories")
      .select("*, categories:category_id(id, name, code)")
      .eq("supplier_id", supplierId);
    if (error) throw error;
    return data;
  },

  async setSupplierCategories(supplierId: string, categoryIds: string[]) {
    // Delete existing
    await supabase
      .from("supplier_categories")
      .delete()
      .eq("supplier_id", supplierId);
    // Insert new
    if (categoryIds.length > 0) {
      const rows = categoryIds.map((cid) => ({
        supplier_id: supplierId,
        category_id: cid,
        status: "pending" as const,
      }));
      const { error } = await supabase.from("supplier_categories").insert(rows);
      if (error) throw error;
    }
  },
};
