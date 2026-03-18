const User = require('../models/user');

const seedUsers = async () => {
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
    }
  ];

  console.log('--- Seeding Users ---');
  for (const u of testUsers) {
    const [user, created] = await User.findOrCreate({
      where: { email: u.email },
      defaults: u
    });
    if (created) console.log(`✅ Created: ${u.name}`);
  }
};

module.exports = seedUsers;
