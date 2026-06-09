const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const gyms = await prisma.gym.findMany({
    where: {
      gymCode: { contains: 'DSFSDF' }
    }
  });
  console.log('Gyms to delete:', gyms.map(g => g.id + ' - ' + g.gymCode));

  for (const gym of gyms) {
    await prisma.gym.delete({ where: { id: gym.id } });
    console.log('Deleted gym', gym.id);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
