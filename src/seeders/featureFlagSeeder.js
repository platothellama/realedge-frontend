const FeatureFlag = require('../models/featureFlag');

const defaultFeatures = [
  { key: 'ai_assistant', description: 'AI-powered assistant for leads and properties', enabled: false, enabledForRoles: ['Super Admin', 'Admin', 'Broker', 'Agent'] },
  { key: 'website_builder', description: 'Website builder functionality', enabled: true, enabledForRoles: ['Super Admin', 'Admin'] },
  { key: 'marketing_automation', description: 'Marketing automation features', enabled: false, enabledForRoles: ['Super Admin', 'Admin', 'Marketing'] },
  { key: 'commission_tracking', description: 'Commission tracking and calculations', enabled: true, enabledForRoles: [] },
  { key: 'transaction_workflows', description: 'Transaction workflow automation', enabled: false, enabledForRoles: ['Super Admin', 'Admin', 'Broker'] }
];

async function seedFeatureFlags() {
  try {
    for (const feature of defaultFeatures) {
      const existing = await FeatureFlag.findOne({ where: { key: feature.key } });
      if (!existing) {
        await FeatureFlag.create(feature);
        console.log(`✅ Seeded feature flag: ${feature.key}`);
      }
    }
    console.log('✅ Feature flags seeded successfully');
  } catch (err) {
    console.error('❌ Error seeding feature flags:', err.message);
  }
}

module.exports = seedFeatureFlags;