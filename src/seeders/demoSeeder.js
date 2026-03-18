const { Lead, Deal, Visit, Document, DocumentVersion, Property, User, Group, Notification } = require('../models/associations');
const { v4: uuidv4 } = require('uuid');

const seedDemoData = async () => {
  try {
    console.log('🚀 Seeding Demo Data...\n');

    // Clear existing demo data first
    await DocumentVersion.destroy({ where: {} });
    await Document.destroy({ where: {} });
    await Visit.destroy({ where: {} });
    await Deal.destroy({ where: {} });
    await Lead.destroy({ where: {} });

    // Get existing data
    const users = await User.findAll();
    const properties = await Property.findAll();
    const groups = await Group.findAll();

    const getRandomElement = (arr) => arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null;
    const getRandomElements = (arr, count) => {
      const shuffled = [...arr].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    };

    // ============ SEED LEADS ============
    console.log('--- Seeding Leads ---');
    
    const leads = [
      {
        name: 'John Smith',
        email: 'john.smith@email.com',
        phone: '+971 50 123 4567',
        source: 'Website',
        status: 'New Lead',
        budget: 2500000,
        nationality: 'British',
        preferredAreas: 'Downtown, Marina',
        propertyPreferences: '3BR Apartment',
        score: 85,
        notes: 'Looking for luxury apartment in downtown area. High purchasing power.'
      },
      {
        name: 'Sarah Johnson',
        email: 'sarah.j@email.com',
        phone: '+971 55 987 6543',
        source: 'Facebook',
        status: 'Contacted',
        budget: 5000000,
        nationality: 'American',
        preferredAreas: 'Palm Jumeirah, Dubai Hills',
        propertyPreferences: 'Villa',
        score: 92,
        notes: 'Interested in beachfront villa. Ready to move fast.'
      },
      {
        name: 'Mohammed Al-Rashid',
        email: 'm.alrashid@email.com',
        phone: '+971 50 456 7890',
        source: 'Referral',
        status: 'Visit Scheduled',
        budget: 8500000,
        nationality: 'UAE',
        preferredAreas: 'Emirates Hills, MBRC',
        propertyPreferences: 'Estate',
        score: 98,
        notes: 'High net worth client. Prefers privacy and exclusive properties.'
      },
      {
        name: 'Emma Wilson',
        email: 'emma.w@email.com',
        phone: '+971 52 234 5678',
        source: 'Google Ads',
        status: 'Negotiation',
        budget: 3200000,
        nationality: 'Australian',
        preferredAreas: 'Business Bay, DIFC',
        propertyPreferences: 'Penthouse',
        score: 78,
        notes: 'Relocating to Dubai for work. Needs property soon.'
      },
      {
        name: 'Ahmed Hassan',
        email: 'ahmed.h@email.com',
        phone: '+971 56 345 6789',
        source: 'Walk-in',
        status: 'Closed Deal',
        budget: 1800000,
        nationality: 'Egyptian',
        preferredAreas: 'JLT, DMCC',
        propertyPreferences: '2BR Apartment',
        score: 65,
        notes: 'First-time buyer. Flexible on location.'
      },
      {
        name: 'Lisa Chen',
        email: 'lisa.chen@email.com',
        phone: '+971 58 456 7890',
        source: 'Website',
        status: 'New Lead',
        budget: 4200000,
        nationality: 'Chinese',
        preferredAreas: 'DIFC, Downtown',
        propertyPreferences: 'Apartment',
        score: 88,
        notes: 'Investor looking for rental yield. Good budget.'
      },
      {
        name: 'Robert Taylor',
        email: 'r.taylor@email.com',
        phone: '+971 54 567 8901',
        source: 'Facebook',
        status: 'Contacted',
        budget: 6500000,
        nationality: 'Indian',
        preferredAreas: 'Palm Jumeirah',
        propertyPreferences: 'Villa',
        score: 75,
        notes: 'Family relocation. Needs 4+ bedrooms.'
      },
      {
        name: 'Fatima Al-Sayed',
        email: 'fatima.a@email.com',
        phone: '+971 50 678 9012',
        source: 'Referral',
        status: 'Visit Scheduled',
        budget: 7200000,
        nationality: 'Saudi',
        preferredAreas: 'MBRC, Emirates Hills',
        propertyPreferences: 'Villa',
        score: 95,
        notes: 'Serious buyer. Looking for vacation home.'
      }
    ];

    const createdLeads = [];
    for (const leadData of leads) {
      const randomUser = getRandomElement(users);
      const lead = await Lead.create({
        ...leadData,
        assignedToUserId: randomUser?.id
      });
      createdLeads.push(lead);
      console.log(`  ✅ Created lead: ${lead.name}`);
    }

    // ============ SEED DEALS ============
    console.log('\n--- Seeding Deals ---');

    const dealStages = ['Offer Made', 'Negotiation', 'Contract Signed', 'Payment', 'Closed'];
    const createdDeals = [];

    const deals = [
      {
        title: 'Billionaire\'s Row - Smith',
        buyerName: 'John Smith',
        buyerEmail: 'john.smith@email.com',
        buyerPhone: '+971 50 123 4567',
        sellerName: 'ABC Properties LLC',
        sellerEmail: 'sales@abcproperties.com',
        dealStage: 'Contract Signed',
        commission: 155000,
        finalPrice: 15500000
      },
      {
        title: 'Modern Villa - Johnson',
        buyerName: 'Sarah Johnson',
        buyerEmail: 'sarah.j@email.com',
        buyerPhone: '+971 55 987 6543',
        sellerName: 'XYZ Holdings',
        sellerEmail: 'info@xyzholdings.com',
        dealStage: 'Negotiation',
        commission: 52500,
        finalPrice: 5250000
      },
      {
        title: 'Historic Estate - Taylor',
        buyerName: 'Robert Taylor',
        buyerEmail: 'r.taylor@email.com',
        buyerPhone: '+971 54 567 8901',
        sellerName: 'Heritage Estates',
        sellerEmail: 'contact@heritage.com',
        dealStage: 'Offer Made',
        commission: 65000,
        finalPrice: 6500000
      },
      {
        title: 'Downtown Apt - Wilson',
        buyerName: 'Emma Wilson',
        buyerEmail: 'emma.w@email.com',
        buyerPhone: '+971 52 234 5678',
        sellerName: 'City Properties',
        sellerEmail: 'sales@cityproperties.com',
        dealStage: 'Closed',
        commission: 32000,
        finalPrice: 3200000
      },
      {
        title: 'Marina View - Chen',
        buyerName: 'Lisa Chen',
        buyerEmail: 'lisa.chen@email.com',
        buyerPhone: '+971 58 456 7890',
        sellerName: 'Marina Development',
        sellerEmail: 'info@marinadev.com',
        dealStage: 'Payment',
        commission: 42000,
        finalPrice: 4200000
      }
    ];

    for (const dealData of deals) {
      const randomProperty = getRandomElement(properties);
      const randomUser = getRandomElement(users);
      const randomLead = getRandomElement(createdLeads);

      const deal = await Deal.create({
        ...dealData,
        propertyId: randomProperty?.id,
        brokerId: randomUser?.id,
        buyerLeadId: randomLead?.id
      });
      createdDeals.push(deal);
      console.log(`  ✅ Created deal: ${deal.title}`);
    }

    // ============ SEED VISITS ============
    console.log('\n--- Seeding Visits ---');

    const visitStatuses = ['Scheduled', 'Completed', 'Cancelled', 'No Show'];
    const visitTitles = ['First Viewing', 'Second Viewing', 'Final Viewing', 'Follow-up Visit'];

    const visits = [
      {
        title: 'First Viewing - Downtown Penthouse',
        visitDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        status: 'Scheduled',
        clientName: 'John Smith',
        clientEmail: 'john.smith@email.com',
        clientPhone: '+971 50 123 4567',
        notes: 'Client interested in outdoor space and pool.',
        propertyId: properties[0]?.id,
        brokerId: users[0]?.id
      },
      {
        title: 'Second Viewing - Modern Villa',
        visitDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
        status: 'Scheduled',
        clientName: 'Sarah Johnson',
        clientEmail: 'sarah.j@email.com',
        clientPhone: '+971 55 987 6543',
        notes: 'Bring floor plans and HOA documents.',
        propertyId: properties[1]?.id,
        brokerId: users[1]?.id
      },
      {
        title: 'First Viewing - Historic Estate',
        visitDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        status: 'Completed',
        clientName: 'Mohammed Al-Rashid',
        clientEmail: 'm.alrashid@email.com',
        clientPhone: '+971 50 456 7890',
        notes: 'Client loved the views. Very interested.',
        propertyId: properties[2]?.id,
        brokerId: users[2]?.id
      },
      {
        title: 'Follow-up - Downtown',
        visitDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000),
        status: 'Completed',
        clientName: 'Emma Wilson',
        clientEmail: 'emma.w@email.com',
        clientPhone: '+971 52 234 5678',
        notes: 'Discussed pricing. Client to make decision by Friday.',
        propertyId: properties[0]?.id,
        brokerId: users[0]?.id
      },
      {
        title: 'Final Viewing - Villa',
        visitDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        status: 'Scheduled',
        clientName: 'Ahmed Hassan',
        clientEmail: 'ahmed.h@email.com',
        clientPhone: '+971 56 345 6789',
        notes: 'Final decision viewing. Bring legal documents.',
        propertyId: properties[1]?.id,
        brokerId: users[1]?.id
      },
      {
        title: 'First Viewing - Marina',
        visitDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        status: 'No Show',
        clientName: 'Lisa Chen',
        clientEmail: 'lisa.chen@email.com',
        clientPhone: '+971 58 456 7890',
        notes: 'Client did not show up. Follow up needed.',
        propertyId: properties[2]?.id,
        brokerId: users[2]?.id
      }
    ];

    for (const visitData of visits) {
      await Visit.create(visitData);
      console.log(`  ✅ Created visit: ${visitData.title}`);
    }

    // ============ SEED DOCUMENTS ============
    console.log('\n--- Seeding Documents ---');

    const documentTypes = ['Contract', 'Property Paper', 'Client ID', 'Permit'];
    const documentTitles = [
      { type: 'Contract', title: 'Sale Agreement - ' },
      { type: 'Property Paper', title: 'Title Deed - ' },
      { type: 'Property Paper', title: 'Floor Plan - ' },
      { type: 'Contract', title: 'MOU - ' },
      { type: 'Permit', title: 'Building permit - ' },
      { type: 'Client ID', title: 'Passport Copy - ' }
    ];

    for (let i = 0; i < 8; i++) {
      const docInfo = getRandomElement(documentTitles);
      const randomProperty = getRandomElement(properties);
      const randomDeal = getRandomElement(createdDeals);
      const randomUser = getRandomElement(users);

      const doc = await Document.create({
        title: docInfo.title + (randomProperty?.title || `Property ${i + 1}`),
        type: docInfo.type,
        propertyId: randomProperty?.id,
        dealId: randomDeal?.id,
        uploadedByUserId: randomUser?.id,
        isDigitalSignatureEnabled: Math.random() > 0.5,
        status: Math.random() > 0.6 ? 'Signed' : 'Pending Signature'
      });

      // Add document version
      await DocumentVersion.create({
        versionNumber: 1,
        fileUrl: `demo-document-${i + 1}.pdf`,
        fileName: `document-${i + 1}.pdf`,
        fileSize: Math.floor(Math.random() * 5000000) + 100000,
        notes: 'Initial version',
        documentId: doc.id,
        uploadedByUserId: randomUser?.id
      });

      console.log(`  ✅ Created document: ${doc.title}`);
    }

    // ============ SEED NOTIFICATIONS ============
    console.log('\n--- Seeding Notifications ---');

    const notifications = [
      { type: 'lead', title: 'New Lead Assigned', message: 'You have been assigned a new lead: John Smith' },
      { type: 'deal', title: 'Deal Update', message: 'Deal "Billionaire\'s Row - Smith" has moved to Contract Signed stage' },
      { type: 'visit', title: 'Upcoming Visit', message: 'You have a property viewing scheduled tomorrow at 10:00 AM' },
      { type: 'document', title: 'Document Signed', message: 'Sale Agreement for Downtown Apt has been signed by all parties' },
      { type: 'reminder', title: 'Follow-up Reminder', message: 'Follow up with Sarah Johnson regarding the villa viewing' },
      { type: 'system', title: 'Welcome to RealEdge', message: 'Your account is set up and ready to use!' }
    ];

    for (const notif of notifications) {
      const randomUser = getRandomElement(users);
      if (randomUser) {
        await Notification.create({
          userId: randomUser.id,
          title: notif.title,
          message: notif.message,
          type: notif.type,
          isRead: Math.random() > 0.5,
          createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
        });
      }
    }
    console.log('  ✅ Created notifications');

    console.log('\n🎉 Demo Data Seeding Completed Successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - ${createdLeads.length} Leads`);
    console.log(`   - ${createdDeals.length} Deals`);
    console.log(`   - 6 Visits`);
    console.log(`   - 8 Documents`);
    console.log(`   - 6 Notifications`);

  } catch (error) {
    console.error('\n❌ Error seeding demo data:', error);
  }
};

module.exports = seedDemoData;
