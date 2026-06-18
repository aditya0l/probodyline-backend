const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const quotes = await prisma.quotation.findMany({
    include: {
      customer: true,
      clients: true
    }
  });

  for (const q of quotes) {
    if (!q.gymName || !q.clientName) {
      let gym = q.gymName;
      let client = q.clientName;
      
      if (q.clients && q.clients.length > 0) {
        gym = gym || q.clients[0].gymName;
        client = client || q.clients[0].name;
      } else if (q.customer) {
        gym = gym || q.customer.gymName;
        client = client || q.customer.name;
      }

      if (gym || client) {
        await prisma.quotation.update({
          where: { id: q.id },
          data: {
            gymName: gym || null,
            clientName: client || null,
          }
        });
        console.log(`Updated Quote: ${q.quoteNumber} with Gym: ${gym}, Client: ${client}`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
