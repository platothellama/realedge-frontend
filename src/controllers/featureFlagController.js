const FeatureFlag = require('../models/featureFlag');
const { Op } = require('sequelize');

exports.getAllFeatureFlags = async (req, res) => {
  try {
    const flags = await FeatureFlag.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json({ status: 'success', data: flags });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

exports.createFeatureFlag = async (req, res) => {
  try {
    const { key, description, enabled, enabledForRoles } = req.body;
    const existing = await FeatureFlag.findOne({ where: { key } });
    if (existing) {
      return res.status(400).json({ status: 'fail', message: 'Feature key already exists' });
    }
    const flag = await FeatureFlag.create({ key, description, enabled, enabledForRoles });
    res.status(201).json({ status: 'success', data: flag });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

exports.updateFeatureFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const { key, description, enabled, enabledForRoles } = req.body;
    const flag = await FeatureFlag.findByPk(id);
    if (!flag) {
      return res.status(404).json({ status: 'fail', message: 'Feature flag not found' });
    }
    await flag.update({ key, description, enabled, enabledForRoles });
    res.status(200).json({ status: 'success', data: flag });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

exports.toggleFeatureFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const flag = await FeatureFlag.findByPk(id);
    if (!flag) {
      return res.status(404).json({ status: 'fail', message: 'Feature flag not found' });
    }
    flag.enabled = !flag.enabled;
    await flag.save();
    res.status(200).json({ status: 'success', data: flag });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

exports.deleteFeatureFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const flag = await FeatureFlag.findByPk(id);
    if (!flag) {
      return res.status(404).json({ status: 'fail', message: 'Feature flag not found' });
    }
    await flag.destroy();
    res.status(204).json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

exports.getEnabledFeatures = async (req, res) => {
  try {
    const flags = await FeatureFlag.findAll({
      where: { enabled: true }
    });
    const features = flags.reduce((acc, flag) => {
      acc[flag.key] = {
        enabled: flag.enabled,
        enabledForRoles: flag.enabledForRoles || []
      };
      return acc;
    }, {});
    res.status(200).json({ status: 'success', data: features });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};