const { sequelize } = require('../config/database');
const { Deal, Property, User, Group, UserGroup, DealCommission, SystemSetting } = require('../models/associations');

const DEFAULT_ROLE_SPLITS = {
  team_leader: 40,
  senior_agent: 30,
  agent: 20,
  trainee: 10
};

const DEFAULT_COMPANY_SPLIT = 40;

class CommissionService {
  
  /**
   * Get system settings for commission distribution
   * @returns {Object} { companyPercentage, teamPercentage }
   */
  async getCommissionSettings() {
    try {
      const setting = await SystemSetting.findOne({ 
        where: { sKey: 'commission_split' } 
      });
      
      if (setting && setting.value) {
        return {
          companyPercentage: setting.value.company || DEFAULT_COMPANY_SPLIT,
          teamPercentage: setting.value.team || (100 - DEFAULT_COMPANY_SPLIT)
        };
      }
    } catch (error) {
      console.warn('Commission settings not found, using defaults');
    }
    
    return {
      companyPercentage: DEFAULT_COMPANY_SPLIT,
      teamPercentage: 100 - DEFAULT_COMPANY_SPLIT
    };
  }

  /**
   * Calculate total commission from a property deal
   * @param {Object} property - Property instance
   * @param {Number} finalPrice - Final sale price
   * @returns {Number} Total commission amount
   */
  calculatePropertyCommission(property, finalPrice) {
    if (!property) return 0;
    
    const { commissionType, commissionValue, commissionPercentage } = property;
    
    if (commissionType === 'fixed' && commissionValue) {
      return parseFloat(commissionValue);
    }
    
    if (commissionType === 'percentage' && commissionValue) {
      return parseFloat(finalPrice) * (parseFloat(commissionValue) / 100);
    }
    
    return parseFloat(finalPrice) * (parseFloat(commissionPercentage || 0) / 100);
  }

  /**
   * Get user role in a group
   * @param {String} userId 
   * @param {String} groupId 
   * @returns {Object|null} UserGroup instance
   */
  async getUserRoleInGroup(userId, groupId) {
    return await UserGroup.findOne({
      where: { userId, groupId }
    });
  }

  /**
   * Get split percentage for a role
   * @param {String} role - Role in group
   * @param {Number|null} customSplit - Custom override
   * @returns {Number} Split percentage
   */
  getRoleSplitPercentage(role, customSplit) {
    if (customSplit !== null && customSplit !== undefined) {
      return customSplit;
    }
    return DEFAULT_ROLE_SPLITS[role] || DEFAULT_ROLE_SPLITS.agent;
  }

  /**
   * Calculate commission for an individual sale (no group)
   * @param {String} dealId 
   * @returns {Object} Commission calculation result
   */
  async calculateIndividualCommission(dealId) {
    const transaction = await sequelize.transaction();
    
    try {
      const deal = await Deal.findByPk(dealId, {
        include: [
          { model: Property, as: 'property' },
          { model: User, as: 'agent' }
        ]
      });
      
      if (!deal) {
        throw new Error('Deal not found');
      }
      
      const finalPrice = parseFloat(deal.finalPrice) || parseFloat(deal.commission);
      const totalCommission = this.calculatePropertyCommission(deal.property, finalPrice);
      
      const settings = await this.getCommissionSettings();
      
      const agentPercentage = settings.teamPercentage;
      const companyPercentage = settings.companyPercentage;
      
      const agentCommission = totalCommission * (agentPercentage / 100);
      const companyCommission = totalCommission * (companyPercentage / 100);
      
      await DealCommission.destroy({ where: { dealId }, transaction });
      
      const dealCommission = await DealCommission.create({
        dealId: deal.id,
        userId: deal.agentId,
        groupId: null,
        roleInDeal: 'seller_agent',
        percentage: agentPercentage,
        amount: agentCommission,
        status: 'pending'
      }, { transaction });
      
      await transaction.commit();
      
      return {
        dealId: deal.id,
        totalCommission,
        companyCommission,
        companyPercentage,
        agentCommission,
        agentPercentage,
        commissions: [dealCommission],
        type: 'individual'
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Calculate commission for a group sale
   * Uses group's companyCommission percentage instead of global settings
   * @param {String} dealId 
   * @returns {Object} Commission calculation result
   */
  async calculateGroupCommission(dealId) {
    const transaction = await sequelize.transaction();
    
    try {
      const deal = await Deal.findByPk(dealId, {
        include: [
          { model: Property, as: 'property' },
          { model: User, as: 'agent' },
          { model: Group, as: 'assignedGroup' }
        ]
      });
      
      if (!deal) {
        throw new Error('Deal not found');
      }
      
      const groupId = deal.assignedToGroupId;
      if (!groupId) {
        return this.calculateIndividualCommission(dealId);
      }
      
      const finalPrice = parseFloat(deal.finalPrice) || parseFloat(deal.commission);
      const totalCommission = this.calculatePropertyCommission(deal.property, finalPrice);
      
      const group = await Group.findByPk(groupId);
      const companyPercentage = group ? (group.companyCommission || 10) : 10;
      const teamPercentage = 100 - companyPercentage;
      
      const companyCommission = totalCommission * (companyPercentage / 100);
      const teamCommission = totalCommission * (teamPercentage / 100);
      
      const groupMembers = await UserGroup.findAll({
        where: { groupId },
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }]
      });
      
      if (groupMembers.length === 0) {
        throw new Error('No members found in group');
      }
      
      let totalRolePercentage = 0;
      const memberSplits = groupMembers.map(ug => {
        const roleSplit = this.getRoleSplitPercentage(ug.role, ug.commissionSplit);
        totalRolePercentage += roleSplit;
        return {
          userId: ug.userId,
          user: ug.user,
          role: ug.role,
          commissionSplit: ug.commissionSplit,
          roleSplit,
          groupId
        };
      });
      
      if (totalRolePercentage !== 100) {
        const scaleFactor = 100 / totalRolePercentage;
        memberSplits.forEach(m => {
          m.roleSplit = m.roleSplit * scaleFactor;
        });
      }
      
      await DealCommission.destroy({ where: { dealId }, transaction });
      
      const commissions = await Promise.all(
        memberSplits.map(member => {
          const memberAmount = teamCommission * (member.roleSplit / 100);
          const roleInDeal = member.role === 'team_leader' ? 'team_leader' : 
                            (member.role === 'senior_agent' ? 'co_agent' : 'co_agent');
          
          return DealCommission.create({
            dealId: deal.id,
            userId: member.userId,
            groupId: member.groupId,
            roleInDeal,
            percentage: member.roleSplit,
            amount: memberAmount,
            status: 'pending'
          }, { transaction });
        })
      );
      
      await transaction.commit();
      
      return {
        dealId: deal.id,
        totalCommission,
        companyCommission,
        companyPercentage,
        teamCommission,
        teamPercentage,
        commissions,
        type: 'group',
        groupMembers: memberSplits
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Main method to calculate deal commission
   * Automatically determines if it's individual or group sale
   * @param {String} dealId 
   * @returns {Object} Commission calculation result
   */
  async calculateDealCommission(dealId) {
    const deal = await Deal.findByPk(dealId);
    
    if (!deal) {
      throw new Error('Deal not found');
    }
    
    if (deal.assignedToGroupId) {
      return this.calculateGroupCommission(dealId);
    }
    
    return this.calculateIndividualCommission(dealId);
  }

  /**
   * Get all commissions for a deal
   * @param {String} dealId 
   * @returns {Array} Array of DealCommission instances
   */
  async getDealCommissions(dealId) {
    return await DealCommission.findAll({
      where: { dealId },
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        { model: Group, as: 'group', attributes: ['id', 'name'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  /**
   * Approve commission for a deal
   * @param {String} dealCommissionId 
   * @param {String} approvedByUserId 
   * @returns {Object} Updated DealCommission
   */
  async approveCommission(dealCommissionId, approvedByUserId) {
    const commission = await DealCommission.findByPk(dealCommissionId);
    
    if (!commission) {
      throw new Error('Commission not found');
    }
    
    await commission.update({
      status: 'approved',
      approvedAt: new Date()
    });
    
    return commission;
  }

  /**
   * Mark commission as paid
   * @param {String} dealCommissionId 
   * @returns {Object} Updated DealCommission
   */
  async markAsPaid(dealCommissionId) {
    const commission = await DealCommission.findByPk(dealCommissionId);
    
    if (!commission) {
      throw new Error('Commission not found');
    }
    
    await commission.update({
      status: 'paid',
      paidAt: new Date()
    });
    
    return commission;
  }

  /**
   * Update commission split settings
   * @param {Object} settings - { company: 40, team: 60 }
   */
  async updateCommissionSettings(settings) {
    const { company, team } = settings;
    
    if (company + team !== 100) {
      throw new Error('Company and team percentages must sum to 100');
    }
    
    const [setting, created] = await SystemSetting.findOrCreate({
      where: { sKey: 'commission_split' },
      defaults: {
        sKey: 'commission_split',
        value: { company, team },
        type: 'commission',
        description: 'Default commission split between company and team'
      }
    });
    
    if (!created) {
      await setting.update({ value: { company, team } });
    }
    
      return setting;
  }

  /**
   * Calculate commission for a property sold directly (without a deal)
   * @param {String} propertyId 
   * @returns {Object} Commission calculation result
   */
  async calculatePropertyCommissionDirect(propertyId) {
    const transaction = await sequelize.transaction();
    
    try {
      const property = await Property.findByPk(propertyId);
      
      if (!property) {
        throw new Error('Property not found');
      }
      
      const finalPrice = parseFloat(property.price) || 0;
      const totalCommission = this.calculatePropertyCommission(property, finalPrice);
      
      const settings = await this.getCommissionSettings();
      
      if (property.assignedToGroupId) {
        return this.calculatePropertyGroupCommission(property, finalPrice, totalCommission, transaction);
      }
      
      const agentPercentage = settings.teamPercentage;
      const companyPercentage = settings.companyPercentage;
      
      const agentCommission = totalCommission * (agentPercentage / 100);
      const companyCommission = totalCommission * (companyPercentage / 100);
      
      const agentId = property.assignedToUserId;
      
      if (!agentId) {
        await transaction.rollback();
        return {
          propertyId: property.id,
          totalCommission,
          companyCommission,
          companyPercentage,
          agentCommission: 0,
          agentPercentage: 0,
          commissions: [],
          type: 'individual',
          message: 'No agent assigned to property'
        };
      }
      
      const dealCommission = await DealCommission.create({
        dealId: null,
        userId: agentId,
        groupId: null,
        roleInDeal: 'seller_agent',
        percentage: agentPercentage,
        amount: agentCommission,
        status: 'pending',
        notes: `Commission for property sale: ${property.title}`
      }, { transaction });
      
      await transaction.commit();
      
      return {
        propertyId: property.id,
        totalCommission,
        companyCommission,
        companyPercentage,
        agentCommission,
        agentPercentage,
        commissions: [dealCommission],
        type: 'individual'
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Calculate commission for a property sold by a group
   */
  async calculatePropertyGroupCommission(property, finalPrice, totalCommission, transaction) {
    const groupId = property.assignedToGroupId;
    const group = await Group.findByPk(groupId);
    
    const companyPercentage = group ? (group.companyCommission || 10) : 10;
    const teamPercentage = 100 - companyPercentage;
    
    const companyCommission = totalCommission * (companyPercentage / 100);
    const teamCommission = totalCommission * (teamPercentage / 100);
    
    const groupMembers = await UserGroup.findAll({
      where: { groupId },
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }]
    });
    
    if (groupMembers.length === 0) {
      throw new Error('No members found in group');
    }
    
    const commissions = [];
    
    for (const member of groupMembers) {
      const roleSplit = this.getRoleSplitPercentage(member.role, member.commissionSplit);
      const memberCommission = teamCommission * (roleSplit / 100);
      
      const dealCommission = await DealCommission.create({
        dealId: null,
        userId: member.userId,
        groupId: groupId,
        roleInDeal: member.role,
        percentage: roleSplit,
        amount: memberCommission,
        status: 'pending',
        notes: `Commission for property sale: ${property.title}`
      }, { transaction });
      
      commissions.push(dealCommission);
    }
    
    return {
      propertyId: property.id,
      totalCommission,
      companyCommission,
      companyPercentage,
      teamCommission,
      teamPercentage,
      commissions,
      type: 'group'
    };
  }
}

module.exports = new CommissionService();
