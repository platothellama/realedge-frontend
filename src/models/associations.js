const Property = require('./property');
const PropertyEmbedding = require('./propertyEmbedding');
const BuyerPreference = require('./buyerPreference');
const PriceHistory = require('./priceHistory');
const User = require('./user');
const Lead = require('./lead');
const LoginLog = require('./loginLog');
const Group = require('./group');
const Deal = require('./deal');
const Visit = require('./visit');
const Document = require('./document');
const DocumentVersion = require('./documentVersion');
const Notification = require('./notification');
const Transaction = require('./transaction');
const Commission = require('./commission');
const Task = require('./task');
const Announcement = require('./announcement');
const Invoice = require('./invoice');
const Expense = require('./expense');
const MarketAnalysis = require('./marketAnalysis');
const Campaign = require('./campaign');
const CallLog = require('./callLog');
const TransactionWorkflow = require('./transactionWorkflow');
const AuditLog = require('./auditLog');
const Team = require('./team');
const EmailTracking = require('./emailTracking');
const { WebsiteVisitor, WebsiteVisit } = require('./websiteVisitor');
const { Website, WebsitePage, WebsiteSection, ComponentTemplate, WebsiteProperty, LayoutTemplate } = require('./website');

// Property - PropertyEmbedding Relation
Property.hasOne(PropertyEmbedding, { foreignKey: 'propertyId', as: 'embedding' });
PropertyEmbedding.belongsTo(Property, { foreignKey: 'propertyId' });

// BuyerPreference - User Relation
BuyerPreference.belongsTo(User, { foreignKey: 'agentId', as: 'agent' });
User.hasMany(BuyerPreference, { foreignKey: 'agentId', as: 'buyerPreferences' });

// BuyerPreference - Lead Relation
BuyerPreference.belongsTo(Lead, { foreignKey: 'clientId', as: 'lead' });
Lead.hasMany(BuyerPreference, { foreignKey: 'clientId', as: 'preferences' });

// Property - PriceHistory Relation
Property.hasMany(PriceHistory, { foreignKey: 'propertyId', as: 'priceHistoryEntries' });
PriceHistory.belongsTo(Property, { foreignKey: 'propertyId' });

// PriceHistory - Lead Relation
PriceHistory.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
Lead.hasMany(PriceHistory, { foreignKey: 'leadId', as: 'negotiations' });

// User - Lead Relation (Assignment)
Lead.belongsTo(User, { foreignKey: 'assignedToUserId', as: 'assignedUser' });
User.hasMany(Lead, { foreignKey: 'assignedToUserId', as: 'leads' });

// User - LoginLog Relation
User.hasMany(LoginLog, { foreignKey: 'userId', as: 'logs' });
LoginLog.belongsTo(User, { foreignKey: 'userId' });

// User - Group Relation (Many-to-Many)
User.belongsToMany(Group, { through: 'UserGroups', as: 'groups' });
Group.belongsToMany(User, { through: 'UserGroups', as: 'members' });

// Property - Assignment Relation
Property.belongsTo(User, { foreignKey: 'assignedToUserId', as: 'assignedUser' });
Property.belongsTo(Group, { foreignKey: 'assignedToGroupId', as: 'assignedGroup' });
User.hasMany(Property, { foreignKey: 'assignedToUserId', as: 'properties' });
Group.hasMany(Property, { foreignKey: 'assignedToGroupId', as: 'properties' });

// Lead - Group Relation
Lead.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });
Group.hasMany(Lead, { foreignKey: 'groupId', as: 'leads' });

// Lead - User Relation (Agent)
Lead.belongsTo(User, { foreignKey: 'agentId', as: 'agent' });
User.hasMany(Lead, { foreignKey: 'agentId', as: 'assignedLeads' });

// Deal - Property Relation
Deal.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
Property.hasMany(Deal, { foreignKey: 'propertyId', as: 'deals' });

// Deal - Lead Relation
Deal.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
Deal.belongsTo(Lead, { foreignKey: 'leadId', as: 'buyerLead' });
Lead.hasMany(Deal, { foreignKey: 'leadId', as: 'deals' });

// Deal - User Relation (Agent)
Deal.belongsTo(User, { foreignKey: 'agentId', as: 'agent' });
Deal.belongsTo(User, { foreignKey: 'agentId', as: 'broker' });
User.hasMany(Deal, { foreignKey: 'agentId', as: 'agentDeals' });

// Visit - Property Relation
Visit.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
Property.hasMany(Visit, { foreignKey: 'propertyId', as: 'visits' });

// Visit - Lead Relation
Visit.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
Lead.hasMany(Visit, { foreignKey: 'leadId', as: 'visits' });

// Visit - User Relation (Broker)
Visit.belongsTo(User, { foreignKey: 'brokerId', as: 'broker' });
User.hasMany(Visit, { foreignKey: 'brokerId', as: 'brokerVisits' });

// Document - Property Relation
Document.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
Property.hasMany(Document, { foreignKey: 'propertyId', as: 'propertyDocuments' });

// Document - User Relation
Document.belongsTo(User, { foreignKey: 'uploadedByUserId', as: 'uploader' });

// Document - Deal Relation
Document.belongsTo(Deal, { foreignKey: 'dealId', as: 'deal' });
Deal.hasMany(Document, { foreignKey: 'dealId', as: 'documents' });

// DocumentVersion - Document Relation
Document.hasMany(DocumentVersion, { foreignKey: 'documentId', as: 'versions' });
DocumentVersion.belongsTo(Document, { foreignKey: 'documentId' });

// DocumentVersion - User Relation
DocumentVersion.belongsTo(User, { foreignKey: 'uploadedByUserId', as: 'uploader' });

// Notification - User Relation
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });

// Transaction - User Relation
Transaction.belongsTo(User, { foreignKey: 'createdByUserId', as: 'creator' });
User.hasMany(Transaction, { foreignKey: 'createdByUserId', as: 'transactions' });

// Commission - User Relation (Agent)
Commission.belongsTo(User, { foreignKey: 'agentId', as: 'agent' });
User.hasMany(Commission, { foreignKey: 'agentId', as: 'commissions' });

// Commission - Deal Relation
Commission.belongsTo(Deal, { foreignKey: 'dealId', as: 'deal' });
Deal.hasMany(Commission, { foreignKey: 'dealId', as: 'commissions' });

// Task - User Relation
Task.belongsTo(User, { foreignKey: 'assignedToUserId', as: 'assignedUser' });
Task.belongsTo(User, { foreignKey: 'assignedToUserId', as: 'assignedTo' });
User.hasMany(Task, { foreignKey: 'assignedToUserId', as: 'tasks' });

// Task - Lead Relation
Task.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
Lead.hasMany(Task, { foreignKey: 'leadId', as: 'tasks' });

// Announcement Relations
Announcement.belongsTo(User, { foreignKey: 'createdByUserId', as: 'creator' });
User.hasMany(Announcement, { foreignKey: 'createdByUserId', as: 'announcements' });

// Invoice Relations
Invoice.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
Lead.hasMany(Invoice, { foreignKey: 'leadId', as: 'invoices' });
Invoice.belongsTo(User, { foreignKey: 'createdByUserId', as: 'creator' });

// Expense Relations
Expense.belongsTo(User, { foreignKey: 'createdByUserId', as: 'creator' });
User.hasMany(Expense, { foreignKey: 'createdByUserId', as: 'expenses' });

// Campaign Relations
Campaign.belongsTo(User, { foreignKey: 'createdByUserId', as: 'creator' });
User.hasMany(Campaign, { foreignKey: 'createdByUserId', as: 'campaigns' });

// CallLog Relations
CallLog.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
CallLog.belongsTo(User, { foreignKey: 'agentId', as: 'agent' });

// Website Builder Relations
Website.hasMany(WebsitePage, { foreignKey: 'websiteId', as: 'pages' });
WebsitePage.belongsTo(Website, { foreignKey: 'websiteId' });

WebsitePage.hasMany(WebsiteSection, { foreignKey: 'pageId', as: 'sections' });
WebsiteSection.belongsTo(WebsitePage, { foreignKey: 'pageId' });

// Website - Property Relations
Website.hasMany(WebsiteProperty, { foreignKey: 'websiteId', as: 'websiteProperties' });
WebsiteProperty.belongsTo(Website, { foreignKey: 'websiteId' });
WebsiteProperty.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
Property.hasMany(WebsiteProperty, { foreignKey: 'propertyId', as: 'websiteListings' });

module.exports = {
  Property,
  PropertyEmbedding,
  BuyerPreference,
  PriceHistory,
  User,
  Lead,
  LoginLog,
  Group,
  Deal,
  Visit,
  Document,
  DocumentVersion,
  Notification,
  Transaction,
  Commission,
  Task,
  Announcement,
  Invoice,
  Expense,
  MarketAnalysis,
  Campaign,
  CallLog,
  TransactionWorkflow,
  AuditLog,
  Team,
  EmailTracking,
  WebsiteVisitor,
  WebsiteVisit,
  Website,
  WebsitePage,
  WebsiteSection,
  ComponentTemplate,
  WebsiteProperty,
  LayoutTemplate
};
