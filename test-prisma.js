const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const quoteId = "b0a9a019-050e-4a64-b16c-1a44a0aa95b1";
  
  // Find quote
  const quote = await prisma.quotation.findUnique({ where: { id: quoteId }, include: { clients: true } });
  console.log("Quote clients:", quote.clients);
  
  if (quote.clients.length > 0) {
     const cId = quote.clients[0].id;
     console.log("Testing update for customer ID:", cId);
     try {
       await prisma.customer.update({
         where: { id: cId },
         data: { name: quote.clients[0].name + " test" }
       });
       console.log("Update success");
     } catch (err) {
       console.error("Update failed:", err.message);
     }
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
