INSERT INTO public.grants (name, module, description)
SELECT 'export_data', 'system', 'Permette di esportare dati in CSV'
WHERE NOT EXISTS (SELECT 1 FROM public.grants WHERE name = 'export_data');