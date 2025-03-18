// prisma/seed-production.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  try {
    const testUserId = 'admin101';

    console.log('Checking if user exists...');

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { userId: testUserId },
    });

    if (existingUser) {
      console.log(`User already exists.`);
      // Don't just return here, continue to the finally block
    } else {
      // Create user if they don't exist
      console.log('Creating new admin user...');

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
  } catch (error) {
    console.error('Error in seed script:', error);
    // Don't exit here, let the finally block handle disconnection first
  }
}

// Make the main function handle its own try/catch
main()
  .then(() => {
    console.log('Seed script completed successfully');
  })
  .catch((e) => {
    console.error('Seed script failed:', e);
  })
  .finally(async () => {
    console.log('Disconnecting from database...');
    // Use try/catch here to ensure clean disconnection
    try {
      await prisma.$disconnect();
      console.log('Database disconnected');
      // Force exit after disconnection to avoid any hanging processes
      process.exit(0);
    } catch (error) {
      console.error('Error disconnecting from database:', error);
      process.exit(1);
    }
  });
