const { Role, Permission, RolePermission } = require('../models/associations');

const DEFAULT_PERMISSIONS = [
  { key: 'view_properties', name: 'View Properties', category: 'properties', description: 'Can view property listings' },
  { key: 'create_property', name: 'Create Property', category: 'properties', description: 'Can create new property listings' },
  { key: 'edit_property', name: 'Edit Property', category: 'properties', description: 'Can edit property details' },
  { key: 'delete_property', name: 'Delete Property', category: 'properties', description: 'Can delete property listings' },
  { key: 'view_leads', name: 'View Leads', category: 'leads', description: 'Can view leads' },
  { key: 'create_lead', name: 'Create Lead', category: 'leads', description: 'Can create new leads' },
  { key: 'edit_lead', name: 'Edit Lead', category: 'leads', description: 'Can edit lead details' },
  { key: 'delete_lead', name: 'Delete Lead', category: 'leads', description: 'Can delete leads' },
  { key: 'view_deals', name: 'View Deals', category: 'deals', description: 'Can view deals' },
  { key: 'create_deal', name: 'Create Deal', category: 'deals', description: 'Can create new deals' },
  { key: 'edit_deal', name: 'Edit Deal', category: 'deals', description: 'Can edit deal details' },
  { key: 'close_deal', name: 'Close Deal', category: 'deals', description: 'Can close deals' },
  { key: 'view_finance', name: 'View Finance', category: 'finance', description: 'Can view financial data' },
  { key: 'manage_commissions', name: 'Manage Commissions', category: 'finance', description: 'Can manage commissions' },
  { key: 'approve_commissions', name: 'Approve Commissions', category: 'finance', description: 'Can approve commission payouts' },
  { key: 'view_agents', name: 'View Agents', category: 'users', description: 'Can view agent profiles' },
  { key: 'manage_agents', name: 'Manage Agents', category: 'users', description: 'Can manage agent accounts' },
  { key: 'manage_groups', name: 'Manage Groups', category: 'users', description: 'Can manage teams/groups' },
  { key: 'manage_settings', name: 'Manage Settings', category: 'settings', description: 'Can manage system settings' },
  { key: 'view_reports', name: 'View Reports', category: 'reports', description: 'Can view reports and analytics' },
  { key: 'manage_users', name: 'Manage Users', category: 'admin', description: 'Can manage all users (Super Admin)' }
];

const ROLE_PERMISSION_MAPPING = {
  'Super Admin': [
    'view_properties', 'create_property', 'edit_property', 'delete_property',
    'view_leads', 'create_lead', 'edit_lead', 'delete_lead',
    'view_deals', 'create_deal', 'edit_deal', 'close_deal',
    'view_finance', 'manage_commissions', 'approve_commissions',
    'view_agents', 'manage_agents', 'manage_groups',
    'manage_settings', 'view_reports', 'manage_users'
  ],
  'Admin': [
    'view_properties', 'create_property', 'edit_property', 'delete_property',
    'view_leads', 'create_lead', 'edit_lead', 'delete_lead',
    'view_deals', 'create_deal', 'edit_deal', 'close_deal',
    'view_finance', 'manage_commissions', 'approve_commissions',
    'view_agents', 'manage_agents', 'manage_groups',
    'view_reports'
  ],
  'Broker': [
    'view_properties', 'create_property', 'edit_property',
    'view_leads', 'create_lead', 'edit_lead',
    'view_deals', 'create_deal', 'edit_deal', 'close_deal',
    'view_finance', 'view_agents'
  ],
  'Agent': [
    'view_properties', 'create_property', 'edit_property',
    'view_leads', 'create_lead', 'edit_lead',
    'view_deals', 'create_deal', 'edit_deal'
  ],
  'Office Manager': [
    'view_properties', 'create_property', 'edit_property',
    'view_leads', 'create_lead', 'edit_lead',
    'view_deals', 'create_deal', 'edit_deal',
    'view_finance', 'view_agents', 'manage_agents',
    'view_reports'
  ],
  'Accountant': [
    'view_finance', 'manage_commissions', 'approve_commissions',
    'view_reports'
  ],
  'Marketing': [
    'view_properties', 'view_leads', 'create_lead',
    'view_deals'
  ],
  'Client': []
};

async function seedPermissions() {
  try {
    console.log('Seeding permissions and roles...');

    for (const perm of DEFAULT_PERMISSIONS) {
      await Permission.findOrCreate({
        where: { permKey: perm.key },
        defaults: { permKey: perm.key, name: perm.name, category: perm.category, description: perm.description }
      });
    }

    const existingRoles = ['Super Admin', 'Admin', 'Broker', 'Agent', 'Office Manager', 'Accountant', 'Marketing', 'Client'];
    
    for (const roleName of existingRoles) {
      const [role] = await Role.findOrCreate({
        where: { name: roleName },
        defaults: {
          name: roleName,
          description: `${roleName} role`
        }
      });

      const permissionKeys = ROLE_PERMISSION_MAPPING[roleName] || [];
      
      for (const permKey of permissionKeys) {
        const permission = await Permission.findOne({ where: { permKey } });
        
        if (permission) {
          await RolePermission.findOrCreate({
            where: { roleId: role.id, permissionId: permission.id }
          });
        }
      }
    }

    console.log('Permissions and roles seeded successfully');
  } catch (error) {
    console.error('Error seeding permissions:', error);
  }
}

module.exports = seedPermissions;
