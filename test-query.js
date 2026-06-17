const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const so = await prisma.salesOrder.findFirst({
    where: { soNumber: 'SO-20260605-001' },
    include: { splits: true }
  });
  console.log(JSON.stringify(so, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
