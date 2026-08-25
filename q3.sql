SELECT json_agg(json_build_object(
  'constraint_name', tc.constraint_name,
  'table_name', tc.table_name,
  'update_rule', rc.update_rule,
  'delete_rule', rc.delete_rule
))
FROM information_schema.table_constraints AS tc
JOIN information_schema.referential_constraints AS rc ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' AND tc.table_name NOT LIKE '\_%';