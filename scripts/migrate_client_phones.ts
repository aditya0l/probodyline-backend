import { PrismaClient } from '@prisma/client';
import { normalizePhone } from '../src/common/utils/phone.util';

const prisma = new PrismaClient();

async function main() {
  const clientsWithPhones = await prisma.$queryRaw<any[]>`
    SELECT id, phone, "isPhoneVerified" FROM clients 
    WHERE phone IS NOT NULL AND phone != '' AND phone != '0000000000';
  `;

  console.log(`Found ${clientsWithPhones.length} valid client phones to migrate.`);

  if (clientsWithPhones.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const client of clientsWithPhones) {
        const normalized = normalizePhone(client.phone);
        
        await tx.clientPhone.create({
          data: {
            phone: normalized,
            clientId: client.id,
            isPrimary: true,
            isDormant: false,
            isPhoneVerified: client.isPhoneVerified,
          }
        });
      }
    });

    const migratedIds = clientsWithPhones.map(c => c.id);
    const migratedCount = await prisma.clientPhone.count({
      where: { clientId: { in: migratedIds } }
    });
    
    if (migratedCount !== clientsWithPhones.length) {
      throw new Error(`Data verification failed! Expected ${clientsWithPhones.length} rows, found ${migratedCount}. Migration halted.`);
    }
  }

  console.log('✅ Data migration verified successfully. Proceed with Migration B.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
