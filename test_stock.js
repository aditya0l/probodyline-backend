const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: { OR: [{ modelNumber: '7965' }, { name: { contains: '7965' } }] }
  });
  console.log("Products found:", products.map(p => ({ id: p.id, modelNumber: p.modelNumber, todaysStock: p.todaysStock })));
  
  if (products.length > 0) {
    const txs = await prisma.stockTransaction.findMany({
      where: { productId: products[0].id },
      orderBy: { date: 'asc' }
    });
    console.log("Total txs:", txs.length);
    
    let sum = 0;
    for (const tx of txs) {
      sum += tx.quantity;
      if (sum < -100) {
        console.log(`Date: ${tx.date}, Qty: ${tx.quantity}, Running: ${sum}, Type: ${tx.transactionType}`);
        break;
      }
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
