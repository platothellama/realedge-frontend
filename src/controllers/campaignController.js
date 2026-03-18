const { Campaign, Lead, User, EmailTracking } = require('../models/associations');
const emailService = require('../services/emailService');

exports.getCampaigns = async (req, res) => {
  try {
    const { type, status } = req.query;
    let where = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const campaigns = await Campaign.findAll({
      where,
      include: [{ model: User, as: 'creator', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json(campaigns);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching campaigns', error: error.message });
  }
};

exports.createCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.create({
      ...req.body,
      createdByUserId: req.user.id
    });
    res.status(201).json(campaign);
  } catch (error) {
    res.status(400).json({ message: 'Error creating campaign', error: error.message });
  }
};

exports.updateCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findByPk(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    await campaign.update(req.body);
    res.status(200).json(campaign);
  } catch (error) {
    res.status(400).json({ message: 'Error updating campaign', error: error.message });
  }
};

exports.deleteCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findByPk(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    await campaign.destroy();
    res.status(200).json({ message: 'Campaign deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting campaign', error: error.message });
  }
};

exports.sendCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findByPk(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    let leads = [];
    if (campaign.targetAudience && campaign.targetAudience.leadStatus) {
      leads = await Lead.findAll({
        where: { status: campaign.targetAudience.leadStatus }
      });
    } else {
      leads = await Lead.findAll();
    }

    const stats = { sent: 0, failed: 0, total: leads.length };
    
    for (const lead of leads) {
      if (!lead.email) {
        stats.failed++;
        continue;
      }

      const result = await emailService.sendEmail({
        to: lead.email,
        subject: campaign.subject,
        body: campaign.content,
        campaignId: campaign.id,
        leadId: lead.id,
        agentId: req.user.id
      });

      if (result.success) {
        stats.sent++;
      } else {
        stats.failed++;
      }
    }

    await campaign.update({
      status: stats.sent > 0 ? 'active' : 'draft',
      stats: { ...campaign.stats, sent: stats.sent }
    });

    res.status(200).json({ 
      message: stats.sent > 0 ? 'Campaign sent' : 'Campaign send failed',
      stats,
      simulated: !emailService.isConfigured
    });
  } catch (error) {
    res.status(500).json({ message: 'Error sending campaign', error: error.message });
  }
};

exports.getCampaignStats = async (req, res) => {
  try {
    const [totalCampaigns, activeCampaigns, totalEmails, openedEmails, clickedEmails] = await Promise.all([
      Campaign.count(),
      Campaign.count({ where: { status: 'active' } }),
      EmailTracking.count(),
      EmailTracking.count({ where: { status: { [require('sequelize').Op.in]: ['opened', 'clicked', 'replied'] } } }),
      EmailTracking.count({ where: { status: { [require('sequelize').Op.in]: ['clicked', 'replied'] } } })
    ]);

    const campaigns = await Campaign.findAll({
      attributes: ['type', 'status', 'createdAt']
    });

    const byType = {};
    campaigns.forEach(c => {
      if (!byType[c.type]) byType[c.type] = 0;
      byType[c.type]++;
    });

    res.status(200).json({
      totalCampaigns,
      activeCampaigns,
      totalEmails,
      openedEmails,
      clickedEmails,
      openRate: totalEmails > 0 ? ((openedEmails / totalEmails) * 100).toFixed(1) : 0,
      clickRate: totalEmails > 0 ? ((clickedEmails / totalEmails) * 100).toFixed(1) : 0,
      byType
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching campaign stats', error: error.message });
  }
};
