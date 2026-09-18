const { User, Group } = require('../models/associations');
const { Op } = require('sequelize');
const { safeError } = require('../utils/http');

// PHASE 2 (D20): hierarchy Super Admin > Admin > Office Manager > Broker >
// everyone else. Users may manage only strictly-lower roles; OM cannot touch
// Admin/Super Admin; promotion to Admin/Super Admin is Super-Admin-only.
const ROLE_RANK = {
  'Super Admin': 5,
  'Admin': 4,
  'Office Manager': 3,
  'Broker': 2,
  'Agent': 1,
  'Accountant': 1,
  'Marketing': 1,
  'Client': 1
};
const rankOf = (role) => ROLE_RANK[role] ?? 0;
const isAdminFamily = (role) => role === 'Super Admin' || role === 'Admin';

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      include: [{ model: Group, as: 'groups', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json({ status: 'success', data: users });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error fetching users', ...safeError(error) });
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
    res.status(500).json({ status: 'error', message: 'Error fetching user', ...safeError(error) });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, groupIds } = req.body;
    // D20: new role must be strictly below the actor (Super Admin may
    // create any role, including Admin/Super Admin).
    const actorRole = req.user.role;
    if (role && rankOf(role) >= rankOf(actorRole) && actorRole !== 'Super Admin') {
      return res.status(403).json({ status: 'fail', message: `You cannot create a user with role ${role}` });
    }
    if (role && isAdminFamily(role) && actorRole !== 'Super Admin') {
      return res.status(403).json({ status: 'fail', message: 'Only Super Admin can create Admin/Super Admin users' });
    }
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
    res.status(400).json({ status: 'fail', message: 'Error creating user', ...safeError(error) });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ status: 'fail', message: 'User not found' });

    const { name, email, role, active, groupIds, password } = req.body;
    const actorRole = req.user.role;
    const targetRank = rankOf(user.role);
    const actorRank = rankOf(actorRole);
    // D20: cannot manage users at or above your own rank (except yourself
    // for own name/email only — role/active changes on self are denied).
    if (user.id !== req.user.id && targetRank >= actorRank) {
      return res.status(403).json({ status: 'fail', message: `You cannot manage a ${user.role} user` });
    }
    if (role && role !== user.role) {
      if (rankOf(role) >= actorRank && actorRole !== 'Super Admin') {
        return res.status(403).json({ status: 'fail', message: `You cannot promote anyone to ${role}` });
      }
      if (isAdminFamily(role) && actorRole !== 'Super Admin') {
        return res.status(403).json({ status: 'fail', message: 'Only Super Admin can promote to Admin/Super Admin' });
      }
    }
    if (user.id === req.user.id && (role && role !== user.role)) {
      return res.status(403).json({ status: 'fail', message: 'You cannot change your own role' });
    }
    const updates = { name, email, role, active };
    if (password) updates.password = password;
    // D24: role/active/password changes invalidate existing sessions.
    if ((role && role !== user.role) || (active !== undefined && active !== user.active) || password) {
      updates.passwordChangedAt = new Date();
    }
    await user.update(updates);
    
    if (groupIds) {
      await user.setGroups(groupIds);
    }
    
    const result = await User.findByPk(user.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: Group, as: 'groups', attributes: ['id', 'name'] }]
    });

    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: 'Error updating user', ...safeError(error) });
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

    // D20: strictly-lower only (OM cannot delete Admin/Super Admin, etc.).
    // D21: users with dependents are RESTRICTed — prefer toggle-status
    // (active=false). Hard delete allowed only with zero dependents; the DB
    // will refuse when constraints exist.
    if (rankOf(user.role) >= rankOf(req.user.role)) {
      return res.status(403).json({ status: 'fail', message: `You cannot delete a ${user.role} user` });
    }

    await user.destroy();
    res.status(200).json({ status: 'success', message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error deleting user', ...safeError(error) });
  }
};

exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ status: 'fail', message: 'User not found' });

    // D20/D24: same rank rule as delete; deactivation invalidates sessions.
    if (user.id !== req.user.id && rankOf(user.role) >= rankOf(req.user.role)) {
      return res.status(403).json({ status: 'fail', message: `You cannot change the status of a ${user.role} user` });
    }

    user.active = !user.active;
    user.passwordChangedAt = new Date();
    await user.save({ validate: false });

    res.status(200).json({ 
      status: 'success', 
      message: `User has been ${user.active ? 'activated' : 'blocked'}.` 
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error updating user status', ...safeError(error) });
  }
};
