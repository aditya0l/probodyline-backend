const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const q = await prisma.quotation.findFirst({ include: { clients: true, customer: true }, orderBy: { createdAt: 'desc' } });
  console.log('Quotation ClientName:', q.clientName);
  console.log('Customer:', q.customer);
  console.log('Clients:', q.clients);
}
main().catch(console.error).finally(() => prisma.$disconnect());
