const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const q = await prisma.quotation.findFirst({where: {quoteNumber: 'QO-20260611-005_1'}});
  console.log('Quotation:', q ? q.id + ' ' + q.status : 'Not found');
  const so = await prisma.salesOrder.findFirst({where: {soNumber: {contains: '005_1'}}});
  console.log('SalesOrder:', so ? so.soNumber + ' ' + so.quotationId : 'Not found');
}
main().finally(() => prisma.$disconnect());
