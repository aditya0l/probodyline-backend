const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const tx = await prisma.stockTransaction.findFirst({
    where: { productId: '52bd2de9-8704-43cb-a10e-6f0bee0fd903', referenceType: 'PI_BOOKING' }
  });
  console.log(tx);
}
main().catch(console.error).finally(() => prisma.$disconnect());
