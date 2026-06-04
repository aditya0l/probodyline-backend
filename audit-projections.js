const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const productId = (await prisma.product.findFirst({ where: { modelNumber: 'MB_22086_MB' } })).id;
  
  // 1. Fetch real stock
  const { currentStock } = await getRealPhysicalStock(productId);
  
  // 2. Fetch future transactions
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const futureTransactions = await prisma.stockTransaction.findMany({
    where: {
      productId,
      date: { gte: today },
    },
    orderBy: { date: 'asc' },
  });

  // Calculate Today's Physical Stock
  let futureSum = 0;
  futureTransactions.forEach((tx) => {
    const change = tx.transactionType === 'IN' ? tx.quantity : tx.transactionType === 'OUT' ? -Math.abs(tx.quantity) : tx.quantity;
    futureSum += change;
  });
  const todaysPhysicalStock = currentStock - futureSum;

  const calculateMinProjectedBalance = (startDateStr) => {
    const startDate = new Date(startDateStr);
    startDate.setHours(23, 59, 59, 999);

    let currentBalance = todaysPhysicalStock;
    for (const tx of futureTransactions) {
      const txDate = new Date(tx.date);
      if (txDate > startDate) break;
      const change = tx.transactionType === 'IN' ? tx.quantity : tx.transactionType === 'OUT' ? -Math.abs(tx.quantity) : tx.quantity;
      currentBalance += change;
    }

    let minBalance = currentBalance;
    let runningBalance = currentBalance;

    for (const tx of futureTransactions) {
      const txDate = new Date(tx.date);
      if (txDate <= startDate) continue;
      const change = tx.transactionType === 'IN' ? tx.quantity : tx.transactionType === 'OUT' ? -Math.abs(tx.quantity) : tx.quantity;
      runningBalance += change;
      if (runningBalance < minBalance) {
        minBalance = runningBalance;
      }
    }
    return minBalance;
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const plus15 = new Date(); plus15.setDate(plus15.getDate() + 15);
  const plus30 = new Date(); plus30.setDate(plus30.getDate() + 30);

  console.log(`Current Physical Stock (Now): ${todaysPhysicalStock}`);
  console.log(`Available to Promise (Today): ${calculateMinProjectedBalance(todayStr)}`);
  console.log(`Stock +15 Days (${plus15.toISOString().split('T')[0]}): ${calculateMinProjectedBalance(plus15.toISOString().split('T')[0])}`);
  console.log(`Stock +30 Days (${plus30.toISOString().split('T')[0]}): ${calculateMinProjectedBalance(plus30.toISOString().split('T')[0])}`);
}

async function getRealPhysicalStock(productId) {
    const result = await prisma.stockTransaction.aggregate({
        where: { productId },
        _sum: { quantity: true },
    });
    return { currentStock: result._sum.quantity || 0 };
}

main().catch(console.error).finally(() => prisma.$disconnect());
