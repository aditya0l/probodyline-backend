/**
 * One-time repair: re-date "PO Pending" stock rows to their PO's jaipurArrival.
 *
 * Background: PurchaseOrdersService.update() only re-dated pending rows
 * (referenceType = 'PURCHASE_ORDER') when a date change came WITHOUT items, but the
 * Edit Order form always sends items, so many pending rows kept the old arrival date.
 *
 * Usage:
 *   npx ts-node scripts/redate-pending-po-stock.ts                    # dry run (default, read-only)
 *   npx ts-node scripts/redate-pending-po-stock.ts --apply            # write backup JSON, then update dates
 *   npx ts-node scripts/redate-pending-po-stock.ts --revert <file>    # restore dates from a backup JSON
 *
 * Dates are compared by calendar day in UTC (YYYY-MM-DD of the stored timestamp).
 * Only `date` of mismatched pending rows is ever changed. Split rows
 * (PURCHASE_ORDER_SPLIT) are never touched. Rows whose PO is missing, cancelled or has
 * no jaipurArrival, and pending-quantity mismatches, are reported only.
 *
 * Product.todaysStock is the sum of all stock rows regardless of date, so it does
 * not change and is not re-synced here.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '—');

type BackupEntry = { id: string; oldDate: string; newDate: string };

async function revert(file: string) {
  const entries: BackupEntry[] = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`Reverting ${entries.length} row(s) from ${file}`);
  const rows = await prisma.stockTransaction.findMany({
    where: { id: { in: entries.map((e) => e.id) } },
    select: { id: true, date: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const toRevert: BackupEntry[] = [];
  for (const e of entries) {
    const row = byId.get(e.id);
    if (!row) {
      console.log(`  skip ${e.id}: row no longer exists`);
    } else if (row.date.getTime() !== new Date(e.newDate).getTime()) {
      console.log(`  skip ${e.id}: date is now ${row.date.toISOString()}, expected ${e.newDate} (changed since apply)`);
    } else {
      toRevert.push(e);
    }
  }
  await prisma.$transaction(
    toRevert.map((e) =>
      prisma.stockTransaction.update({ where: { id: e.id }, data: { date: new Date(e.oldDate) } }),
    ),
  );
  console.log(`Reverted ${toRevert.length} row(s); skipped ${entries.length - toRevert.length}.`);
}

async function main() {
  const args = process.argv.slice(2);
  const revertIdx = args.indexOf('--revert');
  if (revertIdx !== -1) {
    const file = args[revertIdx + 1];
    if (!file) throw new Error('--revert needs a backup file path');
    return revert(file);
  }
  const apply = args.includes('--apply');

  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN (no changes; pass --apply to write)'}`);
  console.log('Dates compared by calendar day in UTC.\n');

  const rows = await prisma.stockTransaction.findMany({
    where: { referenceType: 'PURCHASE_ORDER' },
    include: { product: { select: { name: true, modelNumber: true } } },
    orderBy: { date: 'asc' },
  });

  const poIds = Array.from(new Set(rows.map((r) => r.referenceId).filter((x): x is string => !!x)));
  const pos = await prisma.purchaseOrder.findMany({
    where: { id: { in: poIds } },
    include: { items: true, splits: { include: { items: true } } },
  });
  const poById = new Map(pos.map((p) => [p.id, p]));

  const fixable: { row: (typeof rows)[number]; po: (typeof pos)[number] }[] = [];
  const skipped: { row: (typeof rows)[number]; reason: string; poNumber: string; status: string }[] = [];

  for (const row of rows) {
    const po = row.referenceId ? poById.get(row.referenceId) : undefined;
    if (!po) {
      skipped.push({ row, reason: 'PO missing/deleted', poNumber: row.referenceId ?? '(null)', status: '—' });
      continue;
    }
    if (po.status === 'CANCELLED') {
      skipped.push({ row, reason: 'PO cancelled', poNumber: po.poNumber, status: po.status });
      continue;
    }
    if (!po.jaipurArrival) {
      skipped.push({ row, reason: 'PO has no jaipurArrival', poNumber: po.poNumber, status: po.status });
      continue;
    }
    if (day(row.date) !== day(po.jaipurArrival)) fixable.push({ row, po });
  }

  const productLabel = (r: (typeof rows)[number]) =>
    `${r.product?.modelNumber ?? '?'} ${r.product?.name ?? r.productId}`.trim();

  console.log(`== Mismatched pending rows (${fixable.length}) ==`);
  console.table(
    fixable.map(({ row, po }) => ({
      po: po.poNumber,
      status: po.status,
      product: productLabel(row),
      qty: row.quantity,
      rowDate: day(row.date),
      '→ poArrival': day(po.jaipurArrival),
    })),
  );
  const affectedPos = new Set(fixable.map((f) => f.po.id)).size;
  const totalQty = fixable.reduce((s, f) => s + f.row.quantity, 0);
  console.log(`Totals: ${fixable.length} row(s), ${affectedPos} PO(s), ${totalQty} unit(s) to re-date.\n`);

  console.log(`== Pending rows NOT touched (report only) (${skipped.length}) ==`);
  if (skipped.length) {
    console.table(
      skipped.map(({ row, reason, poNumber, status }) => ({
        reason,
        po: poNumber,
        status,
        product: productLabel(row),
        qty: row.quantity,
        rowDate: day(row.date),
      })),
    );
  }
  console.log('');

  // Pending quantity check: PO item qty - sum(split item qty) vs sum of pending rows. Report only.
  const qtyIssues: any[] = [];
  for (const po of pos) {
    if (po.status === 'CANCELLED' || !po.jaipurArrival) continue;
    const pendingByProduct = new Map<string, number>();
    for (const r of rows) {
      if (r.referenceId !== po.id) continue;
      pendingByProduct.set(r.productId, (pendingByProduct.get(r.productId) ?? 0) + r.quantity);
    }
    const seen = new Set<string>();
    for (const item of po.items) {
      if (!item.productId) continue;
      seen.add(item.productId);
      const allocated = po.splits.reduce(
        (s, sp) => s + sp.items.filter((si) => si.purchaseOrderItemId === item.id).reduce((a, si) => a + si.quantity, 0),
        0,
      );
      const expected = Math.max(item.quantity - allocated, 0);
      const actual = pendingByProduct.get(item.productId) ?? 0;
      if (expected !== actual) {
        qtyIssues.push({ po: po.poNumber, status: po.status, product: `${item.modelNumber ?? ''} ${item.productName}`.trim(), poQty: item.quantity, allocated, expectedPending: expected, pendingRows: actual });
      }
    }
    for (const [pid, qty] of Array.from(pendingByProduct.entries())) {
      if (!seen.has(pid)) {
        qtyIssues.push({ po: po.poNumber, status: po.status, product: `(product ${pid} not on PO)`, poQty: 0, allocated: 0, expectedPending: 0, pendingRows: qty });
      }
    }
  }
  console.log(`== Pending quantity mismatches (report only, NOT fixed) (${qtyIssues.length}) ==`);
  if (qtyIssues.length) console.table(qtyIssues);
  console.log('');

  if (!apply) {
    console.log('Dry run complete. Nothing was changed.');
    return;
  }
  if (fixable.length === 0) {
    console.log('Nothing to apply.');
    return;
  }

  const backup: BackupEntry[] = fixable.map(({ row, po }) => ({
    id: row.id,
    oldDate: row.date.toISOString(),
    newDate: po.jaipurArrival!.toISOString(),
  }));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.resolve(process.cwd(), `redate-pending-${stamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
  console.log(`Backup written: ${backupFile}`);

  await prisma.$transaction(
    backup.map((b) => prisma.stockTransaction.update({ where: { id: b.id }, data: { date: new Date(b.newDate) } })),
  );
  console.log(`Updated ${backup.length} row(s). Undo with: npx ts-node scripts/redate-pending-po-stock.ts --revert ${backupFile}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
