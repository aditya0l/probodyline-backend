const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const so = await prisma.salesOrder.findFirst({
    where: { soNumber: 'SO-20260702-008' },
    include: { quotation: true, splits: true }
  });
  console.log("Sales Order:", so);
}
main().catch(console.error).finally(() => prisma.$disconnect());
