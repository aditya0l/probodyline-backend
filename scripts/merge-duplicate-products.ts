/**
 * Merge duplicate products whose model numbers differ only in punctuation/case
 * (e.g. "BL05_TT" and "BL_05_TT"), so stock, orders and POs stop being split.
 *
 *   npx ts-node scripts/merge-duplicate-products.ts                       # dry run (default, writes nothing)
 *   npx ts-node scripts/merge-duplicate-products.ts --only BL05_TT        # limit to some groups (repeatable)
 *   npx ts-node scripts/merge-duplicate-products.ts --keep <productId>    # force the keeper of its group (repeatable)
 *   npx ts-node scripts/merge-duplicate-products.ts --apply [...]         # backup JSON, then merge (one transaction per group)
 *   npx ts-node scripts/merge-duplicate-products.ts --revert <file.json>  # dry run of the revert
 *   npx ts-node scripts/merge-duplicate-products.ts --revert <file.json> --apply
 *
 * DATABASE_URL is read from the environment / .env (same as the app and prisma.config.ts).
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { Prisma, PrismaClient, type Product } from '@prisma/client';
import { modelKey } from '../src/products/model-key';

// ---------------------------------------------------------------------------
// Every place in prisma/schema.prisma that points at a product, by id or by
// model-number string. Kept in sync with the schema by
// src/products/merge-duplicate-products.spec.ts (it parses schema.prisma and
// fails if a Product relation / productId field / model-number copy is missing).
//
//   repoint              -> rows are moved from the duplicate to the keeper
//   rewrite-model-array  -> String[] of model numbers on other products; entries
//                           spelling the group's model are rewritten to the keeper's
//   report-only          -> historical snapshot / free text; counted, never changed
// ---------------------------------------------------------------------------
export type RefAction = 'repoint' | 'rewrite-model-array' | 'report-only';

export interface ProductReference {
  model: string; // Prisma model name
  table: string; // @@map table
  field: string;
  holds: 'productId' | 'modelNumber';
  match: 'equals' | 'has' | 'contains';
  action: RefAction;
  extraWhere?: Record<string, unknown>;
  note: string;
}

export const PRODUCT_REFERENCES: ProductReference[] = [
  // Quotation lines. FK (onDelete SetNull), no unique constraint on productId.
  { model: 'QuotationItem', table: 'quotation_items', field: 'productId', holds: 'productId', match: 'equals', action: 'repoint', note: 'quotation line -> product (FK)' },
  // Sales-order lines. FK, no unique constraint.
  { model: 'SalesOrderItem', table: 'sales_order_items', field: 'productId', holds: 'productId', match: 'equals', action: 'repoint', note: 'sales order line -> product (FK)' },
  // Purchase-order lines. FK, no unique constraint. PO split items / factory split
  // items hang off purchaseOrderItemId, so they follow automatically.
  { model: 'PurchaseOrderItem', table: 'purchase_order_items', field: 'productId', holds: 'productId', match: 'equals', action: 'repoint', note: 'PO line -> product (FK); split + factory split items follow via purchaseOrderItemId' },
  // Stock ledger (IN/OUT/OPENING_STOCK...). todaysStock is the SUM of these, so
  // moving them is what merges stock. Opening stock is read as a SUM per product,
  // so two OPENING_STOCK rows on the keeper add up correctly.
  { model: 'StockTransaction', table: 'stock_transactions', field: 'productId', holds: 'productId', match: 'equals', action: 'repoint', note: 'stock ledger (FK, cascade); drives todaysStock' },
  // Bookings against dispatch dates. FK, no unique constraint.
  { model: 'Booking', table: 'bookings', field: 'productId', holds: 'productId', match: 'equals', action: 'repoint', note: 'booking -> product (FK)' },
  // WhatsApp share events (popularity badges). Plain column, no FK.
  { model: 'ProductShareEvent', table: 'product_share_events', field: 'productId', holds: 'productId', match: 'equals', action: 'repoint', note: 'share events (no FK); feeds Bestseller/Popular badges' },
  // Generic audit trail; history of the duplicate stays as it was.
  { model: 'AuditLog', table: 'audit_logs', field: 'entityId', holds: 'productId', match: 'equals', action: 'report-only', extraWhere: { entityType: 'Product' }, note: "polymorphic (entityType='Product'); history, left alone" },

  // Model-number arrays on OTHER products (resolved with modelNumber IN (...) AND deletedAt IS NULL,
  // so they would break once the duplicate is soft-deleted/renamed).
  { model: 'Product', table: 'products', field: 'cousinMachine', holds: 'modelNumber', match: 'has', action: 'rewrite-model-array', note: 'String[] of model numbers' },
  { model: 'Product', table: 'products', field: 'orderTogether', holds: 'modelNumber', match: 'has', action: 'rewrite-model-array', note: 'String[] of model numbers' },
  { model: 'Product', table: 'products', field: 'swapMachine', holds: 'modelNumber', match: 'has', action: 'rewrite-model-array', note: 'String[] of model numbers' },

  // Denormalised snapshots kept "for historical accuracy" on documents: left untouched.
  { model: 'QuotationItem', table: 'quotation_items', field: 'modelNumber', holds: 'modelNumber', match: 'equals', action: 'report-only', note: 'snapshot copied at quote time' },
  { model: 'QuotationItem', table: 'quotation_items', field: 'cousinMachine', holds: 'modelNumber', match: 'contains', action: 'report-only', note: 'snapshot (joined string)' },
  { model: 'QuotationItem', table: 'quotation_items', field: 'orderTogether', holds: 'modelNumber', match: 'contains', action: 'report-only', note: 'snapshot (joined string)' },
  { model: 'QuotationItem', table: 'quotation_items', field: 'swapMachine', holds: 'modelNumber', match: 'contains', action: 'report-only', note: 'snapshot (joined string)' },
  { model: 'SalesOrderItem', table: 'sales_order_items', field: 'modelNumber', holds: 'modelNumber', match: 'equals', action: 'report-only', note: 'snapshot' },
  { model: 'PurchaseOrderItem', table: 'purchase_order_items', field: 'modelNumber', holds: 'modelNumber', match: 'equals', action: 'report-only', note: 'snapshot' },
  { model: 'Booking', table: 'bookings', field: 'modelNumber', holds: 'modelNumber', match: 'equals', action: 'report-only', note: 'snapshot' },
  { model: 'ChallanItem', table: 'challan_items', field: 'modelNos', holds: 'modelNumber', match: 'contains', action: 'report-only', note: 'free text on challans' },
];
// Checked and NOT product references: DispatchSplitItem / QuantityChangeRequest
// (via quotation/sales-order item ids), PurchaseOrderSplitItem (via PO item id),
// ServiceCard.productNotes (JSON keyed by sales-order item id),
// SalesOrderActivity.details (free text), Category.products (FK lives on Product).

export const refLabel = (r: Pick<ProductReference, 'model' | 'field'>) => `${r.model}.${r.field}`;

// Product fields copied from a duplicate only when the keeper's are empty.
// Fields in one unit travel together (keyed on the first one), so e.g. a
// thumbnail never gets paired with another product's image.
export const MERGE_FIELD_UNITS: string[][] = [
  ['image', 'thumbnail', 'lqip'],
  ['images'],
  ['brochureUrl', 'brochureFilename', 'brochureSize'],
  ['brochure'],
  ['instagramLink'],
  ['youtubeLink'],
  ['cartonLabel'],
  ['machineArtwork'],
  ['mrpStickers'],
  ['customDeclarations'],
  ['packagingDescription'],
  ['keyword'],
  ['notes'],
  ['name'],
  ['seriesName'],
  ['productType'],
  ['categoryId'],
  ['price'],
  ['brand'],
  ['warranty'],
  ['cousinMachine'],
  ['orderTogether'],
  ['swapMachine'],
  // Stock-by-date overrides: copied only if the keeper has none at all; when both
  // have values it is reported for manual review (not clearly additive).
  ['stockByDate'],
];

export const MODEL_ARRAY_FIELDS = ['cousinMachine', 'orderTogether', 'swapMachine'] as const;

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)
// ---------------------------------------------------------------------------
export interface Groupable {
  id: string;
  modelNumber: string;
  createdAt: Date;
}

/** Groups by modelKey; drops blank keys and singletons. Members sorted oldest first. */
export function groupByModelKey<T extends Groupable>(products: T[]): Map<string, T[]> {
  const all = new Map<string, T[]>();
  for (const p of products) {
    const key = modelKey(p.modelNumber);
    if (!key) continue;
    const list = all.get(key);
    if (list) list.push(p);
    else all.set(key, [p]);
  }
  const out = new Map<string, T[]>();
  for (const [key, list] of [...all.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (list.length < 2) continue;
    out.set(key, [...list].sort(byAge));
  }
  return out;
}

const byAge = (a: Groupable, b: Groupable) =>
  a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);

/**
 * Keeper = forced by --keep if one of the members, else the most referencing
 * rows, tie -> oldest createdAt (then id, for determinism).
 */
export function chooseKeeper<T extends Groupable>(
  members: T[],
  refCounts: Map<string, number>,
  keepIds: Set<string>,
): { keeper: T; reason: string } {
  const forced = members.filter((m) => keepIds.has(m.id));
  if (forced.length > 1) {
    throw new Error(`--keep names ${forced.length} products of the same group: ${forced.map((f) => f.id).join(', ')}`);
  }
  if (forced.length === 1) return { keeper: forced[0], reason: '--keep' };
  const sorted = [...members].sort(
    (a, b) => (refCounts.get(b.id) ?? 0) - (refCounts.get(a.id) ?? 0) || byAge(a, b),
  );
  const top = sorted[0];
  const tie = sorted.length > 1 && (refCounts.get(sorted[1].id) ?? 0) === (refCounts.get(top.id) ?? 0);
  return { keeper: top, reason: tie ? 'tie on references -> oldest' : 'most references' };
}

export function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object' && !(v instanceof Date) && !Prisma.Decimal.isDecimal(v)) {
    return Object.keys(v as object).length === 0;
  }
  return false;
}

/**
 * Fields to fill on the keeper from the duplicates (first duplicate with a value
 * wins, in the given order). Never overwrites a non-empty keeper value.
 */
export function planFieldMerge(
  keeper: Record<string, unknown>,
  duplicates: Array<Record<string, unknown> & { id: string }>,
  units: string[][] = MERGE_FIELD_UNITS,
): { updates: Record<string, { value: unknown; fromProductId: string }>; reviews: string[] } {
  const updates: Record<string, { value: unknown; fromProductId: string }> = {};
  const reviews: string[] = [];
  for (const unit of units) {
    const keyField = unit[0];
    if (!isEmptyValue(keeper[keyField])) {
      if (keyField === 'stockByDate') {
        for (const d of duplicates) {
          if (!isEmptyValue(d.stockByDate)) {
            reviews.push(`stockByDate: keeper and duplicate ${d.id} both have per-date stock overrides; NOT merged, review manually (duplicate's: ${JSON.stringify(d.stockByDate)})`);
          }
        }
      }
      continue;
    }
    const donor = duplicates.find((d) => !isEmptyValue(d[keyField]));
    if (!donor) continue;
    for (const f of unit) {
      if (isEmptyValue(keeper[f]) && !isEmptyValue(donor[f])) updates[f] = { value: donor[f], fromProductId: donor.id };
    }
  }
  return { updates, reviews };
}

/**
 * Rewrites entries of a model-number array that spell the group's model (any
 * punctuation/case) to the keeper's model number, de-duplicated, and drops
 * self-references. Returns null when nothing changes.
 */
export function rewriteModelArray(
  arr: string[] | null | undefined,
  groupKey: string,
  keeperModelNumber: string,
  ownModelNumber: string,
): string[] | null {
  if (!arr || arr.length === 0) return null;
  const ownKey = modelKey(ownModelNumber);
  const out: string[] = [];
  for (const entry of arr) {
    const k = modelKey(entry);
    const mapped = k === groupKey ? keeperModelNumber : entry;
    if (modelKey(mapped) === ownKey && ownKey === groupKey) continue; // self-reference after merge
    if (!out.includes(mapped)) out.push(mapped);
  }
  return out.length === arr.length && out.every((v, i) => v === arr[i]) ? null : out;
}

/** Product references found by parsing schema.prisma (used by the coverage test). */
export function findSchemaProductReferences(schema: string): Array<{ model: string; field: string; reason: string }> {
  const out: Array<{ model: string; field: string; reason: string }> = [];
  for (const m of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const [, model, body] = m;
    for (const raw of body.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('//') || line.startsWith('@@')) continue;
      const [name, type = ''] = line.split(/\s+/);
      const comment = line.includes('//') ? line.slice(line.indexOf('//')) : '';
      if (type.replace(/[?[\]]/g, '') === 'Product') {
        const rel = line.match(/fields:\s*\[([^\]]+)\]/);
        if (rel) for (const f of rel[1].split(',')) out.push({ model, field: f.trim(), reason: 'relation to Product' });
        continue; // a back-relation list (FK lives on Product) is not a reference
      }
      if (/productid/i.test(name)) out.push({ model, field: name, reason: 'productId-like field' });
      else if (model !== 'Product' && /^model(Number|No)s?$/i.test(name)) out.push({ model, field: name, reason: 'model number copy' });
      else if (type === 'String[]' && /model numbers?/i.test(comment)) out.push({ model, field: name, reason: 'model numbers per schema comment' });
    }
  }
  return out;
}

/** Unique constraints in a model that include the given field. */
export function uniqueConstraintsTouching(schema: string, model: string, field: string): string[] {
  const m = schema.match(new RegExp(`^model\\s+${model}\\s*\\{([\\s\\S]*?)^\\}`, 'm'));
  if (!m) return [];
  const hits: string[] = [];
  for (const raw of m[1].split('\n')) {
    const line = raw.trim();
    const block = line.match(/^@@(unique|id)\s*\(\s*\[([^\]]+)\]/);
    if (block && block[2].split(',').map((s) => s.trim()).includes(field)) hits.push(line);
    if (line.split(/\s+/)[0] === field && /@unique\b/.test(line)) hits.push(line);
  }
  return hits;
}

// ---------------------------------------------------------------------------
// DB side
// ---------------------------------------------------------------------------
type Db = PrismaClient | Prisma.TransactionClient;
const delegate = (db: Db, model: string): any => (db as any)[model[0].toLowerCase() + model.slice(1)];

function refWhere(ref: ProductReference, p: { id: string; modelNumber: string }): Record<string, unknown> {
  const value = ref.holds === 'productId' ? p.id : p.modelNumber;
  const cond =
    ref.match === 'has' ? { has: value } : ref.match === 'contains' ? { contains: value, mode: 'insensitive' } : value;
  const where: Record<string, unknown> = { ...(ref.extraWhere ?? {}), [ref.field]: cond };
  if (ref.model === 'Product') where.id = { not: p.id };
  return where;
}

interface MemberInfo {
  id: string;
  modelNumber: string;
  name: string | null;
  seriesName: string | null;
  createdAt: string;
  todaysStock: number | null;
  txSum: number;
  counts: Record<string, number>;
  repointTotal: number;
}

interface GroupPlan {
  key: string;
  status: 'planned' | 'pending' | 'applied' | 'reverted' | string;
  keeperId: string;
  keeperModelNumber: string;
  keepReason: string;
  members: MemberInfo[];
  duplicates: Product[]; // full rows, before
  deletedModelNumbers: Record<string, string>; // dupId -> renamed modelNumber
  repoint: Record<string, Array<{ id: string; oldProductId: string }>>;
  modelArrays: Array<{ productId: string; modelNumber: string; field: string; old: string[]; new: string[] }>;
  keeperFields: Record<string, { old: unknown; new: unknown; fromProductId: string }>;
  keeperStockBefore: number | null;
  keeperStockExpected: number;
  keeperStockAfter?: number;
  reviews: string[];
}

interface BackupFile {
  version: 1;
  createdAt: string;
  database: string;
  groups: GroupPlan[];
}

const json = (v: unknown) => JSON.stringify(v ?? null);
/** Prisma needs DbNull to null a Json column; plain null elsewhere. */
const nullFor = (field: string) => (field === 'stockByDate' ? Prisma.DbNull : null);

async function buildPlans(
  prisma: PrismaClient,
  opts: { keep: Set<string>; only: Set<string> },
  stamp: number,
): Promise<GroupPlan[]> {
  const live = await prisma.product.findMany({ where: { deletedAt: null } });
  let groups = groupByModelKey(live);
  if (opts.only.size) groups = new Map([...groups].filter(([k]) => opts.only.has(k)));
  const groupedIds = new Set([...groups.values()].flat().map((p) => p.id));
  for (const id of opts.keep) {
    if (!groupedIds.has(id)) throw new Error(`--keep ${id} is not a live product in any selected duplicate group`);
  }
  for (const k of opts.only) if (!groups.has(k)) console.warn(`! --only ${k}: no duplicate group with that key`);

  // Working copy of model arrays, so later groups plan on top of earlier ones.
  const arrays = new Map(live.map((p) => [p.id, p]));
  const allDupIds = new Set<string>();
  const plans: GroupPlan[] = [];

  for (const [key, members] of groups) {
    const infos: MemberInfo[] = [];
    const refCounts = new Map<string, number>();
    for (const p of members) {
      const counts: Record<string, number> = {};
      let repointTotal = 0;
      for (const ref of PRODUCT_REFERENCES) {
        const n: number = await delegate(prisma, ref.model).count({ where: refWhere(ref, p) });
        counts[refLabel(ref)] = n;
        if (ref.action === 'repoint') repointTotal += n;
      }
      const agg = await prisma.stockTransaction.aggregate({ where: { productId: p.id }, _sum: { quantity: true } });
      refCounts.set(p.id, repointTotal);
      infos.push({
        id: p.id,
        modelNumber: p.modelNumber,
        name: p.name,
        seriesName: p.seriesName,
        createdAt: p.createdAt.toISOString(),
        todaysStock: p.todaysStock,
        txSum: agg._sum.quantity ?? 0,
        counts,
        repointTotal,
      });
    }

    const { keeper, reason } = chooseKeeper(members, refCounts, opts.keep);
    const dups = members.filter((m) => m.id !== keeper.id).sort((a, b) => (refCounts.get(b.id) ?? 0) - (refCounts.get(a.id) ?? 0) || byAge(a, b));
    const dupIds = dups.map((d) => d.id);
    dupIds.forEach((id) => allDupIds.add(id));

    const repoint: GroupPlan['repoint'] = {};
    for (const ref of PRODUCT_REFERENCES.filter((r) => r.action === 'repoint')) {
      const rows: any[] = await delegate(prisma, ref.model).findMany({
        where: { [ref.field]: { in: dupIds } },
        select: { id: true, [ref.field]: true },
        orderBy: { id: 'asc' },
      });
      repoint[refLabel(ref)] = rows.map((r) => ({ id: r.id, oldProductId: r[ref.field] }));
    }

    const reviews: string[] = [];
    // Use the working copies: earlier groups may already have rewritten model arrays.
    const wk: any = arrays.get(keeper.id)!;
    const { updates, reviews: fieldReviews } = planFieldMerge(wk, dups.map((d) => arrays.get(d.id)!) as any);
    reviews.push(...fieldReviews);
    const keeperFields: GroupPlan['keeperFields'] = {};
    for (const [f, u] of Object.entries(updates)) keeperFields[f] = { old: wk[f], new: u.value, fromProductId: u.fromProductId };
    // Keeper's own model arrays (possibly just inherited) get the same rewrite.
    for (const f of MODEL_ARRAY_FIELDS) {
      const current = (keeperFields[f]?.new as string[] | undefined) ?? wk[f];
      const rewritten = rewriteModelArray(current, key, keeper.modelNumber, keeper.modelNumber);
      if (rewritten) keeperFields[f] = { old: wk[f], new: rewritten, fromProductId: keeperFields[f]?.fromProductId ?? keeper.id };
    }
    arrays.set(keeper.id, { ...wk, ...Object.fromEntries(Object.entries(keeperFields).map(([f, u]) => [f, u.new])) });

    const modelArrays: GroupPlan['modelArrays'] = [];
    for (const p of arrays.values()) {
      if (members.some((m) => m.id === p.id) || allDupIds.has(p.id)) continue;
      for (const f of MODEL_ARRAY_FIELDS) {
        const old = (p as any)[f] as string[];
        const next = rewriteModelArray(old, key, keeper.modelNumber, p.modelNumber);
        if (!next) continue;
        modelArrays.push({ productId: p.id, modelNumber: p.modelNumber, field: f, old, new: next });
        arrays.set(p.id, { ...p, [f]: next });
      }
    }

    // Stock-ish fields that are derived or not clearly additive: report.
    for (const d of dups) {
      if ((d.stockPlus360Days ?? 0) !== 0 || d.dateSelectStock) {
        reviews.push(`duplicate ${d.modelNumber}: stockPlus360Days=${d.stockPlus360Days} dateSelectStock=${d.dateSelectStock?.toISOString() ?? '-'} (derived/manual, not merged)`);
      }
      if (d.isFavorite && !keeper.isFavorite) reviews.push(`duplicate ${d.modelNumber} is a favourite, keeper is not (not changed)`);
      if (d.badge && d.badge !== keeper.badge) reviews.push(`duplicate ${d.modelNumber} badge=${d.badge}, keeper badge=${keeper.badge ?? '-'} (badges are recomputed from activity)`);
    }
    // Documents that will end up with two lines for the same product.
    const docChecks: Array<[string, string, any]> = [
      ['quotation', 'quotationId', prisma.quotationItem],
      ['sales order', 'salesOrderId', prisma.salesOrderItem],
      ['purchase order', 'purchaseOrderId', prisma.purchaseOrderItem],
    ];
    for (const [label, col, d] of docChecks) {
      const rows: any[] = await d.findMany({ where: { productId: { in: members.map((m) => m.id) } }, select: { [col]: true, productId: true } });
      const byDoc = new Map<string, Set<string>>();
      for (const r of rows) byDoc.set(r[col], (byDoc.get(r[col]) ?? new Set()).add(r.productId));
      const both = [...byDoc.entries()].filter(([, s]) => s.size > 1).map(([id]) => id);
      if (both.length) reviews.push(`${both.length} ${label}(s) contain lines for 2+ of these products; after merge they show the same product twice: ${both.join(', ')}`);
    }

    const keeperInfo = infos.find((i) => i.id === keeper.id)!;
    plans.push({
      key,
      status: 'planned',
      keeperId: keeper.id,
      keeperModelNumber: keeper.modelNumber,
      keepReason: reason,
      members: infos,
      duplicates: dups,
      deletedModelNumbers: Object.fromEntries(dups.map((d) => [d.id, `${d.modelNumber}_DEL_${stamp}`])),
      repoint,
      modelArrays,
      keeperFields,
      keeperStockBefore: keeperInfo.todaysStock,
      keeperStockExpected: infos.reduce((s, i) => s + i.txSum, 0),
      reviews,
    });
  }
  return plans;
}

function printReferenceList() {
  console.log('Product references (from prisma/schema.prisma):');
  for (const r of PRODUCT_REFERENCES) {
    console.log(`  ${r.action.padEnd(19)} ${`${r.table}.${r.field}`.padEnd(38)} ${r.note}`);
  }
  console.log('');
}

function printPlan(p: GroupPlan) {
  console.log(`=== group "${p.key}" (${p.members.length} products) ===`);
  for (const m of p.members) {
    const tag = m.id === p.keeperId ? `KEEP (${p.keepReason})` : 'merge -> keeper';
    console.log(`  [${tag}] ${m.modelNumber}  id=${m.id}`);
    console.log(`      name="${m.name ?? ''}" series="${m.seriesName ?? ''}" created=${m.createdAt} todaysStock=${m.todaysStock ?? '-'} txSum=${m.txSum}`);
    const nonZero = Object.entries(m.counts).filter(([, n]) => n > 0);
    console.log(`      refs: ${nonZero.length ? nonZero.map(([k, n]) => `${k}=${n}`).join('  ') : 'none'}`);
  }
  for (const d of p.duplicates) {
    const moves = Object.entries(p.repoint)
      .map(([k, rows]) => [k, rows.filter((r) => r.oldProductId === d.id).length] as const)
      .filter(([, n]) => n > 0);
    console.log(`  re-point ${d.modelNumber} -> ${p.keeperModelNumber}: ${moves.length ? moves.map(([k, n]) => `${k}=${n}`).join('  ') : 'no rows'}`);
    console.log(`      then soft-delete as "${p.deletedModelNumbers[d.id]}"`);
  }
  if (p.modelArrays.length) {
    console.log(`  model-number arrays rewritten on ${p.modelArrays.length} field(s) of other products:`);
    for (const a of p.modelArrays) console.log(`      ${a.modelNumber}.${a.field}: ${json(a.old)} -> ${json(a.new)}`);
  }
  const kf = Object.entries(p.keeperFields);
  if (kf.length) {
    console.log('  keeper fields filled (keeper empty):');
    for (const [f, u] of kf) console.log(`      ${f} <- ${short(u.new)}  (from ${u.fromProductId})`);
  }
  console.log(`  keeper todaysStock: ${p.keeperStockBefore ?? '-'} -> ${p.keeperStockExpected} (sum of all transactions)`);
  for (const r of p.reviews) console.log(`  REVIEW: ${r}`);
  console.log('');
}

const short = (v: unknown) => {
  const s = json(v);
  return s.length > 100 ? `${s.slice(0, 97)}...` : s;
};

async function recomputeStock(db: Db, productId: string): Promise<number> {
  const agg = await db.stockTransaction.aggregate({ where: { productId }, _sum: { quantity: true } });
  const stock = agg._sum.quantity ?? 0;
  await db.product.update({ where: { id: productId }, data: { todaysStock: stock } });
  return stock;
}

async function applyGroup(prisma: PrismaClient, p: GroupPlan): Promise<number> {
  return prisma.$transaction(
    async (tx) => {
      const dupIds = p.duplicates.map((d) => d.id);
      for (const ref of PRODUCT_REFERENCES.filter((r) => r.action === 'repoint')) {
        const rows = p.repoint[refLabel(ref)] ?? [];
        const d = delegate(tx, ref.model);
        if (rows.length) {
          const res = await d.updateMany({
            where: { id: { in: rows.map((r) => r.id) }, [ref.field]: { in: dupIds } },
            data: { [ref.field]: p.keeperId },
          });
          if (res.count !== rows.length) throw new Error(`${refLabel(ref)}: expected ${rows.length} rows, moved ${res.count} (data changed since planning)`);
        }
        const left = await d.count({ where: { [ref.field]: { in: dupIds } } });
        if (left) throw new Error(`${refLabel(ref)}: ${left} new row(s) appeared for the duplicate since planning; re-run`);
      }
      for (const a of p.modelArrays) {
        const cur: any = await tx.product.findUnique({ where: { id: a.productId }, select: { [a.field]: true } });
        if (json(cur?.[a.field]) !== json(a.old)) throw new Error(`${a.modelNumber}.${a.field} changed since planning`);
        await tx.product.update({ where: { id: a.productId }, data: { [a.field]: a.new } });
      }
      const fields = Object.keys(p.keeperFields);
      if (fields.length) {
        const cur: any = await tx.product.findUnique({ where: { id: p.keeperId } });
        const data: Record<string, unknown> = {};
        for (const f of fields) {
          if (json(cur[f]) !== json(p.keeperFields[f].old)) throw new Error(`keeper.${f} changed since planning`);
          data[f] = p.keeperFields[f].new ?? nullFor(f);
        }
        await tx.product.update({ where: { id: p.keeperId }, data });
      }
      for (const d of p.duplicates) {
        const res = await tx.product.updateMany({
          where: { id: d.id, deletedAt: null, modelNumber: d.modelNumber },
          data: { deletedAt: new Date(), modelNumber: p.deletedModelNumbers[d.id], todaysStock: 0 },
        });
        if (res.count !== 1) throw new Error(`duplicate ${d.modelNumber} was changed or deleted since planning`);
      }
      return recomputeStock(tx, p.keeperId);
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
}

async function revertGroup(prisma: PrismaClient, p: GroupPlan, dryRun: boolean): Promise<string[]> {
  const notes: string[] = [];
  const run = async (tx: Db) => {
    for (const [label, rows] of Object.entries(p.repoint)) {
      const ref = PRODUCT_REFERENCES.find((r) => refLabel(r) === label);
      if (!ref || !rows.length) continue;
      const byOld = new Map<string, string[]>();
      for (const r of rows) byOld.set(r.oldProductId, [...(byOld.get(r.oldProductId) ?? []), r.id]);
      for (const [oldId, ids] of byOld) {
        const where = { id: { in: ids }, [ref.field]: p.keeperId };
        const n = dryRun
          ? await delegate(tx, ref.model).count({ where })
          : (await delegate(tx, ref.model).updateMany({ where, data: { [ref.field]: oldId } })).count;
        notes.push(`${label}: ${n}/${ids.length} rows back to ${oldId}${n < ids.length ? ' (rest deleted or moved since)' : ''}`);
      }
    }
    for (const a of p.modelArrays) {
      const cur: any = await tx.product.findUnique({ where: { id: a.productId }, select: { [a.field]: true } });
      if (json(cur?.[a.field]) !== json(a.new)) {
        notes.push(`SKIP ${a.modelNumber}.${a.field}: edited since merge (now ${json(cur?.[a.field])})`);
        continue;
      }
      if (!dryRun) await tx.product.update({ where: { id: a.productId }, data: { [a.field]: a.old } });
      notes.push(`${a.modelNumber}.${a.field} -> ${json(a.old)}`);
    }
    const keeper: any = await tx.product.findUnique({ where: { id: p.keeperId } });
    for (const [f, u] of Object.entries(p.keeperFields)) {
      if (json(keeper?.[f]) !== json(u.new)) {
        notes.push(`SKIP keeper.${f}: edited since merge`);
        continue;
      }
      if (!dryRun) await tx.product.update({ where: { id: p.keeperId }, data: { [f]: u.old ?? nullFor(f) } });
      notes.push(`keeper.${f} -> ${short(u.old)}`);
    }
    for (const d of p.duplicates) {
      const cur = await tx.product.findUnique({ where: { id: d.id } });
      if (!cur) {
        notes.push(`SKIP duplicate ${d.id}: row no longer exists`);
        continue;
      }
      const taken = await tx.product.findFirst({ where: { modelNumber: d.modelNumber, id: { not: d.id } } });
      const modelNumber = taken ? cur.modelNumber : d.modelNumber;
      if (taken) notes.push(`duplicate ${d.id}: model number ${d.modelNumber} is now used by ${taken.id}; keeping "${cur.modelNumber}"`);
      if (!dryRun) await tx.product.update({ where: { id: d.id }, data: { deletedAt: d.deletedAt, modelNumber } });
      notes.push(`un-delete ${d.id} as ${modelNumber}`);
    }
    if (!dryRun) {
      for (const id of [p.keeperId, ...p.duplicates.map((d) => d.id)]) {
        notes.push(`todaysStock ${id} = ${await recomputeStock(tx, id)}`);
      }
    }
  };
  if (dryRun) await run(prisma);
  else await prisma.$transaction((tx) => run(tx), { timeout: 120_000, maxWait: 10_000 });
  return notes;
}

function describeDb(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '');
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return '(DATABASE_URL not set or unparseable)';
  }
}

export function parseArgs(argv: string[]) {
  const opts = { apply: false, help: false, keep: new Set<string>(), only: new Set<string>(), revert: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      const v = argv[++i];
      if (!v || v.startsWith('--')) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === '--apply') opts.apply = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--keep') opts.keep.add(val());
    else if (a === '--only') opts.only.add(modelKey(val()));
    else if (a === '--revert') opts.revert = val();
    else throw new Error(`unknown argument ${a}`);
  }
  return opts;
}

function writeBackup(file: string, data: BackupFile) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]);
    return;
  }
  const prisma = new PrismaClient();
  try {
    console.log(`Database: ${describeDb()}\n`);
    if (opts.revert) {
      const backup: BackupFile = JSON.parse(fs.readFileSync(opts.revert, 'utf8'));
      for (const g of backup.groups) {
        g.duplicates.forEach((d: any) => (d.deletedAt = d.deletedAt ? new Date(d.deletedAt) : null));
        if (g.status !== 'applied' && g.status !== 'pending') {
          console.log(`- group ${g.key}: status ${g.status}, nothing to revert`);
          continue;
        }
        console.log(`=== revert group "${g.key}" (${opts.apply ? 'APPLY' : 'dry run'}) ===`);
        try {
          const notes = await revertGroup(prisma, g, !opts.apply);
          notes.forEach((n) => console.log(`  ${n}`));
          if (opts.apply) {
            g.status = 'reverted';
            writeBackup(opts.revert, backup);
          }
        } catch (e) {
          console.error(`  FAILED (rolled back): ${(e as Error).message}`);
        }
      }
      if (!opts.apply) console.log('\nDry run. Re-run with --apply to revert.');
      return;
    }

    const stamp = Date.now();
    printReferenceList();
    const plans = await buildPlans(prisma, opts, stamp);
    if (!plans.length) {
      console.log('No duplicate groups found.');
      return;
    }
    plans.forEach(printPlan);
    const dupCount = plans.reduce((s, p) => s + p.duplicates.length, 0);
    console.log(`${plans.length} group(s), ${dupCount} duplicate product(s) to merge.`);
    if (!opts.apply) {
      console.log('Dry run: nothing written. Re-run with --apply (optionally --only/--keep) to merge.');
      return;
    }

    const file = path.resolve(`merge-products-${new Date(stamp).toISOString().replace(/[:.]/g, '-')}.json`);
    const backup: BackupFile = { version: 1, createdAt: new Date(stamp).toISOString(), database: describeDb(), groups: plans };
    plans.forEach((p) => (p.status = 'pending'));
    writeBackup(file, backup);
    console.log(`\nBackup written: ${file}\n`);

    for (const p of plans) {
      try {
        p.keeperStockAfter = await applyGroup(prisma, p);
        p.status = 'applied';
        const flag = p.keeperStockAfter === p.keeperStockExpected ? '' : ` (expected ${p.keeperStockExpected})`;
        console.log(`OK  ${p.key}: kept ${p.keeperModelNumber}; todaysStock ${p.keeperStockBefore ?? '-'} -> ${p.keeperStockAfter}${flag}`);
      } catch (e) {
        p.status = `failed: ${(e as Error).message}`;
        console.error(`ERR ${p.key}: rolled back, nothing changed for this group: ${(e as Error).message}`);
      }
      writeBackup(file, backup);
    }
    console.log(`\nDone. Revert with: npx ts-node scripts/merge-duplicate-products.ts --revert ${file} --apply`);
    console.log('Note: the running API caches product stats for up to 5 minutes.');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
