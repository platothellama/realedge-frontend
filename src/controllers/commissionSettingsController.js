const { SystemSetting, DealCommission, Deal, User, Group } = require('../models/associations');
const commissionService = require('../services/commissionService');

exports.getCommissionSettings = async (req, res) => {
  try {
    const settings = await commissionService.getCommissionSettings();
    
    res.status(200).json({
      status: 'success',
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching commission settings',
      error: error.message
    });
  }
};

exports.updateCommissionSettings = async (req, res) => {
  try {
    const { company, team } = req.body;

    if (company === undefined || team === undefined) {
      return res.status(400).json({
        status: 'fail',
        message: 'company and team percentages are required'
      });
    }

    if (company + team !== 100) {
      return res.status(400).json({
        status: 'fail',
        message: 'Company and team percentages must sum to 100'
      });
    }

    const setting = await commissionService.updateCommissionSettings({ company, team });

    res.status(200).json({
      status: 'success',
      message: 'Commission settings updated',
      data: setting
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error updating commission settings',
      error: error.message
    });
  }
};

exports.getAllSettings = async (req, res) => {
  try {
    const settings = await SystemSetting.findAll({
      order: [['type', 'ASC'], ['sKey', 'ASC']]
    });

    res.status(200).json({
      status: 'success',
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching settings',
      error: error.message
    });
  }
};

exports.updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const setting = await SystemSetting.findOne({ where: { sKey: key } });

    if (!setting) {
      return res.status(404).json({
        status: 'fail',
        message: 'Setting not found'
      });
    }

    if (!setting.isEditable) {
      return res.status(403).json({
        status: 'fail',
        message: 'This setting is not editable'
      });
    }

    await setting.update({ value });

    res.status(200).json({
      status: 'success',
      message: 'Setting updated',
      data: setting
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error updating setting',
      error: error.message
    });
  }
};

exports.getCommissionsSummary = async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    const where = {};
    if (status) {
      where.status = status;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.$gte = new Date(startDate);
      if (endDate) where.createdAt.$lte = new Date(endDate);
    }

    const commissions = await DealCommission.findAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'photo'] },
        { 
          model: Deal, 
          as: 'deal', 
          attributes: ['id', 'title', 'finalPrice', 'closedAt'],
          include: [
            { model: Property, as: 'property', attributes: ['id', 'title', 'address'] }
          ]
        },
        { model: Group, as: 'group', attributes: ['id', 'name'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    const totalAmount = commissions.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
    const pendingAmount = commissions
      .filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
    const approvedAmount = commissions
      .filter(c => c.status === 'approved')
      .reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
    const paidAmount = commissions
      .filter(c => c.status === 'paid')
      .reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);

    res.status(200).json({
      status: 'success',
      data: {
        commissions,
        summary: {
          totalAmount,
          pendingAmount,
          approvedAmount,
          paidAmount,
          count: commissions.length
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching commissions summary',
      error: error.message
    });
  }
};

exports.approveCommission = async (req, res) => {
  try {
    const { id } = req.params;

    const commission = await commissionService.approveCommission(id, req.user.id);

    res.status(200).json({
      status: 'success',
      message: 'Commission approved',
      data: commission
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error approving commission',
      error: error.message
    });
  }
};

exports.markCommissionPaid = async (req, res) => {
  try {
    const { id } = req.params;

    const commission = await commissionService.markAsPaid(id);

    res.status(200).json({
      status: 'success',
      message: 'Commission marked as paid',
      data: commission
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error marking commission as paid',
      error: error.message
    });
  }
};
