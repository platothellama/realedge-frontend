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
