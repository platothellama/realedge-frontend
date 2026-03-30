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
const DocumentSignature = require('./documentSignature');
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
const EmailTracking = require('./emailTracking');
const Payment = require('./payment');
const PaymentPlan = require('./paymentPlan');
const Seller = require('./seller');
const UserGroup = require('./userGroup');
const Role = require('./role');
const Permission = require('./permission');
const RolePermission = require('./rolePermission');
const DealCommission = require('./dealCommission');
const SystemSetting = require('./systemSetting');
const { WebsiteVisitor, WebsiteVisit } = require('./websiteVisitor');
const { Website, WebsitePage, WebsiteSection, ComponentTemplate, WebsiteProperty, LayoutTemplate } = require('./website');
const ListingMethod = require('./listingMethod');
const ListingMethodHistory = require('./listingMethodHistory');

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

// User - Group Relation (Many-to-Many) - Updated to use UserGroup model
User.belongsToMany(Group, { through: UserGroup, as: 'groups', foreignKey: 'userId', otherKey: 'groupId' });
Group.belongsToMany(User, { through: UserGroup, as: 'members', foreignKey: 'groupId', otherKey: 'userId' });

// Property - Assignment Relation
Property.belongsTo(User, { foreignKey: 'assignedToUserId', as: 'assignedUser' });
Property.belongsTo(Group, { foreignKey: 'assignedToGroupId', as: 'assignedGroup' });
User.hasMany(Property, { foreignKey: 'assignedToUserId', as: 'properties' });
Group.hasMany(Property, { foreignKey: 'assignedToGroupId', as: 'properties' });

// Property - Seller Relation
Property.belongsTo(Seller, { foreignKey: 'sellerId', as: 'seller' });
Seller.hasMany(Property, { foreignKey: 'sellerId', as: 'properties' });

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
Lead.hasMany(Deal, { foreignKey: 'leadId', as: 'deals' });

// Deal - Lead Relation (Buyer Lead)
Deal.belongsTo(Lead, { foreignKey: 'buyerLeadId', as: 'buyerLead' });
Lead.hasMany(Deal, { foreignKey: 'buyerLeadId', as: 'buyerDeals' });

// Deal - User Relation (Agent)
Deal.belongsTo(User, { foreignKey: 'agentId', as: 'agent' });
User.hasMany(Deal, { foreignKey: 'agentId', as: 'agentDeals' });

// Deal - User Relation (Broker)
Deal.belongsTo(User, { foreignKey: 'brokerId', as: 'broker' });
User.hasMany(Deal, { foreignKey: 'brokerId', as: 'brokerDeals' });

// Deal - Seller Relation
Deal.belongsTo(Seller, { foreignKey: 'sellerId', as: 'dealSeller' });
Seller.hasMany(Deal, { foreignKey: 'sellerId', as: 'sellerDeals' });

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
Document.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Document, { foreignKey: 'userId', as: 'userDocuments' });

// Document - Deal Relation
Document.belongsTo(Deal, { foreignKey: 'dealId', as: 'deal' });
Deal.hasMany(Document, { foreignKey: 'dealId', as: 'documents' });

// DocumentVersion - Document Relation
Document.hasMany(DocumentVersion, { foreignKey: 'documentId', as: 'versions' });
DocumentVersion.belongsTo(Document, { foreignKey: 'documentId' });

// DocumentVersion - User Relation
DocumentVersion.belongsTo(User, { foreignKey: 'uploadedByUserId', as: 'uploader' });

// Document - DocumentSignature Relation
Document.hasMany(DocumentSignature, { foreignKey: 'documentId', as: 'signatures' });
DocumentSignature.belongsTo(Document, { foreignKey: 'documentId' });

// DocumentSignature - User Relation
DocumentSignature.belongsTo(User, { foreignKey: 'signedByUserId', as: 'signer' });

// Notification - User Relation
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });

// Transaction - User Relation
Transaction.belongsTo(User, { foreignKey: 'userId', as: 'creator' });
User.hasMany(Transaction, { foreignKey: 'userId', as: 'transactions' });

// Transaction - Property Relation
Transaction.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
Property.hasMany(Transaction, { foreignKey: 'propertyId', as: 'transactions' });

// Transaction - Deal Relation
Transaction.belongsTo(Deal, { foreignKey: 'dealId', as: 'deal' });
Deal.hasMany(Transaction, { foreignKey: 'dealId', as: 'transactions' });

// Commission - User Relation (Agent)
Commission.belongsTo(User, { foreignKey: 'agentId', as: 'agent' });
User.hasMany(Commission, { foreignKey: 'agentId', as: 'commissions' });

// Commission - User Relation (Agent 2 - Co-listing)
Commission.belongsTo(User, { foreignKey: 'agent2Id', as: 'agent2' });

// Commission - Deal Relation
Commission.belongsTo(Deal, { foreignKey: 'dealId', as: 'deal' });
Deal.hasMany(Commission, { foreignKey: 'dealId', as: 'commissions' });

// Commission - Property Relation
Commission.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
Property.hasMany(Commission, { foreignKey: 'propertyId', as: 'commissions' });

// Task - User Relation (assigned to)
Task.belongsTo(User, { foreignKey: 'assignedToUserId', as: 'assignedTo' });
User.hasMany(Task, { foreignKey: 'assignedToUserId', as: 'tasks' });

// Task - User Relation (assigned by)
Task.belongsTo(User, { foreignKey: 'assignedByUserId', as: 'assignedBy' });

// Task - Lead Relation
Task.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
Lead.hasMany(Task, { foreignKey: 'leadId', as: 'tasks' });

// Announcement Relations
Announcement.belongsTo(User, { foreignKey: 'createdByUserId', as: 'creator' });
Announcement.belongsTo(User, { foreignKey: 'createdByUserId', as: 'author' });
User.hasMany(Announcement, { foreignKey: 'createdByUserId', as: 'announcements' });

// Invoice Relations
Invoice.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
Lead.hasMany(Invoice, { foreignKey: 'leadId', as: 'invoices' });
Invoice.belongsTo(User, { foreignKey: 'createdByUserId', as: 'creator' });
Invoice.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
Property.hasMany(Invoice, { foreignKey: 'propertyId', as: 'invoices' });
Invoice.belongsTo(Deal, { foreignKey: 'dealId', as: 'deal' });
Deal.hasMany(Invoice, { foreignKey: 'dealId', as: 'invoices' });

// Expense Relations
Expense.belongsTo(User, { foreignKey: 'createdByUserId', as: 'creator' });
User.hasMany(Expense, { foreignKey: 'createdByUserId', as: 'expenses' });
Expense.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
Property.hasMany(Expense, { foreignKey: 'propertyId', as: 'expenses' });

// Campaign Relations
Campaign.belongsTo(User, { foreignKey: 'createdByUserId', as: 'creator' });
User.hasMany(Campaign, { foreignKey: 'createdByUserId', as: 'campaigns' });

// CallLog Relations
CallLog.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
Lead.hasMany(CallLog, { foreignKey: 'leadId', as: 'callLogs' });
CallLog.belongsTo(User, { foreignKey: 'agentId', as: 'agent' });
User.hasMany(CallLog, { foreignKey: 'agentId', as: 'callLogs' });
CallLog.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
Property.hasMany(CallLog, { foreignKey: 'propertyId', as: 'callLogs' });

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

// Payment - Deal Relations
Payment.belongsTo(Deal, { foreignKey: 'dealId', as: 'deal' });
Deal.hasMany(Payment, { foreignKey: 'dealId', as: 'payments' });
Payment.belongsTo(User, { foreignKey: 'recordedByUserId', as: 'recorder' });

// PaymentPlan - Deal Relations
PaymentPlan.belongsTo(Deal, { foreignKey: 'dealId', as: 'deal' });
Deal.hasMany(PaymentPlan, { foreignKey: 'dealId', as: 'paymentPlans' });
PaymentPlan.belongsTo(User, { foreignKey: 'createdByUserId', as: 'creator' });

// TransactionWorkflow Relations
TransactionWorkflow.belongsTo(Deal, { foreignKey: 'dealId', as: 'deal' });
Deal.hasMany(TransactionWorkflow, { foreignKey: 'dealId', as: 'workflows' });
TransactionWorkflow.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
TransactionWorkflow.belongsTo(User, { foreignKey: 'clientId', as: 'client' });
TransactionWorkflow.belongsTo(User, { foreignKey: 'inspectorId', as: 'inspector' });
TransactionWorkflow.belongsTo(User, { foreignKey: 'appraiserId', as: 'appraiser' });
TransactionWorkflow.belongsTo(User, { foreignKey: 'lenderId', as: 'lender' });

// EmailTracking Relations
EmailTracking.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
Lead.hasMany(EmailTracking, { foreignKey: 'leadId', as: 'emails' });
EmailTracking.belongsTo(User, { foreignKey: 'agentId', as: 'agent' });
User.hasMany(EmailTracking, { foreignKey: 'agentId', as: 'emailTrackings' });
EmailTracking.belongsTo(Campaign, { foreignKey: 'campaignId', as: 'campaign' });
Campaign.hasMany(EmailTracking, { foreignKey: 'campaignId', as: 'emails' });

// AuditLog Relations
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });

// Payment - Invoice Relations
Payment.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'invoice' });
Invoice.hasMany(Payment, { foreignKey: 'invoiceId', as: 'payments' });
User.hasMany(Payment, { foreignKey: 'recordedByUserId', as: 'recordedPayments' });

// Deal - Group Relation
Deal.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });
Group.hasMany(Deal, { foreignKey: 'groupId', as: 'deals' });

// ListingMethod - ListingMethodHistory Relations
ListingMethod.hasMany(ListingMethodHistory, { foreignKey: 'listingMethodId', as: 'history' });
ListingMethodHistory.belongsTo(ListingMethod, { foreignKey: 'listingMethodId', as: 'listingMethod' });
ListingMethodHistory.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
Property.hasMany(ListingMethodHistory, { foreignKey: 'propertyId', as: 'listingHistory' });

// ==========================================
// NEW: UserGroup - User/Group Relations
// ==========================================
UserGroup.belongsTo(User, { foreignKey: 'userId', as: 'user' });
UserGroup.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });
User.hasMany(UserGroup, { foreignKey: 'userId' });
Group.hasMany(UserGroup, { foreignKey: 'groupId' });

// ==========================================
// NEW: Role & Permission System
// ==========================================
Role.belongsToMany(Permission, { through: RolePermission, as: 'permissions', foreignKey: 'roleId', otherKey: 'permissionId' });
Permission.belongsToMany(Role, { through: RolePermission, as: 'roles', foreignKey: 'permissionId', otherKey: 'roleId' });

// ==========================================
// NEW: DealCommission Relations
// ==========================================
DealCommission.belongsTo(Deal, { foreignKey: 'dealId', as: 'deal' });
DealCommission.belongsTo(User, { foreignKey: 'userId', as: 'user' });
DealCommission.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });
Deal.hasMany(DealCommission, { foreignKey: 'dealId', as: 'dealCommissions' });
User.hasMany(DealCommission, { foreignKey: 'userId', as: 'dealCommissions' });
Group.hasMany(DealCommission, { foreignKey: 'groupId', as: 'dealCommissions' });

// ==========================================
// NEW: System Settings Relations
// ==========================================
// SystemSetting doesn't need associations - it's a key-value store

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
  DocumentSignature,
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
  EmailTracking,
  WebsiteVisitor,
  WebsiteVisit,
  Website,
  WebsitePage,
  WebsiteSection,
  ComponentTemplate,
  WebsiteProperty,
  LayoutTemplate,
  Payment,
  PaymentPlan,
  Seller,
  ListingMethod,
  ListingMethodHistory,
  UserGroup,
  Role,
  Permission,
  RolePermission,
  DealCommission,
  SystemSetting
};
