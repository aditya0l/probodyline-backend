import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const yash = await prisma.user.findFirst({ where: { role: 'SALES', email: 'yash@probodyline.com' } });
  if (!yash) {
    const fallback = await prisma.user.findFirst({ where: { role: 'SALES' } });
    console.log('No yash@probodyline.com, using fallback:', fallback?.email);
    if (!fallback) return;
  }
  const user = yash || await prisma.user.findFirst({ where: { role: 'SALES' } });
  if (!user) return;
  console.log('Deleting data for:', user.email);

  const quotes = await prisma.quotation.findMany({ where: { createdBy: user.id } });
  const quoteIds = quotes.map(q => q.id);
  
  if (quoteIds.length > 0) {
    const salesOrders = await prisma.salesOrder.findMany({ where: { quotationId: { in: quoteIds } } });
    const soIds = salesOrders.map(so => so.id);
    
    if (soIds.length > 0) {
      await prisma.dispatchSplitItem.deleteMany({ where: { dispatchSplit: { salesOrderId: { in: soIds } } } });
      await prisma.dispatchSplit.deleteMany({ where: { salesOrderId: { in: soIds } } });
      
      // Delete Service Cards related to these Sales Orders
      await prisma.serviceCard.deleteMany({ where: { salesOrderId: { in: soIds } } });
      
      await prisma.salesOrder.deleteMany({ where: { id: { in: soIds } } });
      console.log(`Deleted ${soIds.length} Sales Orders and their items/splits/cards`);
    }
    
    await prisma.quotationItem.deleteMany({ where: { quotationId: { in: quoteIds } } });
    await prisma.quotation.deleteMany({ where: { id: { in: quoteIds } } });
    console.log(`Deleted ${quoteIds.length} Quotations and their items`);
  } else {
    console.log('No quotations found for this user.');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
