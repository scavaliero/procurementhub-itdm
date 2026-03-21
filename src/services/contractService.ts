import { supabase } from "@/integrations/supabase/client";
import type { Contract, ContractEconomicSummary, Order, Supplier } from "@/types";

export type ContractWithRelations = Contract & {
  orders: Pick<Order, "code" | "subject" | "amount" | "supplier_id" | "status"> | null;
  suppliers: Pick<Supplier, "company_name"> | null;
};

export type ContractListItem = Contract & {
  orders: Pick<Order, "code" | "subject"> | null;
  suppliers: Pick<Supplier, "company_name"> | null;
};

export const contractService = {
  /** Get contract by ID with order info */
  async getById(contractId: string) {
    const { data, error } = await supabase
      .from("contracts")
      .select("*, orders(code, subject, amount, supplier_id, status), suppliers(company_name)")
      .eq("id", contractId)
      .single();
    if (error) throw error;
    return data as ContractWithRelations;
  },

  /** Get contract by order ID */
  async getByOrderId(orderId: string) {
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("order_id", orderId)
      .single();
    if (error) throw error;
    return data as Contract;
  },

  /** Get economic summary */
  async getEconomicSummary(contractId: string): Promise<ContractEconomicSummary | null> {
    const { data, error } = await supabase
      .from("contract_economic_summary")
      .select("*")
      .eq("contract_id", contractId)
      .maybeSingle();
    if (error) throw error;
    return data as ContractEconomicSummary | null;
  },

  /** List contracts for internal */
  async list() {
    const { data, error } = await supabase
      .from("contracts")
      .select("*, orders(code, subject), suppliers(company_name)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as ContractListItem[];
  },
};
