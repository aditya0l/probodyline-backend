const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const search = 'cardio';
  const rawIds = await prisma.$queryRaw`
    SELECT id FROM "products"
    WHERE "deletedAt" IS NULL
    AND (
      "name" ILIKE ${'%' + search + '%'} OR
      "modelNumber" ILIKE ${'%' + search + '%'} OR
      "seriesName" ILIKE ${'%' + search + '%'} OR
      array_to_string("keyword", ' ') ILIKE ${'%' + search + '%'}
    )
    LIMIT 5
  `;
  console.log(rawIds);
}

main().catch(console.error).finally(() => prisma.$disconnect());
