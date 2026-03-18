const User = require('../models/user');
const { sequelize } = require('../config/database');

const seedUsers = async () => {
  try {
    // Sync models first if needed (caution: this is a seeder, usually we don't force sync here)
    // await sequelize.sync(); 

    const testUsers = [
      {
        name: 'Super Admin User',
        email: 'superadmin@realestate.com',
        password: 'password123',
        role: 'Super Admin',
        active: true
      },
      {
        name: 'Admin Manager',
        email: 'admin@realestate.com',
        password: 'password123',
        role: 'Admin',
        active: true
      },
      {
        name: 'Senior Broker',
        email: 'broker@realestate.com',
        password: 'password123',
        role: 'Broker',
        active: true
      },
      {
        name: 'Sales Agent',
        email: 'agent@realestate.com',
        password: 'password123',
        role: 'Agent',
        active: true
      },
      {
        name: 'Office Manager',
        email: 'office@realestate.com',
        password: 'password123',
        role: 'Office Manager',
        active: true
      },
      {
        name: 'Accountant User',
        email: 'finance@realestate.com',
        password: 'password123',
        role: 'Accountant',
        active: true
      },
      {
        name: 'Marketing Lead',
        email: 'marketing@realestate.com',
        password: 'password123',
        role: 'Marketing',
        active: true
      },
      {
        name: 'Test Client',
        email: 'client@realestate.com',
        password: 'password123',
        role: 'Client',
        active: true
      },
      {
        name: 'Blocked User',
        email: 'blocked@realestate.com',
        password: 'password123',
        role: 'Agent',
        active: false
      }
    ];

    console.log('Starting user seeding...');

    for (const u of testUsers) {
      const [user, created] = await User.findOrCreate({
        where: { email: u.email },
        defaults: u
      });
      if (created) {
        console.log(`✅ Created: ${u.name} (${u.role})`);
      } else {
        console.log(`ℹ️ User already exists: ${u.email}`);
      }
    }

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedUsers();
