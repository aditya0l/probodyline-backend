SELECT json_agg(json_build_object(
  'table_name', tablename,
  'index_name', indexname,
  'index_def', indexdef
)) FROM pg_indexes WHERE schemaname = 'public' AND tablename NOT LIKE '\_%' AND tablename != 'pg_stat_statements';