require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, email: true, isActive: true, name: true, role: true }
  })
  console.log(users)
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
