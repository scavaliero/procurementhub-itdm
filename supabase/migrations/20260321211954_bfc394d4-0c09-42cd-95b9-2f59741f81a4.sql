
-- RPC di verifica per setup_verify_v2.js

CREATE OR REPLACE FUNCTION verify_table_exists(p_table_name TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = p_table_name AND c.relkind IN ('r','p')
  );
$$;

CREATE OR REPLACE FUNCTION verify_trigger_exists(p_table_name TEXT, p_trigger_name TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = p_table_name AND t.tgname = p_trigger_name
  );
$$;

CREATE OR REPLACE FUNCTION verify_rls_enabled(p_table_name TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.relrowsecurity FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = p_table_name;
$$;

CREATE OR REPLACE FUNCTION verify_function_exists(p_func_name TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = p_func_name
  );
$$;

CREATE OR REPLACE FUNCTION verify_view_columns(p_view_name TEXT, p_columns TEXT[])
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result JSONB := '[]'::JSONB;
  col TEXT;
  col_exists BOOLEAN;
BEGIN
  FOR col IN SELECT unnest(p_columns) LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = p_view_name AND column_name = col
    ) INTO col_exists;
    result := result || jsonb_build_object('col', col, 'present', col_exists)::JSONB;
  END LOOP;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION verify_append_only(p_table_name TEXT)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'has_no_update_rule', EXISTS (
      SELECT 1 FROM pg_rules WHERE schemaname = 'public' AND tablename = p_table_name AND rulename LIKE '%no_update%'
    ),
    'has_no_delete_rule', EXISTS (
      SELECT 1 FROM pg_rules WHERE schemaname = 'public' AND tablename = p_table_name AND rulename LIKE '%no_delete%'
    )
  );
$$;
