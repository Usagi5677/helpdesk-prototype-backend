import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding...');
  const site = await prisma.site.create({
    data: { name: 'ICT Division', code: 'ICT' },
  });
  console.log(`${site.name} site created.`);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
