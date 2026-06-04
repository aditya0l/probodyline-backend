const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const productId = (await prisma.product.findFirst({ where: { modelNumber: 'MB_22086_MB' } })).id;
  
  // 1. Fetch raw data
  const dataRaw = await prisma.stockTransaction.findMany({
    where: { productId },
    include: {
      product: { select: { modelNumber: true } }
    }
  });

  const quotationIds = dataRaw
    .filter((tx) => tx.referenceType === 'QUOTATION' || tx.referenceType === 'PI_BOOKING')
    .map((tx) => tx.referenceId);

  const quotations = await prisma.quotation.findMany({
    where: { id: { in: quotationIds } },
    select: { id: true, bookingDate: true, quoteNumber: true }
  });
  const quotationsMap = new Map(quotations.map(q => [q.id, q]));

  // 2. Pre-enrich
  const preEnriched = dataRaw.map(tx => {
    const enriched = { ...tx };
    if (tx.referenceType === 'QUOTATION' || tx.referenceType === 'PI_BOOKING') {
      const q = quotationsMap.get(tx.referenceId);
      if (q) {
        enriched.bookedOn = q.bookingDate;
        enriched.orderNumber = q.quoteNumber;
      }
    }
    return enriched;
  });

  // Print RAW OUT transactions BEFORE sort
  console.log("=========================================");
  console.log("RAW OUT TRANSACTIONS BEFORE SORT (MB_22086_MB)");
  console.log("=========================================");
  const outTxns = preEnriched.filter(tx => tx.transactionType === 'OUT');
  outTxns.forEach(tx => {
    console.log(`Order: ${tx.orderNumber || 'Unknown'} | Dispatch: ${tx.date.toISOString().split('T')[0]} | Qty: ${tx.quantity} | Raw BookedOn: ${tx.bookedOn ? tx.bookedOn.toISOString() : 'NULL'} | CreatedAt: ${tx.createdAt.toISOString()}`);
  });

  // 3. Assign sortDate and sort them
  const txs = preEnriched.map(tx => {
    let sortDate;
    if (tx.transactionType === 'IN') {
      sortDate = new Date(tx.date);
    } else {
      sortDate = tx.bookedOn ? new Date(tx.bookedOn) : (tx.createdAt ? new Date(tx.createdAt) : new Date(tx.date));
    }
    return { ...tx, sortDate };
  });

  txs.sort((a, b) => {
    const timeA = a.sortDate.getTime();
    const timeB = b.sortDate.getTime();
    if (timeA !== timeB) return timeA - timeB;
    return (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
  });

  // Print AFTER sort
  console.log("\n=========================================");
  console.log("EXACT FIFO SORTED ORDER (INs and OUTs)");
  console.log("=========================================");
  txs.forEach((tx, i) => {
    const type = tx.transactionType.padEnd(4);
    const date = tx.date.toISOString().split('T')[0];
    const qty = Math.abs(tx.quantity).toString().padEnd(3);
    const sortDateStr = tx.sortDate.toISOString();
    const orderNum = tx.orderNumber || (type === 'IN ' ? 'STOCK_IN' : 'Unknown');
    console.log(`${(i+1).toString().padStart(2)}. Type: ${type} | SortDate: ${sortDateStr} | Dispatch: ${date} | Order: ${orderNum} | Qty: ${qty}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
