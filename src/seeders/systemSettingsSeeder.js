const { SystemSetting } = require('../models/associations');

const DEFAULT_SETTINGS = [
  {
    key: 'commission_split',
    value: { company: 40, team: 60 },
    type: 'commission',
    description: 'Default commission split between company and team',
    isEditable: true
  },
  {
    key: 'default_role_splits',
    value: {
      team_leader: 40,
      senior_agent: 30,
      agent: 20,
      trainee: 10
    },
    type: 'commission',
    description: 'Default commission split percentages by role within a team',
    isEditable: true
  },
  {
    key: 'property_assignment',
    value: {
      allow_assignment_to_both: false,
      priority: 'group'
    },
    type: 'general',
    description: 'Property assignment settings',
    isEditable: true
  }
];

async function seedSystemSettings() {
  try {
    console.log('Seeding system settings...');

    for (const setting of DEFAULT_SETTINGS) {
      await SystemSetting.findOrCreate({
        where: { sKey: setting.key },
        defaults: { sKey: setting.key, value: setting.value, type: setting.type, description: setting.description, isEditable: setting.isEditable }
      });
    }

    console.log('System settings seeded successfully');
  } catch (error) {
    console.error('Error seeding system settings:', error);
  }
}

module.exports = seedSystemSettings;
