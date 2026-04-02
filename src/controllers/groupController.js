const { Group, User, UserGroup } = require('../models/associations');

exports.getAllGroups = async (req, res) => {
  try {
    const groups = await Group.findAll({
      attributes: ['id', 'name', 'description', 'companyCommission', 'createdAt', 'updatedAt']
    });

    const groupsWithMembers = await Promise.all(groups.map(async (group) => {
      const memberRecords = await UserGroup.findAll({
        where: { groupId: group.id },
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }]
      });
      const members = memberRecords.map(m => m.user);
      return { ...group.toJSON(), members };
    }));

    res.status(200).json({ status: 'success', data: groupsWithMembers });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error fetching groups', error: error.message });
  }
};

exports.createGroup = async (req, res) => {
  try {
    const { name, description, userIds, companyCommission } = req.body;
    const group = await Group.create({ name, description, companyCommission: companyCommission || 10 });
    
    if (userIds && userIds.length > 0) {
      for (const userId of userIds) {
        await UserGroup.create({ userId, groupId: group.id, role: 'agent' });
      }
    }
    
    const memberRecords = await UserGroup.findAll({
      where: { groupId: group.id },
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }]
    });
    const members = memberRecords.map(m => m.user);
    
    res.status(201).json({ status: 'success', data: { ...group.toJSON(), members } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: 'Error creating group', error: error.message });
  }
};

exports.updateGroup = async (req, res) => {
  try {
    const { name, description, userIds, companyCommission } = req.body;
    const group = await Group.findByPk(req.params.id);
    if (!group) return res.status(404).json({ status: 'fail', message: 'Group not found' });

    await group.update({ name, description, companyCommission });
    
    if (userIds) {
      await UserGroup.destroy({ where: { groupId: group.id } });
      for (const userId of userIds) {
        await UserGroup.create({ userId, groupId: group.id, role: 'agent' });
      }
    }

    const memberRecords = await UserGroup.findAll({
      where: { groupId: group.id },
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }]
    });
    const members = memberRecords.map(m => m.user);

    res.status(200).json({ status: 'success', data: { ...group.toJSON(), members } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: 'Error updating group', error: error.message });
  }
};

exports.deleteGroup = async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id);
    if (!group) return res.status(404).json({ status: 'fail', message: 'Group not found' });
    
    await group.destroy();
    res.status(200).json({ status: 'success', message: 'Group deleted successfully' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error deleting group', error: error.message });
  }
};

exports.addGroupMember = async (req, res) => {
  try {
    const { userId, groupId } = req.body;
    
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ status: 'fail', message: 'User not found' });

    const group = await Group.findByPk(groupId);
    if (!group) return res.status(404).json({ status: 'fail', message: 'Group not found' });

    const existing = await UserGroup.findOne({ where: { userId, groupId } });
    if (existing) {
      return res.status(400).json({ status: 'fail', message: 'User already in group' });
    }

    await UserGroup.create({ userId, groupId, role: 'agent' });
    res.status(200).json({ status: 'success', message: 'Member added to group' });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: 'Error adding group member', error: error.message });
  }
};

exports.getGroupStats = async (req, res) => {
  try {
    const groups = await Group.findAll();

    const groupStats = await Promise.all(groups.map(async (group) => {
      const count = await UserGroup.count({ where: { groupId: group.id } });
      return {
        id: group.id,
        name: group.name,
        memberCount: count
      };
    }));

    res.status(200).json({ 
      status: 'success',
      totalGroups: groups.length,
      groups: groupStats
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error fetching group stats', error: error.message });
  }
};

const VALID_ROLES = ['team_leader', 'senior_agent', 'agent', 'trainee'];

exports.addUserToGroup = async (req, res) => {
  const transaction = await require('../config/database').sequelize.transaction();
  
  try {
    const { id: groupId } = req.params;
    const { userId, role = 'agent', commissionSplit } = req.body;

    if (!userId) {
      return res.status(400).json({ status: 'fail', message: 'userId is required' });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ 
        status: 'fail', 
        message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` 
      });
    }

    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ status: 'fail', message: 'Group not found' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ status: 'fail', message: 'User not found' });
    }

    const existingMember = await UserGroup.findOne({
      where: { userId, groupId }
    });

    if (existingMember) {
      return res.status(400).json({ 
        status: 'fail', 
        message: 'User is already a member of this group' 
      });
    }

    if (role === 'team_leader') {
      const existingLeader = await UserGroup.findOne({
        where: { groupId, role: 'team_leader' }
      });

      if (existingLeader) {
        return res.status(400).json({ 
          status: 'fail', 
          message: 'Group already has a team leader. Remove the current leader first.' 
        });
      }
    }

    const userGroup = await UserGroup.create({
      userId,
      groupId,
      role,
      commissionSplit: commissionSplit || null
    }, { transaction });

    await transaction.commit();

    const result = await UserGroup.findByPk(userGroup.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        { model: Group, as: 'group', attributes: ['id', 'name'] }
      ]
    });

    res.status(201).json({ 
      status: 'success', 
      message: 'User added to group',
      data: result
    });
  } catch (error) {
    await transaction.rollback();
    res.status(400).json({ status: 'fail', message: 'Error adding user to group', error: error.message });
  }
};

exports.removeUserFromGroup = async (req, res) => {
  const transaction = await require('../config/database').sequelize.transaction();
  
  try {
    const { id: groupId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ status: 'fail', message: 'userId is required' });
    }

    const userGroup = await UserGroup.findOne({
      where: { userId, groupId }
    });

    if (!userGroup) {
      return res.status(404).json({ status: 'fail', message: 'User is not a member of this group' });
    }

    await userGroup.destroy({ transaction });

    await transaction.commit();

    res.status(200).json({ 
      status: 'success', 
      message: 'User removed from group' 
    });
  } catch (error) {
    await transaction.rollback();
    res.status(400).json({ status: 'fail', message: 'Error removing user from group', error: error.message });
  }
};

exports.updateGroupRoles = async (req, res) => {
  const transaction = await require('../config/database').sequelize.transaction();
  
  try {
    const { id: groupId } = req.params;
    const { members } = req.body;

    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ status: 'fail', message: 'members array is required' });
    }

    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ status: 'fail', message: 'Group not found' });
    }

    const teamLeaderCount = members.filter(m => m.role === 'team_leader').length;
    if (teamLeaderCount > 1) {
      return res.status(400).json({ status: 'fail', message: 'Only one team leader is allowed per group' });
    }

    const existingLeader = await UserGroup.findOne({
      where: { groupId, role: 'team_leader' }
    });

    for (const member of members) {
      const { userId, role, commissionSplit } = member;

      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ 
          status: 'fail', 
          message: `Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(', ')}` 
        });
      }

      if (role === 'team_leader' && existingLeader) {
        const otherLeader = members.find(m => m.role === 'team_leader' && m.userId !== existingLeader.userId);
        if (otherLeader) {
          return res.status(400).json({ 
            status: 'fail', 
            message: 'Cannot assign multiple team leaders. Remove current leader first.' 
          });
        }
      }

      const userGroup = await UserGroup.findOne({
        where: { userId, groupId }
      });

      if (!userGroup) {
        return res.status(404).json({ 
          status: 'fail', 
          message: `User ${userId} is not a member of this group` 
        });
      }

      await userGroup.update({
        role,
        commissionSplit: commissionSplit || null
      }, { transaction });
    }

    await transaction.commit();

    const updatedMembers = await UserGroup.findAll({
      where: { groupId },
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        { model: Group, as: 'group', attributes: ['id', 'name'] }
      ]
    });

    res.status(200).json({ 
      status: 'success', 
      message: 'Group roles updated',
      data: updatedMembers
    });
  } catch (error) {
    await transaction.rollback();
    res.status(400).json({ status: 'fail', message: 'Error updating group roles', error: error.message });
  }
};

exports.getGroupMembers = async (req, res) => {
  try {
    const { id: groupId } = req.params;

    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ status: 'fail', message: 'Group not found' });
    }

    const members = await UserGroup.findAll({
      where: { groupId },
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'photo'] },
        { model: Group, as: 'group', attributes: ['id', 'name'] }
      ]
    });

    res.status(200).json({ 
      status: 'success', 
      data: {
        group: { id: group.id, name: group.name, description: group.description },
        members
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error fetching group members', error: error.message });
  }
};
