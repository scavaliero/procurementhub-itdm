import { supabase } from "@/integrations/supabase/client";
import type { DocumentType, UploadedDocument } from "@/types";

export const documentService = {
  async listDocumentTypes(): Promise<DocumentType[]> {
    const { data, error } = await supabase
      .from("document_types")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data as DocumentType[];
  },

  async getDocumentType(id: string): Promise<DocumentType | null> {
    const { data, error } = await supabase
      .from("document_types")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as DocumentType | null;
  },

  async createDocumentType(dt: {
    code: string; name: string; tenant_id: string;
    description?: string; is_mandatory?: boolean; is_blocking?: boolean;
    requires_expiry?: boolean; validity_days?: number;
    allowed_formats?: string[]; max_size_mb?: number;
    needs_manual_review?: boolean; applies_to_categories?: string[];
  }) {
    const { data, error } = await supabase
      .from("document_types")
      .insert(dt)
      .select()
      .single();
    if (error) throw error;
    return data as DocumentType;
  },

  async updateDocumentType(id: string, updates: Partial<DocumentType>) {
    const { data, error } = await supabase
      .from("document_types")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as DocumentType;
  },

  async deleteDocumentType(id: string) {
    const { error } = await supabase
      .from("document_types")
      .update({ is_active: false })
      .eq("id", id);
    if (error) throw error;
  },

  async getSupplierDocuments(supplierId: string): Promise<UploadedDocument[]> {
    const { data, error } = await supabase
      .from("uploaded_documents")
      .select("*")
      .eq("supplier_id", supplierId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as UploadedDocument[];
  },

  async uploadDocument(params: {
    supplierId: string;
    documentTypeId: string;
    tenantId: string;
    file: File;
    expiryDate?: string;
    needsManualReview: boolean;
  }): Promise<UploadedDocument> {
    const fileExt = params.file.name.split(".").pop();
    const filePath = `${params.supplierId}/${params.documentTypeId}/${crypto.randomUUID()}_${params.file.name}`;

    // Upload to storage
    const { error: storageErr } = await supabase.storage
      .from("vendor-documents")
      .upload(filePath, params.file);
    if (storageErr) throw storageErr;

    // Insert record
    const status = params.needsManualReview ? "uploaded" : "approved";
    const { data, error } = await supabase
      .from("uploaded_documents")
      .insert({
        supplier_id: params.supplierId,
        document_type_id: params.documentTypeId,
        tenant_id: params.tenantId,
        original_filename: params.file.name,
        mime_type: params.file.type,
        file_size_bytes: params.file.size,
        storage_path: filePath,
        status,
        expiry_date: params.expiryDate || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as UploadedDocument;
  },

  async reviewDocument(id: string, action: "approved" | "rejected", reviewNotes?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("uploaded_documents")
      .update({
        status: action,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || null,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as UploadedDocument;
  },

  async getSignedUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from("vendor-documents")
      .createSignedUrl(storagePath, 3600);
    if (error) throw error;
    return data.signedUrl;
  },
};
