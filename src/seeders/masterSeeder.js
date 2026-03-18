const seedUsers = require('./userSeeder_module');
const seedGroups = require('./groupSeeder');
const seedProperties = require('./propertySeeder');
const seedDemoData = require('./demoSeeder');
const { connectDB, sequelize } = require('../config/database');
require('../models/associations');

const runMasterSeeder = async () => {
  try {
    console.log('🚀 Starting Master Seeder...');
    await connectDB();
    
    // Check if models are synced
    await sequelize.sync({ alter: true });
    
    // Run seeders
    await seedUsers();
    await seedGroups();
    await seedProperties();
    await seedDemoData();
    
    console.log('✨ Master Seeding Completed Successfully!');
    process.exit(0);
  } catch (error) {
    console.error('💥 Master Seeding Failed:', error);
    process.exit(1);
  }
};

runMasterSeeder();
