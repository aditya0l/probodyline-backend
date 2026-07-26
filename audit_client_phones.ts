import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Duplicate Check ---');
  const duplicates = await prisma.client.groupBy({
    by: ['phone'],
    having: {
      phone: {
        _count: {
          gt: 1
        }
      }
    },
    _count: {
      phone: true
    }
  });

  console.log(`Total duplicate groups: ${duplicates.length}`);
  for (const dup of duplicates) {
    if (dup.phone) {
      console.log(`Phone: ${dup.phone} (Count: ${dup._count.phone})`);
      const rows = await prisma.client.findMany({ where: { phone: dup.phone }, select: { id: true, clientCode: true, clientName: true, phone: true } });
      console.log(rows);
    }
  }

  console.log('\n--- Placeholder Check ---');
  const placeholders = await prisma.client.findMany({
    where: {
      OR: [
        { phone: null },
        { phone: '' },
        { phone: '0000000000' },
        { phone: '1111111111' },
      ]
    },
    select: { id: true, clientCode: true, clientName: true, phone: true }
  });
  console.log(`Total placeholder/null rows: ${placeholders.length}`);
  console.log(placeholders.slice(0, 5)); // print first 5

  console.log('\n--- Format Check (Regex) ---');
  const allPhones = await prisma.client.findMany({
    select: { id: true, clientCode: true, clientName: true, phone: true }
  });
  
  let invalidCount = 0;
  const invalidSamples: any[] = [];
  for (const row of allPhones) {
    if (!row.phone) continue;
    if (row.phone === '0000000000' || row.phone === '1111111111') continue; 
    const cleaned = row.phone.replace(/[\s\-\+]/g, '');
    if (!/^\d+$/.test(cleaned) || cleaned.length < 10 || cleaned.length > 12) {
      invalidCount++;
      if (invalidSamples.length < 5) invalidSamples.push(row);
    }
  }
  console.log(`Total invalid format rows: ${invalidCount}`);
  console.log(invalidSamples);
}

main().catch(e => console.error(e)).finally(async () => await prisma.$disconnect());
