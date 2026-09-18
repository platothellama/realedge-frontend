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
   * Round money to integer cents (QA 2026-09-18: unrounded floats drift
   * against the D13 exact-equality overpay guards).
   */
  roundCents(x) {
    return Math.round(Number(x) * 100) / 100;
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

    // QA hardening 2026-09-18: garbage in ("abc", negatives, >100%) used to
    // flow straight into stored money as NaN/negative. Junk → 0, cents rounded.
    const price = Number(finalPrice);
    if (!Number.isFinite(price) || price < 0) return 0;

    if (commissionType === 'fixed' && commissionValue != null) {
      const v = Number(commissionValue);
      if (!Number.isFinite(v) || v < 0) return 0;
      return this.roundCents(v);
    }

    if (commissionType === 'percentage' && commissionValue != null) {
      const pct = Number(commissionValue);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) return 0;
      return this.roundCents(price * (pct / 100));
    }

    const fallbackPct = Number(commissionPercentage || 0);
    if (!Number.isFinite(fallbackPct) || fallbackPct < 0 || fallbackPct > 100) return 0;
    return this.roundCents(price * (fallbackPct / 100));
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
    // QA hardening 2026-09-18: a stored negative/NaN/>100 override used to
    // poison the pro-rata scaling downstream — clamp to a valid percentage.
    if (customSplit !== null && customSplit !== undefined && customSplit !== '') {
      const v = Number(customSplit);
      if (Number.isFinite(v) && v >= 0 && v <= 100) return v;
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
          { model: User, as: 'broker' },
          { model: Group, as: 'dealGroup' }
        ]
      });
      
      if (!deal) {
        throw new Error('Deal not found');
      }
      
      const finalPrice = parseFloat(deal.finalPrice) || parseFloat(deal.property?.price) || 0;
      const totalCommission = this.calculatePropertyCommission(deal.property, finalPrice);
      
      const settings = await this.getCommissionSettings();
      
      // PHASE 2 (D5/D7): individual-with-group holdback is INTENTIONAL and
      // credited to the company reserve. The agent keeps the global team %
      // and the company absorbs the remainder (company% + holdback), so the
      // full 100% is always distributed. Splits are admin-configurable
      // (SystemSetting commission_split; Group.companyCommission 0-100).
      const agentPercentage = settings.teamPercentage;
      const companyPercentage = deal.dealGroup ? (deal.dealGroup.companyCommission ?? settings.companyPercentage) : settings.companyPercentage;

      const agentCommission = totalCommission * (agentPercentage / 100);
      // Company residual absorbs any holdback (D5 → company reserve).
      const companyCommission = totalCommission - agentCommission;
      const holdbackPercentage = Math.max(0, 100 - companyPercentage - agentPercentage);
      const holdbackAmount = totalCommission * (holdbackPercentage / 100);
      
      await DealCommission.destroy({ where: { dealId }, transaction });
      
      const dealCommission = await DealCommission.create({
        dealId: deal.id,
        userId: deal.brokerId,
        groupId: null,
        roleInDeal: 'seller_agent',
        percentage: agentPercentage,
        amount: agentCommission,
        salePrice: finalPrice,
        totalCommission: totalCommission,
        companyAmount: companyCommission,
        companyPercentage: companyPercentage,
        agentAmount: agentCommission,
        reserveAmount: holdbackAmount,
        status: 'pending',
        notes: holdbackAmount > 0 ? `Includes holdback reserve ${holdbackAmount.toFixed(2)} (${holdbackPercentage.toFixed(2)}%) per D5` : null
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
          { model: User, as: 'broker' },
          { model: Group, as: 'dealGroup' }
        ]
      });
      
      if (!deal) {
        throw new Error('Deal not found');
      }
      
      const groupId = deal.groupId;
      if (!groupId) {
        return this.calculateIndividualCommission(dealId);
      }
      
      const finalPrice = parseFloat(deal.finalPrice) || parseFloat(deal.property?.price) || 0;
      const totalCommission = this.calculatePropertyCommission(deal.property, finalPrice);
      
      const group = await Group.findByPk(groupId);

      // PHASE 2 (D7): admin-configurable; respect explicit 0.
      const companyPercentage = group ? (group.companyCommission ?? 10) : 10;
      const teamPercentage = 100 - companyPercentage;
      const companyCommission = totalCommission * (companyPercentage / 100);
      const teamCommission = totalCommission * (teamPercentage / 100);
      
      console.log('Commission Calculation:', {
        finalPrice,
        totalCommission,
        companyPercentage,
        teamPercentage,
        companyCommission,
        teamCommission
      });
      
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
          // PHASE 2 (D6b): preserve granular roles instead of collapsing to
          // co_agent. Requires roleInDeal ENUM to include senior_agent /
          // agent / trainee (see models/dealCommission.js).
          const roleInDeal = ['team_leader', 'senior_agent', 'agent', 'trainee'].includes(member.role)
            ? member.role
            : 'co_agent';
          
          return DealCommission.create({
            dealId: deal.id,
            userId: member.userId,
            groupId: member.groupId,
            roleInDeal,
            percentage: member.roleSplit,
            amount: memberAmount,
            salePrice: finalPrice,
            totalCommission: totalCommission,
            companyAmount: companyCommission,
            companyPercentage: companyPercentage,
            agentAmount: memberAmount,
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
    
    if (deal.groupId) {
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

    // QA hardening 2026-09-18: pending → approved only (no paid→approved
    // regression, no double-approve timestamp rewrite).
    if (commission.status !== 'pending') {
      throw new Error(`Only pending commissions can be approved (current: ${commission.status})`);
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

    // QA hardening 2026-09-18: approved → paid only (no pending → paid
    // approval skip, no paid → paid timestamp rewrite).
    if (commission.status !== 'approved') {
      throw new Error(`Only approved commissions can be marked paid (current: ${commission.status})`);
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
    // QA hardening 2026-09-18: coerce before comparing — string "40"+"60"
    // used to become "4060" and fail/pass inconsistently.
    const company = Number(settings?.company);
    const team = Number(settings?.team);
    if (!Number.isFinite(company) || !Number.isFinite(team)) {
      throw new Error('Company and team percentages must be numbers');
    }

    // PHASE 2 (D7): splits are admin-configurable; enforce valid range.
    if (company < 0 || company > 100 || team < 0 || team > 100) {
      throw new Error('Company and team percentages must each be between 0 and 100');
    }
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
  async calculatePropertyCommissionDirect(propertyId, closedDeal = null) {
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
        const result = await this.calculatePropertyGroupCommission(property, finalPrice, totalCommission, transaction, closedDeal);
        await transaction.commit();
        return result;
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
        salePrice: finalPrice,
        totalCommission: totalCommission,
        companyAmount: companyCommission,
        companyPercentage: companyPercentage,
        agentAmount: agentCommission,
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
  async calculatePropertyGroupCommission(property, finalPrice, totalCommission, transaction, closedDeal = null) {
    const groupId = property.assignedToGroupId;
    const group = await Group.findByPk(groupId);
    // PHASE 2 (D7): admin-configurable; respect explicit 0.
    const companyPercentage = group ? (group.companyCommission ?? 10) : 10;
    const companyCommission = totalCommission * (companyPercentage / 100);



    const teamPercentage = 100 - companyPercentage;
    const teamCommission = totalCommission * (teamPercentage / 100);
    
    const groupMembers = await UserGroup.findAll({
      where: { groupId },
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }]
    });
    
    if (groupMembers.length === 0) {
      throw new Error('No members found in group');
    }
    
    // PHASE 2 (D6): normalize the property-group path exactly like the
    // deal-group path so identical teams produce identical payouts.
    let totalRolePercentage = 0;
    const splits = groupMembers.map(m => {
      const s = this.getRoleSplitPercentage(m.role, m.commissionSplit);
      totalRolePercentage += s;
      return { member: m, split: s };
    });
    if (totalRolePercentage !== 100 && totalRolePercentage > 0) {
      const scaleFactor = 100 / totalRolePercentage;
      splits.forEach(s => { s.split = s.split * scaleFactor; });
    }

    const commissions = [];

    for (const { member, split: roleSplit } of splits) {
      const memberCommission = teamCommission * (roleSplit / 100);
      const roleInDeal = ['team_leader', 'senior_agent', 'agent', 'trainee'].includes(member.role)
        ? member.role
        : 'seller_agent';

      const dealCommission = await DealCommission.create({
        dealId: closedDeal,
        userId: member.userId,
        groupId: groupId,
        roleInDeal,
        percentage: roleSplit,
        amount: memberCommission,
        salePrice: finalPrice,
        totalCommission: totalCommission,
        companyAmount: companyCommission,
        companyPercentage: companyPercentage,
        agentAmount: memberCommission,
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
