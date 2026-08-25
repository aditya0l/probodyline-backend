import { execSync } from "child_process";
import fs from "fs";

fs.writeFileSync("q1.sql", `SELECT json_agg(json_build_object(
  'table_name', table_name,
  'column_name', column_name,
  'data_type', data_type,
  'udt_name', udt_name,
  'char_max_len', character_maximum_length,
  'num_prec', numeric_precision,
  'num_scale', numeric_scale,
  'is_nullable', is_nullable,
  'column_default', column_default
)) FROM information_schema.columns WHERE table_schema = 'public' AND table_name NOT LIKE '\\_%' AND table_name != 'pg_stat_statements';`);

fs.writeFileSync("q2.sql", `SELECT json_agg(json_build_object(
  'table_name', tablename,
  'index_name', indexname,
  'index_def', indexdef
)) FROM pg_indexes WHERE schemaname = 'public' AND tablename NOT LIKE '\\_%' AND tablename != 'pg_stat_statements';`);

fs.writeFileSync("q3.sql", `SELECT json_agg(json_build_object(
  'constraint_name', tc.constraint_name,
  'table_name', tc.table_name,
  'update_rule', rc.update_rule,
  'delete_rule', rc.delete_rule
))
FROM information_schema.table_constraints AS tc
JOIN information_schema.referential_constraints AS rc ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' AND tc.table_name NOT LIKE '\\_%';`);

fs.writeFileSync("q4.sql", `SELECT json_agg(json_build_object(
  'enum_name', t.typname,
  'enum_value', e.enumlabel,
  'enum_order', e.enumsortorder
))
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public';`);

function runQuery(target: "local" | "prod", queryFile: string): any {
  const cmdLocal = `psql postgresql://probodyline:testpassword@127.0.0.1:5444/probodyline_test -t -A < ${queryFile}`;
  const cmdProd = `ssh probodyline 'psql postgresql://probodyline:StrongPassword123@localhost:5432/probodyline_db -t -A' < ${queryFile}`;

  try {
    const output = execSync(target === "local" ? cmdLocal : cmdProd, { encoding: "utf8" }).trim();
    if (!output || output === "") return [];
    return JSON.parse(output) || [];
  } catch (e) {
    console.error("Query execution failed for", target, queryFile);
    return [];
  }
}

function run() {
  const results: any[] = [];

  const locCols = runQuery("local", "q1.sql");
  const locIdxs = runQuery("local", "q2.sql");
  const locFks = runQuery("local", "q3.sql");
  const locEnums = runQuery("local", "q4.sql");

  const prodCols = runQuery("prod", "q1.sql");
  const prodIdxs = runQuery("prod", "q2.sql");
  const prodFks = runQuery("prod", "q3.sql");
  const prodEnums = runQuery("prod", "q4.sql");

  const allTables = new Set([...locCols.map((x:any)=>x.table_name), ...prodCols.map((x:any)=>x.table_name)]);
  for (const t of allTables) {
    const lp = locCols.filter((x:any)=>x.table_name === t);
    const pp = prodCols.filter((x:any)=>x.table_name === t);

    const allC = new Set([...lp.map((x:any)=>x.column_name), ...pp.map((x:any)=>x.column_name)]);
    for (const c of allC) {
      const lc = lp.find((x:any)=>x.column_name === c);
      const pc = pp.find((x:any)=>x.column_name === c);

      if (!lc) {
        results.push([`${t}.${c}`, 'Column missing in schema.prisma', pc.data_type, 'N/A', 'HIGH']);
      } else if (!pc) {
        results.push([`${t}.${c}`, 'Column missing in production', 'N/A', lc.data_type, 'HIGH']);
      } else {
        const typeL = `${lc.data_type}(${lc.udt_name}) ${lc.char_max_len || lc.num_prec || ''}`;
        const typeP = `${pc.data_type}(${pc.udt_name}) ${pc.char_max_len || pc.num_prec || ''}`;
        if (typeL !== typeP) {
          results.push([`${t}.${c}`, 'Data type mismatch', typeP, typeL, 'MED']);
        }
      }
    }
  }

  const allIdxs = new Set([...locIdxs.map((x:any)=>x.index_name), ...prodIdxs.map((x:any)=>x.index_name)]);
  for (const idx of allIdxs) {
    const li = locIdxs.find((x:any)=>x.index_name === idx);
    const pi = prodIdxs.find((x:any)=>x.index_name === idx);

    if (!li) {
      results.push([`${pi.table_name}/${idx}`, 'Index/Constraint missing in schema.prisma', pi.index_def, 'N/A', 'HIGH']);
    } else if (!pi) {
      results.push([`${li.table_name}/${idx}`, 'Index/Constraint missing in production', 'N/A', li.index_def, 'MED']);
    } else if (li.index_def !== pi.index_def) {
      results.push([`${li.table_name}/${idx}`, 'Index/Constraint definition mismatch', pi.index_def, li.index_def, 'HIGH']);
    }
  }

  const allFks = new Set([...locFks.map((x:any)=>x.constraint_name), ...prodFks.map((x:any)=>x.constraint_name)]);
  for (const fk of allFks) {
    const lf = locFks.find((x:any)=>x.constraint_name === fk);
    const pf = prodFks.find((x:any)=>x.constraint_name === fk);

    if (!lf) {
      results.push([`${pf.table_name}/${fk}`, 'FK missing in schema.prisma', `U:${pf.update_rule} D:${pf.delete_rule}`, 'N/A', 'HIGH']);
    } else if (!pf) {
      results.push([`${lf.table_name}/${fk}`, 'FK missing in production', 'N/A', `U:${lf.update_rule} D:${lf.delete_rule}`, 'HIGH']);
    } else if (lf.update_rule !== pf.update_rule || lf.delete_rule !== pf.delete_rule) {
      results.push([`${lf.table_name}/${fk}`, 'FK Action mismatch', `U:${pf.update_rule} D:${pf.delete_rule}`, `U:${lf.update_rule} D:${lf.delete_rule}`, 'HIGH']);
    }
  }

  const allEnums = new Set([...locEnums.map((x:any)=>x.enum_name), ...prodEnums.map((x:any)=>x.enum_name)]);
  for (const en of allEnums) {
    const le = locEnums.filter((x:any)=>x.enum_name === en).sort((a:any,b:any)=>a.enum_order - b.enum_order).map((x:any)=>x.enum_value).join(',');
    const pe = prodEnums.filter((x:any)=>x.enum_name === en).sort((a:any,b:any)=>a.enum_order - b.enum_order).map((x:any)=>x.enum_value).join(',');
    if (le !== pe) {
      results.push([en, 'Enum definition mismatch', pe || 'N/A', le || 'N/A', 'HIGH']);
    }
  }

  const out = `| Table/Field | Discrepancy Type | Production Value | Schema.prisma Value | Risk Level |
|-------------|------------------|------------------|---------------------|------------|
${results.length === 0 ? '| (None) | No discrepancies found | - | - | - |' : results.map(r => `| ${r[0]} | ${r[1]} | \`${r[2]}\` | \`${r[3]}\` | **${r[4]}** |`).join('\n')}
`;
  console.log(out);
}
run();
