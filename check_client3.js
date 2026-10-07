const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const c = await prisma.client.findFirst({ where: { clientCode: '2026-10-03/RJ/BHATKAL/MR.VAENKETSHWAR/A' } });
  console.log(c);
}
main().catch(console.error).finally(() => prisma.$disconnect());
