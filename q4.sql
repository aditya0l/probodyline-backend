SELECT json_agg(json_build_object(
  'enum_name', t.typname,
  'enum_value', e.enumlabel,
  'enum_order', e.enumsortorder
))
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public';