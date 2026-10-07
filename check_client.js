const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const q = await prisma.quotation.findFirst({ where: { quoteNumber: 'QO-20261006-001' }, include: { clients: true, customer: true } });
  console.log('Quotation ClientName:', q.clientName);
  console.log('Customer:', q.customer);
  console.log('Clients:', q.clients);
}
main().catch(console.error).finally(() => prisma.$disconnect());
