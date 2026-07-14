const { PrismaClient } = require('@prisma/client');
const { getLedgerTransactions } = require('./dist/stock/allocation-algorithm');
const { formatInTimeZone } = require('date-fns-tz');

const prisma = new PrismaClient();

async function run() {
  const p = await prisma.product.findFirst({ where: { modelNumber: '22088_MB' } });
  const ledger = await getLedgerTransactions(prisma, p.id);
  const ledgerRows = ledger.data;
  
  let todaysStock = 0;
  const todayStr = formatInTimeZone(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
  const pastRows = ledgerRows.filter(r => r.date <= todayStr);
  
  console.log('todayStr:', todayStr);
  console.log('ledgerRows dates:', ledgerRows.map(r => r.date).join(', '));
  console.log('pastRows length:', pastRows.length);
  
  if (pastRows.length > 0) {
    const lastRow = pastRows[pastRows.length - 1];
    todaysStock = lastRow.todaysPhysicalStock;
    console.log('lastRow date:', lastRow.date);
    console.log('lastRow todaysPhysicalStock:', lastRow.todaysPhysicalStock);
  }
  
  console.log('FINAL todaysStock:', todaysStock);
}

run().catch(console.error).finally(() => prisma.$disconnect());
