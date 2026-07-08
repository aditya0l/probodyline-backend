import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const product = await prisma.product.findFirst({ where: { modelNumber: 'AX_3012_R' } });
  if (!product) return console.log('Product not found');
  const txs = await prisma.stockTransaction.findMany({
    where: { productId: product.id },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });
  console.log('Transactions for AX_3012_R:');
  let running = 0;
  for (const tx of txs) {
    if (tx.transactionType === 'IN') running += tx.quantity;
    else if (tx.transactionType === 'OUT') running -= tx.quantity;
    console.log(`${tx.date.toISOString().split('T')[0]} | ${tx.transactionType} | ${tx.quantity} | Balance: ${running} | Ref: ${tx.referenceId}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
