import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const quotation = await prisma.quotation.findFirst({
    where: { quoteNumber: { contains: '20260526-002' } },
    include: {
      salesOrders: {
        include: {
          activities: {
            orderBy: { changedAt: 'asc' }
          },
          splits: true
        }
      }
    }
  });

  console.log("=== QUOTATION INFO ===");
  if (quotation) {
    console.log(`ID: ${quotation.id}`);
    console.log(`Quote Number: ${quotation.quoteNumber}`);
    console.log(`Status: ${quotation.status}`);
    console.log(`Booking Date: ${quotation.bookingDate}`);
    
    if (quotation.salesOrders && quotation.salesOrders.length > 0) {
      for (const so of quotation.salesOrders) {
        console.log(`\n=== SALES ORDER: ${so.soNumber} (ID: ${so.id}) ===`);
        console.log(`Status: ${so.status}`);
        console.log(`Needs Resync: ${so.needsResync}`);
        
        console.log("\n--- ACTIVITIES ---");
        so.activities.forEach((act: any) => {
          console.log(`[${act.changedAt.toISOString()}] ${act.action}: ${act.details}`);
        });

        console.log("\n--- SPLITS ---");
        so.splits.forEach((split: any) => {
          console.log(`Split ${split.splitNumber} (ID: ${split.id}): Status = ${split.status}, BookedAt = ${split.bookedAt}`);
        });
      }
    } else {
      console.log("\nNo Sales Orders linked to this quotation.");
    }
  } else {
    console.log("Quotation not found.");
  }
}
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
