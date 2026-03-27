const User = require('../models/user');
const LoginLog = require('../models/loginLog');
const notificationController = require('./notificationController');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

const createSendToken = async (user, statusCode, req, res) => {
  const token = signToken(user.id);

  // Log the login
  await LoginLog.create({
    userId: user.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    status: 'Success'
  });

  // Update last login
  user.lastLogin = new Date();
  await user.save({ validate: false });

  // Create notification for login
  await notificationController.createNotification(
    user.id,
    'Welcome Back',
    `You logged in at ${new Date().toLocaleTimeString()}`,
    'login',
    null
  );

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        photo: user.photo
      }
    }
  });
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    // Prevent self-registration as Super Admin or Admin for security
    const restrictedRoles = ['Super Admin', 'Admin', 'Office Manager'];
    const assignedRole = restrictedRoles.includes(role) ? 'Agent' : role;

    const newUser = await User.create({
      name,
      email,
      password,
      role: assignedRole
    });

    createSendToken(newUser, 201, req, res);
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ status: 'fail', message: 'Please provide email and password' });
    }

    const user = await User.findOne({ where: { email, active: true } });

    if (!user || !(await user.comparePassword(password))) {
      // Log failed attempt
      if (user) {
        await LoginLog.create({
          userId: user.id,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          status: 'Failed',
          failureReason: 'Invalid password'
        });
      }
      return res.status(401).json({ status: 'fail', message: 'Incorrect email or password' });
    }

    createSendToken(user, 200, req, res);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const { googleId, email, name, photo } = req.body;
    
    let user = await User.findOne({ where: { email } });

    if (!user) {
      // Create new user via Google
      user = await User.create({
        name,
        email,
        googleId,
        photo,
        role: 'Agent'
      });
    } else {
      // Update existing user with Google ID if not present
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    }

    createSendToken(user, 200, req, res);
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ where: { email: req.body.email } });
    if (!user) {
      return res.status(404).json({ status: 'fail', message: 'There is no user with that email address.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 mins

    await user.save({ validate: false });

    // In production, send email here. For now, return token
    res.status(200).json({
      status: 'success',
      message: 'Token sent to email! (In dev, see token below)',
      token: resetToken
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.getLoginLogs = async (req, res) => {
  try {
    const logs = await LoginLog.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 20
    });
    res.status(200).json({ status: 'success', data: logs });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    res.status(200).json({ status: 'success', data: { user } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
