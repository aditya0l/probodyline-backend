const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.salesOrder.updateMany({
    where: { needsResync: true },
    data: { status: 'UNBOOKED' }
  });
  console.log(`Updated ${result.count} sales orders`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
