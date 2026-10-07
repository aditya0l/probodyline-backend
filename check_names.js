const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const q = await prisma.quotation.findFirst({ orderBy: { createdAt: 'desc' } });
  console.log('clientName:', q.clientName);
  console.log('leadName:', q.leadName);
}
main().catch(console.error).finally(() => prisma.$disconnect());
