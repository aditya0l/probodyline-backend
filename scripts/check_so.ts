import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const so = await prisma.salesOrder.findFirst({
    where: { soNumber: { contains: '20260526-002_2' } },
    include: { splits: true, quotation: true }
  });
  console.log(JSON.stringify(so, null, 2));
  
  const txs = await prisma.stockTransaction.findMany({
    where: { notes: { contains: '20260526-002_2' } }
  });
  console.log("Stock Transactions:");
  console.log(JSON.stringify(txs, null, 2));
}
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
