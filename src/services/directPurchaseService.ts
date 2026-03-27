import { supabase } from "@/integrations/supabase/client";
import type { DirectPurchase } from "@/types/purchasing";

interface ListFilters {
  search?: string;
}

interface CreateDirectPurchaseData {
  purchase_request_id?: string;
  supplier_name: string;
  supplier_vat?: string;
  supplier_email?: string;
  supplier_address?: string;
  purchase_date: string;
  amount: number;
  subject: string;
  description?: string;
  invoice_number?: string;
  invoice_date?: string;
  notes?: string;
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

export const directPurchaseService = {
  async list(filters?: ListFilters): Promise<DirectPurchase[]> {
    let query = supabase
      .from("direct_purchases")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (filters?.search) {
      query = query.or(
        `subject.ilike.%${filters.search}%,code.ilike.%${filters.search}%,supplier_name.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as DirectPurchase[];
  },

  async getById(id: string): Promise<DirectPurchase> {
    const { data, error } = await supabase
      .from("direct_purchases")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as DirectPurchase;
  },

  async create(input: CreateDirectPurchaseData): Promise<DirectPurchase> {
    const user = await _currentUser();
    const tenantId = await _currentTenantId();

    const { data, error } = await supabase
      .from("direct_purchases")
      .insert({
        tenant_id: tenantId,
        purchase_request_id: input.purchase_request_id || null,
        supplier_name: input.supplier_name,
        supplier_vat: input.supplier_vat || null,
        supplier_email: input.supplier_email || null,
        supplier_address: input.supplier_address || null,
        purchase_date: input.purchase_date,
        amount: input.amount,
        subject: input.subject,
        description: input.description || null,
        invoice_number: input.invoice_number || null,
        invoice_date: input.invoice_date || null,
        notes: input.notes || null,
        registered_by: user.id,
      })
      .select()
      .single();
    if (error) throw error;
    return data as DirectPurchase;
  },

  async uploadInvoice(id: string, file: File): Promise<string> {
    const tenantId = await _currentTenantId();
    const path = `${tenantId}/${id}/${crypto.randomUUID()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("purchase-invoices")
      .upload(path, file);
    if (uploadError) throw uploadError;

    const { error: updateError } = await supabase
      .from("direct_purchases")
      .update({
        invoice_storage_path: path,
        invoice_filename: file.name,
      })
      .eq("id", id);
    if (updateError) throw updateError;

    return path;
  },

  async getInvoiceSignedUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from("purchase-invoices")
      .createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  },

  async update(id: string, input: Partial<CreateDirectPurchaseData>): Promise<DirectPurchase> {
    const updateData: Record<string, unknown> = {};
    if (input.supplier_name !== undefined) updateData.supplier_name = input.supplier_name;
    if (input.supplier_vat !== undefined) updateData.supplier_vat = input.supplier_vat || null;
    if (input.supplier_email !== undefined) updateData.supplier_email = input.supplier_email || null;
    if (input.supplier_address !== undefined) updateData.supplier_address = input.supplier_address || null;
    if (input.purchase_date !== undefined) updateData.purchase_date = input.purchase_date;
    if (input.amount !== undefined) updateData.amount = input.amount;
    if (input.subject !== undefined) updateData.subject = input.subject;
    if (input.description !== undefined) updateData.description = input.description || null;
    if (input.invoice_number !== undefined) updateData.invoice_number = input.invoice_number || null;
    if (input.invoice_date !== undefined) updateData.invoice_date = input.invoice_date || null;
    if (input.notes !== undefined) updateData.notes = input.notes || null;

    const { data, error } = await supabase
      .from("direct_purchases")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as DirectPurchase;
  },

  async softDelete(id: string): Promise<void> {
    const { error } = await supabase
      .from("direct_purchases")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },
};
