import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Focus on the big mismatches to find root cause
  const mismatched = [
    { model: '7965', drift: -179 },
    { model: 'RMB_005A', drift: -55 },
    { model: 'RMB_015', drift: -50 },
  ];

  for (const m of mismatched) {
    const products = await prisma.product.findMany({
      where: { modelNumber: m.model }
    });
    
    for (const p of products) {
      console.log(`\n============ ${p.modelNumber} | ${p.name} ============`);
      console.log(`todaysStock in DB: ${p.todaysStock}`);

      // Full transaction log
      const txs = await prisma.stockTransaction.findMany({
        where: { productId: p.id },
        orderBy: { createdAt: 'asc' }
      });

      console.log(`\nAll ${txs.length} transactions (sorted by createdAt):`);
      let runningSum = 0;
      for (const tx of txs) {
        runningSum += tx.quantity;
        console.log(`  [created: ${tx.createdAt.toISOString().substring(0,19)}] [date: ${tx.date.toISOString().substring(0,10)}] ${tx.transactionType.padEnd(4)} | qty: ${String(tx.quantity).padStart(5)} | running: ${String(runningSum).padStart(5)} | ref: ${(tx.referenceType ?? 'NONE').padEnd(16)} | refId: ${tx.referenceId ?? 'N/A'} | notes: ${(tx.notes ?? '').substring(0,50)}`);
      }
      console.log(`\nFinal running sum: ${runningSum}`);
      console.log(`todaysStock in DB: ${p.todaysStock}`);
      console.log(`Drift: ${(p.todaysStock ?? 0) - runningSum}`);

      // Now check: how was todaysStock updated over time?
      // Check the updatedAt of the product
      console.log(`\nProduct updatedAt: ${p.updatedAt.toISOString()}`);
    }
  }

  // Also: check the bookDispatchSplit code path - what happens to todaysStock?
  // Look for products where todaysStock != 0 but have ZERO transactions
  console.log(`\n\n============ PRODUCTS WITH todaysStock != 0 BUT ZERO TRANSACTIONS ============`);
  const allProducts = await prisma.product.findMany();
  for (const p of allProducts) {
    const count = await prisma.stockTransaction.count({ where: { productId: p.id } });
    if (count === 0 && (p.todaysStock ?? 0) !== 0) {
      console.log(`  ${p.modelNumber} | ${(p.name ?? '').substring(0,40)} | todaysStock: ${p.todaysStock} | txns: 0`);
    }
  }

  // Check: how does bookDispatchSplit update todaysStock directly?
  console.log(`\n\n============ CHECKING decrement/increment patterns in code ============`);
  console.log(`(This needs code analysis - checking product update patterns for direct todaysStock changes)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
