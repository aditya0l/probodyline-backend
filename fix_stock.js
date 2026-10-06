const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const soNumber = 'SO-20261006-001';
  const so = await prisma.salesOrder.findFirst({ where: { soNumber }, include: { items: true } });
  if (!so) {
    console.log('SO not found');
    return;
  }
  
  const quotationId = so.quotationId;
  console.log('Quotation ID:', quotationId);
  
  // Find all PI_BOOKING stock OUT transactions for this quotation
  const txs = await prisma.stockTransaction.findMany({
    where: {
      referenceId: quotationId,
      referenceType: 'PI_BOOKING',
      transactionType: 'OUT'
    },
    include: { product: true }
  });
  
  console.log('Found PI_BOOKING transactions:');
  for (const tx of txs) {
    // Check if this product is still in the SO
    const inSo = so.items.some(item => item.productId === tx.productId);
    console.log(`- Product: ${tx.product.modelNumber || tx.product.name}, Qty: ${tx.quantity}, In SO: ${inSo}`);
    
    if (!inSo) {
      console.log(`  -> Deleting orphaned stock transaction ${tx.id}`);
      await prisma.stockTransaction.delete({ where: { id: tx.id } });
      
      // Also delete any orphaned Bookings for this product
      const deletedBookings = await prisma.booking.deleteMany({
        where: {
          quotationId,
          productId: tx.productId
        }
      });
      console.log(`  -> Deleted ${deletedBookings.count} orphaned bookings`);
      
      // And QuotationItems
      const deletedQItems = await prisma.quotationItem.deleteMany({
        where: {
          quotationId,
          productId: tx.productId
        }
      });
      console.log(`  -> Deleted ${deletedQItems.count} orphaned QuotationItems`);
    }
  }
  
  // We should also check J_038_MB. If it IS in the SO, maybe it has duplicated PI_BOOKINGs?
  // Let's check how many times it appears.
  const j038Items = so.items.filter(i => i.modelNumber === 'J_038_MB');
  const j038Txs = txs.filter(t => t.product.modelNumber === 'J_038_MB');
  console.log(`J_038_MB in SO: ${j038Items.length}, PI_BOOKINGs: ${j038Txs.length}`);
  
  if (j038Txs.length > j038Items.length) {
    // There's a duplicate PI_BOOKING. Delete the latest one (which was the added one)
    console.log(`  -> Deleting duplicate stock transaction ${j038Txs[j038Txs.length - 1].id}`);
    await prisma.stockTransaction.delete({ where: { id: j038Txs[j038Txs.length - 1].id } });
    
    // Also cleanup duplicate Booking and QuotationItem if needed
    // But they might not have duplicate bookings, let's check
    const bookings = await prisma.booking.findMany({ where: { quotationId, product: { modelNumber: 'J_038_MB' } } });
    if (bookings.length > j038Items.length) {
       await prisma.booking.delete({ where: { id: bookings[bookings.length - 1].id } });
    }
    const qitems = await prisma.quotationItem.findMany({ where: { quotationId, product: { modelNumber: 'J_038_MB' } } });
    if (qitems.length > j038Items.length) {
       await prisma.quotationItem.delete({ where: { id: qitems[qitems.length - 1].id } });
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
