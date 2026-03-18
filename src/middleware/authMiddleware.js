const jwt = require('jsonwebtoken');
const User = require('../models/user');

exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ status: 'fail', message: 'You are not logged in' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUser = await User.findByPk(decoded.id);

    if (!currentUser) {
      return res.status(401).json({ status: 'fail', message: 'The user belonging to this token no longer exists.' });
    }

    // Attach full user object with role
    req.user = {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      role: currentUser.role,
      photo: currentUser.photo
    };
    next();
  } catch (error) {
    res.status(401).json({ status: 'fail', message: 'Authentication failed. Please log in again.' });
  }
};

/**
 * Restrict access based on user roles
 * @param  {...string} roles - Allowed roles (e.g., 'Admin', 'Super Admin')
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'fail',
        message: `Permission Denied: Your role (${req.user.role}) does not have access to this resource.`
      });
    }
    next();
  };
};

/**
 * Advanced Permissions Logic
 * We can define hierarchies or specific permission keys here later
 */
exports.canManageUsers = (req, res, next) => {
  const allowed = ['Super Admin', 'Admin', 'Office Manager'];
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ status: 'fail', message: 'Insufficient permissions to manage users.' });
  }
  next();
};

exports.canManageFinance = (req, res, next) => {
  const allowed = ['Super Admin', 'Admin', 'Accountant'];
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ status: 'fail', message: 'Only Accountants and Admins can access financial records.' });
  }
  next();
};
