const { User, Group } = require('../models/associations');
const { Op } = require('sequelize');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      include: [{ model: Group, as: 'groups', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json({ status: 'success', data: users });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.getUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: Group, as: 'groups', attributes: ['id', 'name'] }]
    });
    if (!user) return res.status(404).json({ status: 'fail', message: 'User not found' });
    res.status(200).json({ status: 'success', data: user });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, groupIds } = req.body;
    const user = await User.create({ name, email, password, role });
    
    if (groupIds && groupIds.length > 0) {
      await user.setGroups(groupIds);
    }

    // Hide password from response
    user.password = undefined;
    const result = await User.findByPk(user.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: Group, as: 'groups', attributes: ['id', 'name'] }]
    });

    res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ status: 'fail', message: 'User not found' });

    const { name, email, role, active, groupIds } = req.body;
    await user.update({ name, email, role, active });
    
    if (groupIds) {
      await user.setGroups(groupIds);
    }
    
    const result = await User.findByPk(user.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: Group, as: 'groups', attributes: ['id', 'name'] }]
    });

    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ status: 'fail', message: 'User not found' });
    
    // Safety check: Prevent deleting yourself
    if (user.id === req.user.id) {
       return res.status(400).json({ status: 'fail', message: 'You cannot delete yourself.' });
    }

    await user.destroy();
    res.status(200).json({ status: 'success', message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ status: 'fail', message: 'User not found' });

    user.active = !user.active;
    await user.save({ validate: false });

    res.status(200).json({ 
      status: 'success', 
      message: `User has been ${user.active ? 'activated' : 'blocked'}.` 
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
