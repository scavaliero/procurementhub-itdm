export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          created_at: string | null
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          ip_address: unknown
          new_state: Json | null
          old_state: Json | null
          tenant_id: string
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          ip_address?: unknown
          new_state?: Json | null
          old_state?: Json | null
          tenant_id: string
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          new_state?: Json | null
          old_state?: Json | null
          tenant_id?: string
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      awards: {
        Row: {
          awarded_at: string | null
          awarded_by: string | null
          id: string
          justification: string | null
          notes: string | null
          opportunity_id: string
          supplier_id: string | null
          winning_bid_id: string | null
        }
        Insert: {
          awarded_at?: string | null
          awarded_by?: string | null
          id?: string
          justification?: string | null
          notes?: string | null
          opportunity_id: string
          supplier_id?: string | null
          winning_bid_id?: string | null
        }
        Update: {
          awarded_at?: string | null
          awarded_by?: string | null
          id?: string
          justification?: string | null
          notes?: string | null
          opportunity_id?: string
          supplier_id?: string | null
          winning_bid_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "awards_awarded_by_fkey"
            columns: ["awarded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "awards_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "awards_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "awards_winning_bid_id_fkey"
            columns: ["winning_bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_attachments: {
        Row: {
          attachment_type: string
          bid_id: string
          created_at: string | null
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          opportunity_id: string
          original_filename: string
          storage_path: string
          supplier_id: string
          tenant_id: string
        }
        Insert: {
          attachment_type: string
          bid_id: string
          created_at?: string | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          opportunity_id: string
          original_filename: string
          storage_path: string
          supplier_id: string
          tenant_id: string
        }
        Update: {
          attachment_type?: string
          bid_id?: string
          created_at?: string | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          opportunity_id?: string
          original_filename?: string
          storage_path?: string
          supplier_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_attachments_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_attachments_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_attachments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_evaluations: {
        Row: {
          admin_approved: boolean | null
          bid_id: string
          criteria_scores: Json
          evaluated_at: string | null
          evaluator_id: string
          id: string
          internal_notes: string | null
          tech_approved: boolean | null
          total_score: number | null
        }
        Insert: {
          admin_approved?: boolean | null
          bid_id: string
          criteria_scores: Json
          evaluated_at?: string | null
          evaluator_id: string
          id?: string
          internal_notes?: string | null
          tech_approved?: boolean | null
          total_score?: number | null
        }
        Update: {
          admin_approved?: boolean | null
          bid_id?: string
          criteria_scores?: Json
          evaluated_at?: string | null
          evaluator_id?: string
          id?: string
          internal_notes?: string | null
          tech_approved?: boolean | null
          total_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bid_evaluations_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_evaluations_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bids: {
        Row: {
          bid_validity_date: string | null
          created_at: string | null
          deleted_at: string | null
          economic_detail: Json | null
          execution_days: number | null
          id: string
          invitation_id: string | null
          notes: string | null
          opportunity_id: string
          proposed_conditions: string | null
          status: string
          submitted_at: string | null
          supplier_id: string
          technical_description: string | null
          tenant_id: string
          total_amount: number | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          bid_validity_date?: string | null
          created_at?: string | null
          deleted_at?: string | null
          economic_detail?: Json | null
          execution_days?: number | null
          id?: string
          invitation_id?: string | null
          notes?: string | null
          opportunity_id: string
          proposed_conditions?: string | null
          status?: string
          submitted_at?: string | null
          supplier_id: string
          technical_description?: string | null
          tenant_id: string
          total_amount?: number | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          bid_validity_date?: string | null
          created_at?: string | null
          deleted_at?: string | null
          economic_detail?: Json | null
          execution_days?: number | null
          id?: string
          invitation_id?: string | null
          notes?: string | null
          opportunity_id?: string
          proposed_conditions?: string | null
          status?: string
          submitted_at?: string | null
          supplier_id?: string
          technical_description?: string | null
          tenant_id?: string
          total_amount?: number | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bids_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "opportunity_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_approvals: {
        Row: {
          activity_description: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          code: string | null
          contract_id: string
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string
          order_id: string
          period_end: string
          period_start: string
          status: string
          supplier_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          activity_description?: string | null
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          code?: string | null
          contract_id: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          order_id: string
          period_end: string
          period_start: string
          status?: string
          supplier_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          activity_description?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          code?: string | null
          contract_id?: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          order_id?: string
          period_end?: string
          period_start?: string
          status?: string
          supplier_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_approvals_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract_economic_summary"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "billing_approvals_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_approvals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_approvals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_approvals_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_approvals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          created_at: string | null
          current_amount: number | null
          end_date: string
          id: string
          order_id: string
          progress_notes: string | null
          start_date: string
          status: string
          supplier_id: string
          tenant_id: string
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_amount?: number | null
          end_date: string
          id?: string
          order_id: string
          progress_notes?: string | null
          start_date: string
          status?: string
          supplier_id: string
          tenant_id: string
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_amount?: number | null
          end_date?: string
          id?: string
          order_id?: string
          progress_notes?: string | null
          start_date?: string
          status?: string
          supplier_id?: string
          tenant_id?: string
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_purchases: {
        Row: {
          amount: number
          code: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          id: string
          invoice_date: string | null
          invoice_filename: string | null
          invoice_number: string | null
          invoice_storage_path: string | null
          notes: string | null
          purchase_date: string
          purchase_request_id: string | null
          registered_by: string | null
          subject: string
          supplier_address: string | null
          supplier_email: string | null
          supplier_name: string
          supplier_vat: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          code?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          invoice_date?: string | null
          invoice_filename?: string | null
          invoice_number?: string | null
          invoice_storage_path?: string | null
          notes?: string | null
          purchase_date: string
          purchase_request_id?: string | null
          registered_by?: string | null
          subject: string
          supplier_address?: string | null
          supplier_email?: string | null
          supplier_name: string
          supplier_vat?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          code?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          invoice_date?: string | null
          invoice_filename?: string | null
          invoice_number?: string | null
          invoice_storage_path?: string | null
          notes?: string | null
          purchase_date?: string
          purchase_request_id?: string | null
          registered_by?: string | null
          subject?: string
          supplier_address?: string | null
          supplier_email?: string | null
          supplier_name?: string
          supplier_vat?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "direct_purchases_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_purchases_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_purchases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_types: {
        Row: {
          allowed_formats: string[] | null
          applies_to_categories: string[] | null
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_blocking: boolean | null
          is_mandatory: boolean | null
          max_size_mb: number | null
          name: string
          needs_manual_review: boolean | null
          requires_expiry: boolean | null
          security_level: string | null
          sort_order: number | null
          tenant_id: string
          valid_from: string | null
          valid_until: string | null
          validity_days: number | null
        }
        Insert: {
          allowed_formats?: string[] | null
          applies_to_categories?: string[] | null
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_blocking?: boolean | null
          is_mandatory?: boolean | null
          max_size_mb?: number | null
          name: string
          needs_manual_review?: boolean | null
          requires_expiry?: boolean | null
          security_level?: string | null
          sort_order?: number | null
          tenant_id: string
          valid_from?: string | null
          valid_until?: string | null
          validity_days?: number | null
        }
        Update: {
          allowed_formats?: string[] | null
          applies_to_categories?: string[] | null
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_blocking?: boolean | null
          is_mandatory?: boolean | null
          max_size_mb?: number | null
          name?: string
          needs_manual_review?: boolean | null
          requires_expiry?: boolean | null
          security_level?: string | null
          sort_order?: number | null
          tenant_id?: string
          valid_from?: string | null
          valid_until?: string | null
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          event_type: string
          html_body: string
          id: string
          is_active: boolean | null
          subject: string
          tenant_id: string
          text_body: string | null
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          event_type: string
          html_body: string
          id?: string
          is_active?: boolean | null
          subject: string
          tenant_id: string
          text_body?: string | null
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          event_type?: string
          html_body?: string
          id?: string
          is_active?: boolean | null
          subject?: string
          tenant_id?: string
          text_body?: string | null
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      grants: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          module: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          module: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          module?: string
          name?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          event_type: string
          id: string
          is_read: boolean | null
          link_url: string | null
          read_at: string | null
          recipient_id: string
          related_entity_id: string | null
          related_entity_type: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          is_read?: boolean | null
          link_url?: string | null
          read_at?: string | null
          recipient_id: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          is_read?: boolean | null
          link_url?: string | null
          read_at?: string | null
          recipient_id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          bids_deadline: string | null
          budget_estimated: number | null
          budget_max: number | null
          category_id: string | null
          code: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          end_date: string | null
          estimated_duration_days: number | null
          evaluation_criteria: Json | null
          geographic_area: string | null
          id: string
          internal_ref_id: string | null
          opens_at: string | null
          operational_notes: string | null
          participation_conditions: string | null
          requesting_unit: string | null
          require_economic_offer: boolean
          require_technical_offer: boolean
          start_date: string | null
          status: string
          subcategory_id: string | null
          tenant_id: string
          title: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          bids_deadline?: string | null
          budget_estimated?: number | null
          budget_max?: number | null
          category_id?: string | null
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          estimated_duration_days?: number | null
          evaluation_criteria?: Json | null
          geographic_area?: string | null
          id?: string
          internal_ref_id?: string | null
          opens_at?: string | null
          operational_notes?: string | null
          participation_conditions?: string | null
          requesting_unit?: string | null
          require_economic_offer?: boolean
          require_technical_offer?: boolean
          start_date?: string | null
          status?: string
          subcategory_id?: string | null
          tenant_id: string
          title: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          bids_deadline?: string | null
          budget_estimated?: number | null
          budget_max?: number | null
          category_id?: string | null
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          estimated_duration_days?: number | null
          evaluation_criteria?: Json | null
          geographic_area?: string | null
          id?: string
          internal_ref_id?: string | null
          opens_at?: string | null
          operational_notes?: string | null
          participation_conditions?: string | null
          requesting_unit?: string | null
          require_economic_offer?: boolean
          require_technical_offer?: boolean
          start_date?: string | null
          status?: string
          subcategory_id?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_internal_ref_id_fkey"
            columns: ["internal_ref_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_invitations: {
        Row: {
          id: string
          invited_at: string | null
          invited_by: string | null
          opportunity_id: string
          status: string
          supplier_id: string
          viewed_at: string | null
        }
        Insert: {
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          opportunity_id: string
          status?: string
          supplier_id: string
          viewed_at?: string | null
        }
        Update: {
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          opportunity_id?: string
          status?: string
          supplier_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_invitations_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_invitations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number
          approved_by: string | null
          award_id: string | null
          code: string | null
          contract_conditions: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          end_date: string | null
          id: string
          issued_by: string | null
          milestones: Json | null
          opportunity_id: string | null
          start_date: string | null
          status: string
          subject: string
          supplier_accepted_at: string | null
          supplier_id: string
          supplier_rejected_at: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          approved_by?: string | null
          award_id?: string | null
          code?: string | null
          contract_conditions?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          issued_by?: string | null
          milestones?: Json | null
          opportunity_id?: string | null
          start_date?: string | null
          status?: string
          subject: string
          supplier_accepted_at?: string | null
          supplier_id: string
          supplier_rejected_at?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          approved_by?: string | null
          award_id?: string | null
          code?: string | null
          contract_conditions?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          issued_by?: string | null
          milestones?: Json | null
          opportunity_id?: string | null
          start_date?: string | null
          status?: string
          subject?: string
          supplier_accepted_at?: string | null
          supplier_id?: string
          supplier_rejected_at?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_award_id_fkey"
            columns: ["award_id"]
            isOneToOne: false
            referencedRelation: "awards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          last_login_at: string | null
          phone: string | null
          supplier_id: string | null
          tenant_id: string
          updated_at: string | null
          user_type: string
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean | null
          last_login_at?: string | null
          phone?: string | null
          supplier_id?: string | null
          tenant_id: string
          updated_at?: string | null
          user_type: string
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          phone?: string | null
          supplier_id?: string | null
          tenant_id?: string
          updated_at?: string | null
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_supplier"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_limits: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          max_annual_spend: number | null
          max_approval_amount: number
          role_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_annual_spend?: number | null
          max_approval_amount?: number
          role_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_annual_spend?: number | null
          max_approval_amount?: number
          role_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_limits_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_limits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_request_status_history: {
        Row: {
          changed_by: string | null
          created_at: string | null
          from_status: string | null
          id: string
          notes: string | null
          purchase_request_id: string
          reason: string | null
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          purchase_request_id: string
          reason?: string | null
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          purchase_request_id?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_request_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_request_status_history_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          amount: number
          code: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          id: string
          justification: string
          linked_opportunity_id: string | null
          needed_by: string | null
          outcome: string | null
          priority: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          requested_by: string
          status: string
          subject: string
          tenant_id: string
          updated_at: string | null
          validated_at: string | null
          validated_by: string | null
          validation_notes: string | null
        }
        Insert: {
          amount: number
          code?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          justification: string
          linked_opportunity_id?: string | null
          needed_by?: string | null
          outcome?: string | null
          priority?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requested_by: string
          status?: string
          subject: string
          tenant_id: string
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
        }
        Update: {
          amount?: number
          code?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          justification?: string
          linked_opportunity_id?: string | null
          needed_by?: string | null
          outcome?: string | null
          priority?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requested_by?: string
          status?: string
          subject?: string
          tenant_id?: string
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_linked_opportunity_id_fkey"
            columns: ["linked_opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_grants: {
        Row: {
          grant_id: string
          role_id: string
        }
        Insert: {
          grant_id: string
          role_id: string
        }
        Update: {
          grant_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_grants_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_grants_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_categories: {
        Row: {
          category_id: string
          id: string
          qualified_at: string | null
          status: string | null
          supplier_id: string
          valid_until: string | null
        }
        Insert: {
          category_id: string
          id?: string
          qualified_at?: string | null
          status?: string | null
          supplier_id: string
          valid_until?: string | null
        }
        Update: {
          category_id?: string
          id?: string
          qualified_at?: string | null
          status?: string | null
          supplier_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_categories_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_change_requests: {
        Row: {
          created_at: string | null
          id: string
          requested_by: string
          requested_changes: Json
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          supplier_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          requested_by: string
          requested_changes?: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          supplier_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          requested_by?: string
          requested_changes?: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          supplier_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_change_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_change_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_change_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_change_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_contacts: {
        Row: {
          created_at: string | null
          email: string
          first_name: string
          id: string
          last_name: string | null
          phone: string | null
          role: string | null
          supplier_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          first_name: string
          id?: string
          last_name?: string | null
          phone?: string | null
          role?: string | null
          supplier_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string | null
          phone?: string | null
          role?: string | null
          supplier_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_contacts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_status_history: {
        Row: {
          changed_by: string | null
          created_at: string | null
          from_status: string | null
          id: string
          notes: string | null
          reason: string | null
          supplier_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          supplier_id: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          supplier_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_status_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          accredited_at: string | null
          company_name: string
          company_type: string | null
          created_at: string | null
          deleted_at: string | null
          iban_masked: string | null
          id: string
          legal_address: Json | null
          notes: string | null
          pec: string | null
          rating_count: number | null
          rating_score: number | null
          status: string
          suspended_at: string | null
          suspension_reason: string | null
          tenant_id: string
          updated_at: string | null
          vat_number_hash: string | null
          website: string | null
        }
        Insert: {
          accredited_at?: string | null
          company_name: string
          company_type?: string | null
          created_at?: string | null
          deleted_at?: string | null
          iban_masked?: string | null
          id?: string
          legal_address?: Json | null
          notes?: string | null
          pec?: string | null
          rating_count?: number | null
          rating_score?: number | null
          status?: string
          suspended_at?: string | null
          suspension_reason?: string | null
          tenant_id: string
          updated_at?: string | null
          vat_number_hash?: string | null
          website?: string | null
        }
        Update: {
          accredited_at?: string | null
          company_name?: string
          company_type?: string | null
          created_at?: string | null
          deleted_at?: string | null
          iban_masked?: string | null
          id?: string
          legal_address?: Json | null
          notes?: string | null
          pec?: string | null
          rating_count?: number | null
          rating_score?: number | null
          status?: string
          suspended_at?: string | null
          suspension_reason?: string | null
          tenant_id?: string
          updated_at?: string | null
          vat_number_hash?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      uploaded_documents: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          document_type_id: string
          expiry_date: string | null
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          original_filename: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          storage_path: string | null
          supplier_id: string
          tenant_id: string
          updated_at: string | null
          version: number
          virus_scan_status: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          document_type_id: string
          expiry_date?: string | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path?: string | null
          supplier_id: string
          tenant_id: string
          updated_at?: string | null
          version?: number
          virus_scan_status?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          document_type_id?: string
          expiry_date?: string | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path?: string | null
          supplier_id?: string
          tenant_id?: string
          updated_at?: string | null
          version?: number
          virus_scan_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploaded_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploaded_documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploaded_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_grants: {
        Row: {
          expires_at: string | null
          grant_id: string | null
          granted_at: string | null
          granted_by: string | null
          id: string
          reason: string | null
          user_id: string | null
        }
        Insert: {
          expires_at?: string | null
          grant_id?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          expires_at?: string | null
          grant_id?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          reason?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_grants_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      contract_economic_summary: {
        Row: {
          approved_billing_total: number | null
          contract_id: string | null
          current_authorized_amount: number | null
          order_id: string | null
          original_order_amount: number | null
          pending_approval_amount: number | null
          pending_approval_count: number | null
          residual_amount: number | null
          residual_pct: number | null
          supplier_id: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_effective_grants: {
        Row: {
          grant_name: string | null
          source: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_mandatory_docs: {
        Args: { p_category_id?: string; p_supplier_id: string }
        Returns: {
          document_name: string
          document_type_id: string
          reason: string
        }[]
      }
      current_tenant_id: { Args: never; Returns: string }
      insert_audit_log: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_new_state?: Json
          p_old_state?: Json
          p_tenant_id: string
        }
        Returns: undefined
      }
      insert_purchase_request_history: {
        Args: {
          p_changed_by: string
          p_from_status: string
          p_notes?: string
          p_purchase_request_id: string
          p_reason?: string
          p_to_status: string
        }
        Returns: undefined
      }
      is_internal_user: { Args: { _user_id: string }; Returns: boolean }
      is_invited_supplier: {
        Args: { _opp_id: string; _user_id: string }
        Returns: boolean
      }
      is_purchase_operator: { Args: never; Returns: boolean }
      opportunity_tenant_id: { Args: { _opp_id: string }; Returns: string }
      user_has_grant: { Args: { grant_name: string }; Returns: boolean }
      verify_append_only: { Args: { p_table_name: string }; Returns: Json }
      verify_function_exists: {
        Args: { p_func_name: string }
        Returns: boolean
      }
      verify_rls_enabled: { Args: { p_table_name: string }; Returns: boolean }
      verify_table_exists: { Args: { p_table_name: string }; Returns: boolean }
      verify_trigger_exists: {
        Args: { p_table_name: string; p_trigger_name: string }
        Returns: boolean
      }
      verify_view_columns: {
        Args: { p_columns: string[]; p_view_name: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
