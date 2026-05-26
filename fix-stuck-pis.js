const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find all quotations that are CONFIRMED but their associated Sales Order is UNBOOKED
  const stuckQuotations = await prisma.quotation.findMany({
    where: {
      status: 'CONFIRMED',
      salesOrder: {
        some: {
          status: 'UNBOOKED'
        }
      }
    }
  });

  console.log(`Found ${stuckQuotations.length} stuck quotations.`);

  for (const q of stuckQuotations) {
    await prisma.quotation.update({
      where: { id: q.id },
      data: { status: 'DRAFT' }
    });
    console.log(`Fixed quotation ${q.id} to DRAFT.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
