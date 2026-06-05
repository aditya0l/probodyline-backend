import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sos = await prisma.salesOrder.findMany({
    where: { status: 'UNBOOKED' },
    include: { quotation: true }
  });

  for (const so of sos) {
    if (so.quotation && so.quotation.status === 'CONFIRMED') {
      console.log(`Fixing SO ${so.soNumber}...`);
      await prisma.salesOrder.update({
        where: { id: so.id },
        data: { status: 'DRAFT' } // or whatever is considered active
      });
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
