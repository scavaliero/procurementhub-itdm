import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/types";

export const categoryService = {
  async list(): Promise<Category[]> {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("code", { ascending: true });
    if (error) throw error;
    return data as Category[];
  },

  async getById(id: string): Promise<Category | null> {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as Category | null;
  },

  async create(cat: { code: string; name: string; description?: string; parent_id?: string; tenant_id: string }) {
    const { data, error } = await supabase
      .from("categories")
      .insert(cat)
      .select()
      .single();
    if (error) throw error;
    return data as Category;
  },

  async update(id: string, updates: Partial<Category>) {
    const { data, error } = await supabase
      .from("categories")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Category;
  },

  async remove(id: string) {
    const { error } = await supabase
      .from("categories")
      .update({ is_active: false })
      .eq("id", id);
    if (error) throw error;
  },
};
