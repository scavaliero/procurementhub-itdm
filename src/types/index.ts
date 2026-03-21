// Types derived from the absorbed database schema.
// Column names match Supabase exactly.

import type { Json } from "@/integrations/supabase/types";

// ── Status unions ──────────────────────────────────────────────
export type SupplierStatus =
  | "pre_registered"
  | "enabled"
  | "in_accreditation"
  | "in_approval"
  | "pending_review"
  | "accredited"
  | "suspended"
  | "rejected"
  | "revoked"
  | "blacklisted";

export type OpportunityStatus =
  | "draft"
  | "pending_approval"
  | "open"
  | "collecting_bids"
  | "evaluating"
  | "awarded"
  | "closed"
  | "cancelled";

export type BidStatus =
  | "draft"
  | "submitted"
  | "under_evaluation"
  | "accepted"
  | "rejected"
  | "withdrawn";

export type OrderStatus =
  | "draft"
  | "issued"
  | "accepted"
  | "rejected"
  | "in_progress"
  | "completed"
  | "cancelled";

export type ContractStatus =
  | "planned"
  | "active"
  | "completed"
  | "terminated";

export type BillingApprovalStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "invoiced"
  | "closed";

export type DocumentStatus =
  | "uploaded"
  | "approved"
  | "rejected"
  | "not_uploaded"
  | "expired";

export type InvitationStatus =
  | "sent"
  | "viewed"
  | "accepted"
  | "declined";

export type UserType = "internal" | "supplier";

// ── Entities ──────────────────────────────────────────────────
export interface Profile {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  user_type: UserType;
  supplier_id: string | null;
  is_active: boolean | null;
  last_login_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Supplier {
  id: string;
  tenant_id: string;
  company_name: string;
  company_type: string | null;
  vat_number_hash: string | null;
  legal_address: Json | null;
  pec: string | null;
  website: string | null;
  iban_masked: string | null;
  status: SupplierStatus;
  rating_score: number | null;
  rating_count: number | null;
  accredited_at: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Category {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface DocumentType {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description: string | null;
  is_mandatory: boolean | null;
  is_blocking: boolean | null;
  requires_expiry: boolean | null;
  validity_days: number | null;
  allowed_formats: string[] | null;
  max_size_mb: number | null;
  needs_manual_review: boolean | null;
  security_level: string | null;
  applies_to_categories: string[] | null;
  sort_order: number | null;
  is_active: boolean | null;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string | null;
}

export interface UploadedDocument {
  id: string;
  tenant_id: string;
  supplier_id: string;
  document_type_id: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  storage_path: string | null;
  status: DocumentStatus;
  version: number;
  expiry_date: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  virus_scan_status: string | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Opportunity {
  id: string;
  tenant_id: string;
  code: string | null;
  title: string;
  description: string | null;
  status: OpportunityStatus;
  category_id: string | null;
  subcategory_id: string | null;
  created_by: string | null;
  internal_ref_id: string | null;
  requesting_unit: string | null;
  geographic_area: string | null;
  budget_estimated: number | null;
  budget_max: number | null;
  opens_at: string | null;
  bids_deadline: string | null;
  start_date: string | null;
  end_date: string | null;
  estimated_duration_days: number | null;
  evaluation_criteria: Json | null;
  participation_conditions: string | null;
  operational_notes: string | null;
  version: number | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface OpportunityInvitation {
  id: string;
  opportunity_id: string;
  supplier_id: string;
  invited_by: string | null;
  status: InvitationStatus;
  invited_at: string | null;
  viewed_at: string | null;
}

export interface Bid {
  id: string;
  tenant_id: string;
  opportunity_id: string;
  supplier_id: string;
  invitation_id: string | null;
  status: BidStatus;
  technical_description: string | null;
  economic_detail: Json | null;
  total_amount: number | null;
  execution_days: number | null;
  bid_validity_date: string | null;
  proposed_conditions: string | null;
  notes: string | null;
  version: number | null;
  submitted_at: string | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BidEvaluation {
  id: string;
  bid_id: string;
  evaluator_id: string;
  criteria_scores: Json;
  total_score: number | null;
  tech_approved: boolean | null;
  admin_approved: boolean | null;
  internal_notes: string | null;
  evaluated_at: string | null;
}

export interface Award {
  id: string;
  opportunity_id: string;
  supplier_id: string | null;
  winning_bid_id: string | null;
  awarded_by: string | null;
  justification: string | null;
  notes: string | null;
  awarded_at: string | null;
}

export interface Order {
  id: string;
  tenant_id: string;
  code: string | null;
  subject: string;
  description: string | null;
  supplier_id: string;
  opportunity_id: string | null;
  award_id: string | null;
  amount: number;
  status: OrderStatus;
  start_date: string | null;
  end_date: string | null;
  milestones: Json | null;
  contract_conditions: string | null;
  issued_by: string | null;
  approved_by: string | null;
  supplier_accepted_at: string | null;
  supplier_rejected_at: string | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Contract {
  id: string;
  tenant_id: string;
  order_id: string;
  supplier_id: string;
  total_amount: number;
  current_amount: number | null;
  start_date: string;
  end_date: string;
  status: ContractStatus;
  progress_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BillingApproval {
  id: string;
  tenant_id: string;
  code: string | null;
  contract_id: string;
  order_id: string;
  supplier_id: string;
  period_start: string;
  period_end: string;
  amount: number;
  activity_description: string | null;
  status: BillingApprovalStatus;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Notification {
  id: string;
  tenant_id: string;
  recipient_id: string;
  event_type: string;
  title: string;
  body: string | null;
  link_url: string | null;
  related_entity_id: string | null;
  related_entity_type: string | null;
  is_read: boolean | null;
  read_at: string | null;
  created_at: string | null;
}

export interface Grant {
  id: string;
  name: string;
  module: string;
  description: string | null;
  created_at: string | null;
}

export interface Role {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_system: boolean | null;
  is_active: boolean | null;
  created_at: string | null;
}

// ── Junction / history types ──────────────────────────────────
export interface SupplierCategory {
  id: string;
  supplier_id: string;
  category_id: string;
  status: string | null;
  qualified_at: string | null;
  valid_until: string | null;
  categories?: { id: string; name: string; code: string } | null;
}

export interface SupplierStatusHistory {
  id: string;
  supplier_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string | null;
  changer?: { full_name: string } | null;
}

// ── View types ────────────────────────────────────────────────
export interface ContractEconomicSummary {
  contract_id: string | null;
  order_id: string | null;
  tenant_id: string | null;
  supplier_id: string | null;
  original_order_amount: number | null;
  current_authorized_amount: number | null;
  approved_billing_total: number | null;
  pending_approval_amount: number | null;
  pending_approval_count: number | null;
  residual_amount: number | null;
  residual_pct: number | null;
}

export interface UserEffectiveGrant {
  user_id: string | null;
  grant_name: string | null;
  source: string | null;
}
