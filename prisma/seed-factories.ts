import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COLORS = [
  'bg-pink-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-teal-500',
  'bg-amber-400',
  'bg-blue-500',
  'bg-violet-500',
  'bg-rose-500',
];

async function main() {
  console.log('Starting factory migration...');

  // 1. Get all POs
  const pos = await prisma.purchaseOrder.findMany({
    include: {
      splits: {
        include: {
          items: true
        }
      }
    }
  });

  console.log(`Found ${pos.length} Purchase Orders`);

  // Group by supplierName
  const posBySupplier = pos.reduce((acc, po) => {
    if (!acc[po.supplierName]) acc[po.supplierName] = [];
    acc[po.supplierName].push(po);
    return acc;
  }, {} as Record<string, typeof pos>);

  for (const [supplierName, supplierPos] of Object.entries(posBySupplier)) {
    if (!supplierName) continue;

    // Find latest createdAt for lastActiveAt
    const latestPo = supplierPos.reduce((latest, po) => 
      new Date(po.createdAt) > new Date(latest.createdAt) ? po : latest
    , supplierPos[0]);

    // Upsert Factory
    const factory = await prisma.factory.upsert({
      where: { name: supplierName },
      update: {
        lastActiveAt: latestPo.createdAt
      },
      create: {
        name: supplierName,
        lastActiveAt: latestPo.createdAt
      }
    });

    console.log(`Upserted Factory: ${factory.name}`);

    // Update POs with factoryId
    for (const po of supplierPos) {
      await prisma.purchaseOrder.update({
        where: { id: po.id },
        data: { factoryId: factory.id }
      });

      // Migrate splits for this PO
      for (const poSplit of po.splits) {
        if (!poSplit.label) continue;

        // Clean label
        let cleanLabel = poSplit.label.replace(/^JAIPUR DATE\s+/i, '').trim();
        if (!cleanLabel) cleanLabel = 'UNLABELED';

        // Check existing factory splits to assign color deterministically
        const existingSplitsCount = await prisma.factorySplit.count({ where: { factoryId: factory.id } });
        const color = COLORS[existingSplitsCount % COLORS.length];

        // Upsert FactorySplit
        const factorySplit = await prisma.factorySplit.upsert({
          where: {
            factoryId_dateRangeLabel: {
              factoryId: factory.id,
              dateRangeLabel: cleanLabel
            }
          },
          update: {},
          create: {
            factoryId: factory.id,
            dateRangeLabel: cleanLabel,
            color: color
          }
        });

        // Update split items to point to factorySplitId
        if (poSplit.items && poSplit.items.length > 0) {
          for (const item of poSplit.items) {
            await prisma.purchaseOrderSplitItem.update({
              where: { id: item.id },
              data: { factorySplitId: factorySplit.id }
            });
          }
        }
      }
    }
  }

  console.log('Migration complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
