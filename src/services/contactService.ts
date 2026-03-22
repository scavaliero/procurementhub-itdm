import { supabase } from "@/integrations/supabase/client";

export interface SupplierContact {
  id: string;
  supplier_id: string;
  tenant_id: string;
  first_name: string;
  last_name: string | null;
  role: string | null;
  email: string;
  phone: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export const contactService = {
  async list(supplierId: string): Promise<SupplierContact[]> {
    const { data, error } = await supabase
      .from("supplier_contacts")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []) as unknown as SupplierContact[];
  },

  async upsertAll(
    supplierId: string,
    tenantId: string,
    contacts: { first_name: string; last_name?: string; role?: string; email: string; phone?: string }[]
  ) {
    // Delete existing contacts then re-insert
    await supabase
      .from("supplier_contacts")
      .delete()
      .eq("supplier_id", supplierId);

    if (contacts.length === 0) return;

    const rows = contacts.map((c) => ({
      supplier_id: supplierId,
      tenant_id: tenantId,
      first_name: c.first_name,
      last_name: c.last_name || null,
      role: c.role || null,
      email: c.email,
      phone: c.phone || null,
    }));

    const { error } = await supabase
      .from("supplier_contacts")
      .insert(rows as any);
    if (error) throw error;
  },
};
