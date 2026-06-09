const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const gyms = await prisma.gym.findMany({
    where: {
      OR: [
        { gymCode: { contains: 'ZERERZDF' } },
        { gymCode: { contains: 'DSFSDFSFSD' } }
      ]
    }
  });
  console.log('Gyms to delete:', gyms.map(g => g.id + ' - ' + g.gymCode));

  for (const gym of gyms) {
    await prisma.gym.delete({ where: { id: gym.id } });
    console.log('Deleted gym', gym.id);
  }
  
  const managers = await prisma.manager.findMany({
    where: {
      fullName: { in: ['Sylvain PATT', 'Lisa Tetault', 'Ilane DJAHA'] }
    }
  });
  console.log('Managers to delete:', managers.map(m => m.id + ' - ' + m.fullName));

  for (const manager of managers) {
    await prisma.manager.delete({ where: { id: manager.id } });
    console.log('Deleted manager', manager.id);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
