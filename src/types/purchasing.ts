export type PurchaseRequestStatus =
  | "draft"
  | "submitted"
  | "pending_validation"
  | "approved"
  | "approved_finance"
  | "rejected"
  | "in_purchase"
  | "completed"
  | "cancelled";

export type PurchaseOutcome = "opportunity" | "direct_purchase";

export type PurchasePriority = "low" | "normal" | "high" | "urgent";

export interface PurchaseRequest {
  id: string;
  tenant_id: string;
  code: string | null;
  requested_by: string;
  status: PurchaseRequestStatus;
  subject: string;
  description: string | null;
  justification: string;
  amount: number;
  priority: PurchasePriority;
  needed_by: string | null;
  outcome: PurchaseOutcome | null;
  linked_opportunity_id: string | null;
  validated_by: string | null;
  validated_at: string | null;
  validation_notes: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Joined fields
  requester?: { full_name: string; email: string } | null;
  validator?: { full_name: string } | null;
}

export interface DirectPurchase {
  id: string;
  tenant_id: string;
  code: string | null;
  purchase_request_id: string | null;
  supplier_name: string;
  supplier_vat: string | null;
  supplier_email: string | null;
  supplier_address: string | null;
  purchase_date: string;
  amount: number;
  subject: string;
  description: string | null;
  invoice_storage_path: string | null;
  invoice_filename: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  registered_by: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PurchaseRequestStatusHistory {
  id: string;
  purchase_request_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string | null;
}
