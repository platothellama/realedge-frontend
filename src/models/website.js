const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Website = sequelize.define('Website', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  domain: {
    type: DataTypes.STRING,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  logo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  favicon: {
    type: DataTypes.STRING,
    allowNull: true
  },
  primaryColor: {
    type: DataTypes.STRING,
    defaultValue: '#6366f1'
  },
  secondaryColor: {
    type: DataTypes.STRING,
    defaultValue: '#10b981'
  },
  accentColor: {
    type: DataTypes.STRING,
    defaultValue: '#f59e0b'
  },
  backgroundColor: {
    type: DataTypes.STRING,
    defaultValue: '#ffffff'
  },
  textColor: {
    type: DataTypes.STRING,
    defaultValue: '#1f2937'
  },
  fontFamily: {
    type: DataTypes.STRING,
    defaultValue: 'Urbanist, sans-serif'
  },
  headerCode: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  footerCode: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  seoTitle: {
    type: DataTypes.STRING,
    allowNull: true
  },
  seoDescription: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  seoKeywords: {
    type: DataTypes.STRING,
    allowNull: true
  },
  googleAnalyticsId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  facebookPixelId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  contactEmail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  contactPhone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  contactAddress: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  socialFacebook: {
    type: DataTypes.STRING,
    allowNull: true
  },
  socialInstagram: {
    type: DataTypes.STRING,
    allowNull: true
  },
  socialTwitter: {
    type: DataTypes.STRING,
    allowNull: true
  },
  socialLinkedIn: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('draft', 'published', 'archived'),
    defaultValue: 'draft'
  },
  isPrimary: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  timestamps: true
});

const WebsitePage = sequelize.define('WebsitePage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  websiteId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  seoTitle: {
    type: DataTypes.STRING,
    allowNull: true
  },
  seoDescription: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isHomepage: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isPublished: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  timestamps: true
});

const WebsiteSection = sequelize.define('WebsiteSection', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  pageId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  componentType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  designVariant: {
    type: DataTypes.STRING,
    defaultValue: 'default'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  config: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  content: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  styles: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  dataSource: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  isVisible: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true
});

const ComponentTemplate = sequelize.define('ComponentTemplate', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false
  },
  componentType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  variants: {
    type: DataTypes.JSON,
    defaultValue: ['default']
  },
  defaultConfig: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  defaultContent: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  availableDataSources: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  icon: {
    type: DataTypes.STRING,
    defaultValue: 'widgets'
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true
});

const WebsiteProperty = sequelize.define('WebsiteProperty', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  websiteId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  propertyId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  isFeatured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  displayOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  timestamps: true
});

const LayoutTemplate = sequelize.define('LayoutTemplate', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('homepage', 'listing', 'property', 'contact', 'about', 'blog'),
    allowNull: false
  },
  thumbnail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  config: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  sections: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true
});

module.exports = { Website, WebsitePage, WebsiteSection, ComponentTemplate, WebsiteProperty, LayoutTemplate };
