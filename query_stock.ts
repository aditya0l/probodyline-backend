import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const productId = '8fe4b8ce-32b0-4ecb-99d6-583163351d53';
  const product = await prisma.product.findUnique({ where: { id: productId } });
  console.log("Product:", product?.name, "todaysStock:", product?.todaysStock);
  
  const txs = await prisma.stockTransaction.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log(`Found ${txs.length} transactions for this product.`);
  let totalIn = 0;
  let totalOut = 0;
  
  for (const tx of txs) {
    console.log(`[${tx.date.toISOString().split('T')[0]}] ${tx.transactionType} Qty: ${tx.quantity} | Ref: ${tx.referenceType} | RefId: ${tx.referenceId}`);
    if (tx.transactionType === 'IN') totalIn += tx.quantity;
    if (tx.transactionType === 'OUT') totalOut += tx.quantity;
  }
  
  console.log(`Total IN: ${totalIn}, Total OUT: ${totalOut}`);
  console.log(`Net Stock: ${totalIn - totalOut}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
