import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const yash = await prisma.user.findFirst({ where: { role: 'SALES' } });
  console.log('Yash ID:', yash?.id);
  
  if (yash) {
    const qCount = await prisma.quotation.count({ where: { createdBy: yash.id } });
    const sCount = await prisma.salesOrder.count({ where: { quotation: { createdBy: yash.id } } });
    const scCount = await prisma.serviceCard.count({ where: { userId: yash.id } });
    console.log('Quotation Count:', qCount);
    console.log('Sales Order Count:', sCount);
    console.log('Service Card Count:', scCount);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
