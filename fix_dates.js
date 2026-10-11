const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const txs = await prisma.stockTransaction.findMany({
    where: { notes: { startsWith: 'Direct edit add on booked SO:' } }
  });
  
  for (const tx of txs) {
    if (tx.referenceType === 'PI_BOOKING' && tx.referenceId) {
      const q = await prisma.quotation.findUnique({ where: { id: tx.referenceId }});
      if (q && q.dispatchDate) {
        console.log(`Updating tx ${tx.id} from ${tx.date} to ${q.dispatchDate}`);
        await prisma.stockTransaction.update({
          where: { id: tx.id },
          data: { date: q.dispatchDate }
        });

        // Also fix the corresponding booking record
        await prisma.booking.updateMany({
          where: {
            quotationId: tx.referenceId,
            productId: tx.productId,
          },
          data: {
            dispatchDate: q.dispatchDate,
            waitingQuantity: 0,
          }
        });
      }
    }
  }
}
run().then(() => prisma.$disconnect());
