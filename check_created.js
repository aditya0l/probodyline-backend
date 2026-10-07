const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const so = await prisma.salesOrder.findFirst({ where: { soNumber: 'SO-20261006-001' }});
  const txs = await prisma.stockTransaction.findMany({
    where: { referenceId: so.quotationId, referenceType: 'PI_BOOKING', product: { modelNumber: 'J_038_MB' } }
  });
  console.log("StockTx for J_038_MB:");
  txs.forEach(t => console.log(`ID: ${t.id} CreatedAt: ${t.createdAt} Qty: ${t.quantity} Notes: ${t.notes}`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
