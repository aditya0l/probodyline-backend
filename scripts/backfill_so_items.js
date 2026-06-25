const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting backfill for SalesOrderItems...");
  
  // 1. Fetch all existing Sales Orders that don't have items yet
  const salesOrders = await prisma.salesOrder.findMany({
    include: {
      quotation: {
        include: {
          items: true
        }
      },
      items: true // to check if already backfilled
    }
  });

  let backfilledCount = 0;

  for (const so of salesOrders) {
    if (so.items && so.items.length > 0) {
      console.log(`Skipping SO ${so.soNumber} - already has items.`);
      continue;
    }

    if (!so.quotation || !so.quotation.items) {
      console.log(`Skipping SO ${so.soNumber} - no quotation items found.`);
      continue;
    }

    console.log(`Backfilling SO ${so.soNumber} with ${so.quotation.items.length} items...`);
    
    // Create items for this SO
    const salesOrderItemsData = so.quotation.items.map(qi => ({
      salesOrderId: so.id,
      quotationItemId: qi.id,
      productId: qi.productId,
      productName: qi.productName,
      modelNumber: qi.modelNumber,
      quantity: qi.quantity,
      rate: qi.rate,
      mrp: qi.rate, // Default mrp to rate if not present on QI, though we don't have it on QI natively
      totalAmount: qi.totalAmount,
      notes: qi.notes
    }));

    if (salesOrderItemsData.length > 0) {
      await prisma.salesOrderItem.createMany({
        data: salesOrderItemsData
      });
      backfilledCount++;
    }
  }

  console.log(`Backfill complete. Backfilled ${backfilledCount} Sales Orders.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
