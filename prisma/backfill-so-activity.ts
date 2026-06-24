import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting backfill of Sales Order activities...');
  
  const salesOrders = await prisma.salesOrder.findMany();
  let createdCount = 0;

  for (const so of salesOrders) {
    // Check if an activity already exists
    const existing = await prisma.salesOrderActivity.findFirst({
      where: { salesOrderId: so.id }
    });

    if (!existing) {
      await prisma.salesOrderActivity.create({
        data: {
          salesOrderId: so.id,
          action: "Sales Order created",
          changedBy: so.userId || null,
          changedAt: so.createdAt,
          details: { note: "Backfilled initial creation" }
        }
      });
      createdCount++;
    }
  }

  console.log(`Successfully backfilled ${createdCount} Sales Orders.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
