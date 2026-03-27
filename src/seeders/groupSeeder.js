const { Group, User } = require('../models/associations');

const seedGroups = async () => {
  try {
    console.log('--- Seeding Groups ---');
    
    // Clear groups (caution: this might affect properties if cascading isn't handled, but alter:true should be fine)
    await Group.destroy({ where: {} });

    const groups = [
      {
        name: 'Luxury Sales Group',
        description: 'Specialized in high-end penthouses and coastal villas.'
      },
      {
        name: 'Commercial Division',
        description: 'Handling office spaces, retail, and industrial properties.'
      },
      {
        name: 'Support & Admin',
        description: 'Direct support for listing managers and brokers.'
      }
    ];

    const users = await User.findAll();
    const admin = users.find(u => u.role === 'Super Admin' || u.role === 'Admin');
    const agent = users.find(u => u.role === 'Agent');
    const broker = users.find(u => u.role === 'Broker');

    for (const g of groups) {
      const group = await Group.create(g);
      
      // Assign some users to groups
      if (g.name === 'Luxury Sales Group') {
        if (broker) await group.addMember(broker);
        if (agent) await group.addMember(agent);
      } else if (g.name === 'Commercial Division') {
        if (admin) await group.addMember(admin);
      }
    }

    console.log('✅ Groups seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding groups:', error);
  }
};

module.exports = seedGroups;
