const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const os = await prisma.stockTransaction.groupBy({
    by: ['productId'],
    where: { referenceType: 'OPENING_STOCK' },
    _sum: { quantity: true }
  });
  console.log('Total Opening Stock grouped by Product:', os.length);
  if (os.length > 0) {
    console.log(os.slice(0, 5));
  }
}
check().finally(() => prisma.$disconnect());
