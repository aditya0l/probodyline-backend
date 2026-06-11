require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany();
  console.log(`Found ${products.length} products. Syncing stock...`);
  
  let fixedCount = 0;
  for (const product of products) {
    const stockResult = await prisma.stockTransaction.aggregate({
      where: { productId: product.id },
      _sum: { quantity: true },
    });
    const currentStock = stockResult._sum.quantity || 0;
    
    if (product.todaysStock !== currentStock) {
      console.log(`Product ${product.modelNumber} (${product.name}): todaysStock ${product.todaysStock} -> ${currentStock}`);
      await prisma.product.update({
        where: { id: product.id },
        data: { todaysStock: currentStock },
      });
      fixedCount++;
    }
  }
  console.log(`Fixed ${fixedCount} products.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
