const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const so = await prisma.salesOrder.findFirst({ where: { soNumber: 'SO-20261006-001' }, include: { items: true, quotation: true }});
  console.log("SO Items:");
  so.items.forEach(i => console.log(`- ${i.modelNumber} (Qty: ${i.quantity}) (ID: ${i.id}) (QItemId: ${i.quotationItemId})`));
  
  const txs = await prisma.stockTransaction.findMany({
    where: { referenceId: so.quotationId, referenceType: 'PI_BOOKING' },
    include: { product: true }
  });
  console.log("\nStock Transactions for this SO:");
  txs.forEach(t => console.log(`- ${t.product.modelNumber} (Qty: ${t.quantity}) (Date: ${t.date}) (Notes: ${t.notes})`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
