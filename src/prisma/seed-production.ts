// prisma/seed-production.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const testUserId = 'admin101';

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { userId: testUserId },
  });

  if (existingUser) {
    console.log(`User already exists.`);
    return;
  }

  // Create user if they don't exist
  const hashedPassword = await bcrypt.hash('test', 10);

  await prisma.user.create({
    data: {
      userId: 'admin101',
      email: 'test@gmail.com',
      password: hashedPassword,
      fullName: 'Admin User',
      rcno: 1111,
      isSuperAdmin: true,
    },
  });

  console.log(`Created a new admin`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
