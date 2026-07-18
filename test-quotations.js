const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const qs = await prisma.quotation.findMany({
    take: 5,
    select: { id: true, quoteNumber: true, clientName: true }
  });
  console.log("Recent Quotations:", qs);
}
main().catch(console.error).finally(() => prisma.$disconnect());
