SELECT json_agg(json_build_object(
  'table_name', table_name,
  'column_name', column_name,
  'data_type', data_type,
  'udt_name', udt_name,
  'char_max_len', character_maximum_length,
  'num_prec', numeric_precision,
  'num_scale', numeric_scale,
  'is_nullable', is_nullable,
  'column_default', column_default
)) FROM information_schema.columns WHERE table_schema = 'public' AND table_name NOT LIKE '\_%' AND table_name != 'pg_stat_statements';