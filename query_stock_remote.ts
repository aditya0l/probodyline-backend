import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkProduct(modelNumber: string) {
  const products = await prisma.product.findMany({
    where: { modelNumber: { contains: modelNumber, mode: 'insensitive' } }
  });
  
  if (products.length === 0) {
    console.log(`No product found for model: ${modelNumber}`);
    return;
  }
  
  for (const product of products) {
    console.log(`\n===========================================`);
    console.log(`Product: ${product.name} (Model: ${product.modelNumber})`);
    console.log(`todaysStock: ${product.todaysStock}`);
    
    const txs = await prisma.stockTransaction.findMany({
      where: { productId: product.id },
      orderBy: { date: 'asc' }
    });
    
    console.log(`Found ${txs.length} transactions:`);
    let totalIn = 0;
    let totalOut = 0;
    
    for (const tx of txs) {
      console.log(`[${tx.date.toISOString().split('T')[0]}] ${tx.transactionType.padEnd(4)} | Qty: ${tx.quantity.toString().padStart(4)} | Ref: ${(tx.referenceType || 'NONE').padEnd(14)} | ID: ${tx.referenceId || 'N/A'}`);
      if (tx.transactionType === 'IN') totalIn += tx.quantity;
      if (tx.transactionType === 'OUT' || tx.transactionType === 'SALE') totalOut += tx.quantity;
    }
    
    console.log(`\nSummary for ${product.name}:`);
    console.log(`Total IN: ${totalIn}`);
    console.log(`Total OUT: ${totalOut}`);
    console.log(`Calculated Net Stock: ${totalIn - totalOut}`);
    console.log(`Current todaysStock value in DB: ${product.todaysStock}`);
    console.log(`===========================================\n`);
  }
}

async function main() {
  await checkProduct('7965');
  await checkProduct('7930');
}

main().catch(console.error).finally(() => prisma.$disconnect());
