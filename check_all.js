const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const q = await prisma.quotation.findFirst({ orderBy: { createdAt: 'desc' } });
  console.log(q);
}
main().catch(console.error).finally(() => prisma.$disconnect());
