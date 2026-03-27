const { Group, User } = require('../models/associations');

exports.getAllGroups = async (req, res) => {
  try {
    const groups = await Group.findAll({
      include: [{ model: User, as: 'members', attributes: ['id', 'name', 'email'] }]
    });
    res.status(200).json({ status: 'success', data: groups });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error fetching groups', error: error.message });
  }
};

exports.createGroup = async (req, res) => {
  try {
    const { name, description, userIds } = req.body;
    const group = await Group.create({ name, description });
    
    if (userIds && userIds.length > 0) {
      await group.addMembers(userIds);
    }
    
    const result = await Group.findByPk(group.id, {
      include: [{ model: User, as: 'members', attributes: ['id', 'name', 'email'] }]
    });
    
    res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: 'Error creating group', error: error.message });
  }
};

exports.updateGroup = async (req, res) => {
  try {
    const { name, description, userIds } = req.body;
    const group = await Group.findByPk(req.params.id);
    if (!group) return res.status(404).json({ status: 'fail', message: 'Group not found' });

    await group.update({ name, description });
    
    if (userIds) {
      await group.setMembers(userIds);
    }

    const result = await Group.findByPk(group.id, {
      include: [{ model: User, as: 'members', attributes: ['id', 'name', 'email'] }]
    });

    res.status(200).json({ status: 'success', data: result });
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

    await group.addMember(user);
    res.status(200).json({ status: 'success', message: 'Member added to group' });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: 'Error adding group member', error: error.message });
  }
};

exports.getGroupStats = async (req, res) => {
  try {
    const groups = await Group.findAll({
      include: [{ model: User, as: 'members', attributes: ['id'] }]
    });

    const groupStats = groups.map(group => ({
      id: group.id,
      name: group.name,
      memberCount: group.members ? group.members.length : 0
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
