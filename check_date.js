const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const tx = await prisma.stockTransaction.findFirst({
    where: { notes: { contains: 'Direct edit add on booked SO' } },
    orderBy: { createdAt: 'desc' }
  });
  console.log("StockTransaction:", tx);
  const so = await prisma.salesOrder.findFirst({ where: { soNumber: 'SO-20261006-001' }, include: { quotation: true }});
  console.log("SO Quotation Booking Date:", so.quotation.bookingDate);
  console.log("Current Server Time:", new Date());
}
main().catch(console.error).finally(() => prisma.$disconnect());
