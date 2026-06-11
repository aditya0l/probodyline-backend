import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({ orderBy: { name: 'asc' } });

  console.log(`\n========== FULL STOCK AUDIT: ${products.length} products ==========\n`);

  const issues: any[] = [];

  for (const product of products) {
    const pName = product.name || 'UNNAMED';
    const pModel = product.modelNumber || '???';
    const pStock = product.todaysStock ?? 0;

    const txs = await prisma.stockTransaction.findMany({
      where: { productId: product.id },
      orderBy: { date: 'asc' }
    });

    const agg = await prisma.stockTransaction.aggregate({
      where: { productId: product.id },
      _sum: { quantity: true }
    });
    const aggregateSum = agg._sum.quantity ?? 0;

    let openingStockTotal = 0;
    let purchaseOrderTotal = 0;
    let piBookingTotal = 0;
    let dispatchSplitTotal = 0;
    let otherTotal = 0;
    let inCount = 0;
    let outCount = 0;

    for (const tx of txs) {
      const refType = tx.referenceType ?? 'NONE';
      if (refType === 'OPENING_STOCK') openingStockTotal += tx.quantity;
      else if (refType === 'PURCHASE_ORDER') purchaseOrderTotal += tx.quantity;
      else if (refType === 'PI_BOOKING') piBookingTotal += tx.quantity;
      else if (refType === 'DISPATCH_SPLIT') dispatchSplitTotal += tx.quantity;
      else otherTotal += tx.quantity;

      if (tx.transactionType === 'IN') inCount++;
      else if (tx.transactionType === 'OUT') outCount++;
    }

    const mismatch = pStock !== aggregateSum;

    if (mismatch || txs.length > 0) {
      if (mismatch) {
        issues.push({ name: pName, model: pModel, db: pStock, calc: aggregateSum, drift: pStock - aggregateSum });
      }

      const flag = mismatch ? '❌ MISMATCH' : '✅ OK';
      console.log(`${flag} | ${pModel.padEnd(8)} | ${pName.substring(0, 40).padEnd(40)} | DB: ${String(pStock).padStart(5)} | Calc: ${String(aggregateSum).padStart(5)} | Drift: ${String(pStock - aggregateSum).padStart(5)} | Txns: ${txs.length} (IN:${inCount} OUT:${outCount})`);
      console.log(`         Opening: ${openingStockTotal} | PO_IN: ${purchaseOrderTotal} | PI_BOOKING: ${piBookingTotal} | DISPATCH: ${dispatchSplitTotal} | Other: ${otherTotal}`);
    }
  }

  console.log(`\n\n========== SUMMARY ==========`);
  console.log(`Total products: ${products.length}`);
  console.log(`Products with MISMATCH: ${issues.length}`);

  if (issues.length > 0) {
    console.log(`\n--- MISMATCHED PRODUCTS ---`);
    for (const i of issues) {
      console.log(`  ${i.model} | ${(i.name as string).substring(0,35)} | DB: ${i.db} vs Calc: ${i.calc} (drift: ${i.drift})`);
    }
  }

  // Products with OUT but no IN
  console.log(`\n--- PRODUCTS WITH OUT BUT NO IN ---`);
  for (const product of products) {
    const txs = await prisma.stockTransaction.findMany({ where: { productId: product.id } });
    const hasIn = txs.some(t => t.transactionType === 'IN');
    const hasOut = txs.some(t => t.transactionType === 'OUT');
    if (hasOut && !hasIn) {
      console.log(`  ⚠️ ${product.modelNumber ?? '???'} | ${product.name ?? 'UNNAMED'} | todaysStock: ${product.todaysStock ?? 0} | OUT txns: ${txs.filter(t => t.transactionType === 'OUT').length}`);
    }
  }

  // Sign convention check
  console.log(`\n--- OUT QUANTITY SIGN CONVENTION (sample) ---`);
  const sampleOuts = await prisma.stockTransaction.findMany({ where: { transactionType: 'OUT' }, take: 5 });
  for (const s of sampleOuts) { console.log(`  OUT: qty=${s.quantity}, ref=${s.referenceType ?? 'NONE'}`); }
  const sampleIns = await prisma.stockTransaction.findMany({ where: { transactionType: 'IN' }, take: 5 });
  for (const s of sampleIns) { console.log(`  IN:  qty=${s.quantity}, ref=${s.referenceType ?? 'NONE'}`); }

  // Check for duplicate stock transactions (same referenceId + productId)
  console.log(`\n--- DUPLICATE TRANSACTION CHECK ---`);
  const allTxs = await prisma.stockTransaction.findMany({ where: { referenceId: { not: null } } });
  const seen = new Map<string, number>();
  for (const tx of allTxs) {
    const key = `${tx.productId}|${tx.referenceId}|${tx.referenceType}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  let dupeCount = 0;
  for (const [key, count] of seen) {
    if (count > 1) {
      dupeCount++;
      if (dupeCount <= 20) {
        const [pid, rid, rtype] = key.split('|');
        const p = products.find(pp => pp.id === pid);
        console.log(`  DUPE (${count}x): ${p?.modelNumber ?? '???'} | ${(p?.name ?? 'UNNAMED').substring(0,30)} | refType=${rtype} | refId=${rid}`);
      }
    }
  }
  console.log(`  Total duplicate groups: ${dupeCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
