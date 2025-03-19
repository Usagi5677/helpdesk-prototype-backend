// prisma/seed-production.ts
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  try {
    const testUserId = 'admin101';
    let userId;
    let siteId;

    // Check if site already exists
    const siteCode = 'ICT';
    console.log('Checking if site exists...');

    const existingSite = await prisma.site.findUnique({
      where: { code: siteCode },
    });

    if (existingSite) {
      console.log(`Site already exists.`);
    } else {
      // Create site if it doesn't exist
      console.log('Creating new site...');
      const site = await prisma.site.create({
        data: {
          name: 'ICT Division',
          code: siteCode,
          mode: 'Public',
          isEnabled: true,
        },
      });
      siteId = site.id;
      console.log(`Created a new site`);
    }

    console.log('Checking if user exists...');

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { userId: testUserId },
    });

    if (existingUser) {
      console.log(`User already exists.`);
      userId = existingUser.id; // Store the user's ID for role assignment
    } else {
      // Create user if they don't exist
      console.log('Creating new admin user...');

      const hashedPassword = await bcrypt.hash('test', 10);

      const newUser = await prisma.user.create({
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
      userId = newUser.id; // Store the user's ID for role assignment
    }

    // Check if categories exist
    console.log('Checking for categories...');
    const categoryCount = await prisma.category.count({
      where: { siteId: 1 },
    });

    if (categoryCount > 0) {
      console.log(`Categories already exist (${categoryCount} found).`);
    } else {
      console.log('Creating categories...');

      // Create categories
      const categories = [
        'Keyboard',
        'ERP',
        'Software',
        'Software Installation',
        'Maintenance',
        'Printer',
        'Internet',
        'Computer Hardware',
      ];

      for (const categoryName of categories) {
        await prisma.category.create({
          data: {
            name: categoryName,
            active: true,
            siteId: siteId, // ICT site
          },
        });
        console.log(`Created category: ${categoryName}`);
      }

      console.log('All categories created successfully');
    }

    // Check and create user roles
    console.log('Checking user roles...');

    // Define the roles to assign
    const rolesToAssign = [Role.User, Role.Agent];

    for (const roleName of rolesToAssign) {
      // Check if the role already exists for this user
      const existingRole = await prisma.userRole.findFirst({
        where: {
          userId: userId,
          role: roleName,
        },
      });

      if (existingRole) {
        console.log(`Role '${roleName}' already assigned to user.`);
      } else {
        // Create the role assignment
        await prisma.userRole.create({
          data: {
            userId: userId,
            role: roleName,
            siteId: siteId, // ICT site
          },
        });
        console.log(`Assigned role '${roleName}' to user.`);
      }
    }

    console.log('User roles setup completed.');
  } catch (error) {
    console.error('Error in seed script:', error);
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
    try {
      await prisma.$disconnect();
      console.log('Database disconnected');
      process.exit(0);
    } catch (error) {
      console.error('Error disconnecting from database:', error);
      process.exit(1);
    }
  });
