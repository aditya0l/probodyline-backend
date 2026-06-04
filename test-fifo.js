const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { processStrictFifoLedger } = require('./dist/src/utils/fifo-allocator');

async function main() {
  const productId = (await prisma.product.findFirst({ where: { modelNumber: 'MB_22086_MB' } })).id;
  
  const dataRaw = await prisma.stockTransaction.findMany({
    where: { productId },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });

  const quotationIds = dataRaw
    .filter((tx) => tx.referenceType === 'QUOTATION' || tx.referenceType === 'PI_BOOKING')
    .map((tx) => tx.referenceId);

  const quotations = await prisma.quotation.findMany({
    where: { id: { in: quotationIds } },
    select: { id: true, bookingDate: true }
  });
  const quotationsMap = new Map(quotations.map(q => [q.id, q]));

  const preEnriched = dataRaw.map(tx => {
    const enriched = { ...tx };
    if (tx.referenceType === 'QUOTATION' || tx.referenceType === 'PI_BOOKING') {
      const q = quotationsMap.get(tx.referenceId);
      if (q) enriched.bookedOn = q.bookingDate;
    }
    return enriched;
  });

  const resultsAsc = processStrictFifoLedger(preEnriched, 0);

  console.log("Date       | Type | Qty | BookedOn         | SortDate         | Status       | Wait | RunBal");
  console.log("-------------------------------------------------------------------------------------------------");
  for (const r of resultsAsc) {
    const date = new Date(r.date).toISOString().split('T')[0];
    const type = r.transactionType.padEnd(4);
    const qty = r.quantity.toString().padEnd(3);
    const bookedOn = r.bookedOn ? new Date(r.bookedOn).toISOString().split('T')[0] : 'N/A       ';
    const sortDate = new Date(r.sortDate).toISOString().split('T')[0];
    const status = r.status.padEnd(12);
    const wait = r.waitingQuantity.toString().padEnd(4);
    const bal = r.runningBalance.toString().padEnd(4);
    
    console.log(`${date} | ${type} | ${qty} | ${bookedOn}       | ${sortDate}       | ${status} | ${wait} | ${bal}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
