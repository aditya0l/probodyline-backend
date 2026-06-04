const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function processStrictFifoLedger(transactions) {
    let runningStock = 0;
    const ledger = [];
    let waitingListQueue = [];

    const outTransactions = [];
    const inTransactions = [];

    for (const t of transactions) {
        if (t.transactionType === 'IN' || t.transactionType === 'PURCHASE') {
            inTransactions.push(t);
        } else if (t.transactionType === 'OUT' || t.transactionType === 'SALE') {
            outTransactions.push(t);
        } else {
            if (t.quantity > 0) inTransactions.push(t);
            else if (t.quantity < 0) outTransactions.push(t);
        }
    }

    outTransactions.sort((a, b) => {
        const dateA = new Date(a.bookedOn || a.createdAt).getTime();
        const dateB = new Date(b.bookedOn || b.createdAt).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    inTransactions.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const timeline = [...inTransactions, ...outTransactions].sort((a, b) => {
        const isAIn = a.transactionType === 'IN' || a.transactionType === 'PURCHASE' || a.quantity > 0;
        const isBIn = b.transactionType === 'IN' || b.transactionType === 'PURCHASE' || b.quantity > 0;
        
        let dateA, dateB;
        if (isAIn) {
            dateA = new Date(a.date).getTime();
        } else {
            dateA = new Date(a.bookedOn || a.createdAt).getTime();
        }
        
        if (isBIn) {
            dateB = new Date(b.date).getTime();
        } else {
            dateB = new Date(b.bookedOn || b.createdAt).getTime();
        }

        if (dateA !== dateB) return dateA - dateB;
        
        if (isAIn && !isBIn) return -1;
        if (!isAIn && isBIn) return 1;

        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    for (const tx of timeline) {
        const isIN = tx.transactionType === 'IN' || tx.transactionType === 'PURCHASE' || tx.quantity > 0;
        
        if (isIN) {
            runningStock += tx.quantity;
            ledger.push({ ...tx, status: 'CONFIRM', runningBalance: runningStock });
        } else {
            const requiredQty = Math.abs(tx.quantity);
            let status = 'SAFE';
            let waitingQuantity = 0;

            if (runningStock >= requiredQty) {
                status = 'CONFIRM';
                runningStock -= requiredQty;
            } else {
                status = 'WAITING_LIST';
                waitingQuantity = requiredQty - Math.max(0, runningStock);
                runningStock -= requiredQty;
                waitingListQueue.push(tx.id);
            }

            ledger.push({
                ...tx,
                status,
                waitingQuantity,
                runningBalance: runningStock + requiredQty
            });
        }
    }

    return ledger;
}

async function main() {
  const totalBookings = await prisma.booking.count();
  const totalTransactions = await prisma.stockTransaction.count();
  const totalProducts = await prisma.product.count();

  const productCounts = await prisma.booking.groupBy({
    by: ['productId'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 1
  });
  
  const worstCase = productCounts.length > 0 ? productCounts[0]._count.id : 0;
  
  console.log(`STATS_START`);
  console.log(`Total Bookings: ${totalBookings}`);
  console.log(`Total Transactions: ${totalTransactions}`);
  console.log(`Total Products: ${totalProducts}`);
  console.log(`Worst-case Bookings for single product: ${worstCase}`);
  console.log(`STATS_END`);

  const runBenchmark = (count) => {
    const mockTx = [];
    for (let i = 0; i < count; i++) {
        mockTx.push({
            id: `tx_${i}`,
            transactionType: Math.random() > 0.5 ? 'IN' : 'OUT',
            quantity: Math.random() > 0.5 ? 5 : -1,
            date: new Date(Date.now() + Math.random() * 10000000000),
            bookedOn: new Date(Date.now() + Math.random() * 10000000000),
            createdAt: new Date(),
        });
    }
    const start = process.hrtime.bigint();
    processStrictFifoLedger(mockTx);
    const end = process.hrtime.bigint();
    return Number(end - start) / 1000000.0;
  }
  
  console.log(`BENCHMARK_START`);
  console.log(`1,000 records: ${runBenchmark(1000).toFixed(2)} ms`);
  console.log(`10,000 records: ${runBenchmark(10000).toFixed(2)} ms`);
  console.log(`50,000 records: ${runBenchmark(50000).toFixed(2)} ms`);
  console.log(`100,000 records: ${runBenchmark(100000).toFixed(2)} ms`);
  console.log(`BENCHMARK_END`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
