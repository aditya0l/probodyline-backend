const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const so = await prisma.salesOrder.findFirst({ where: { soNumber: 'SO-20261006-001' }, include: { items: true }});
  so.items.forEach(i => console.log(`SOItem ${i.modelNumber}: productId=${i.productId}`));
  
  const txs = await prisma.stockTransaction.findMany({
    where: { referenceId: so.quotationId, referenceType: 'PI_BOOKING' },
    include: { product: true }
  });
  txs.forEach(t => console.log(`StockTx ${t.product.modelNumber}: productId=${t.productId}`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
