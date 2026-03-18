const { Announcement, User } = require('../models/associations');
const { Op } = require('sequelize');

exports.getAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.findAll({
      where: {
        isActive: true,
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gt]: new Date() } }
        ]
      },
      include: [
        { model: User, as: 'author', attributes: ['id', 'name', 'photo'] }
      ],
      order: [
        ['isPinned', 'DESC'],
        ['priority', 'DESC'],
        ['createdAt', 'DESC']
      ]
    });

    res.status(200).json(announcements);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching announcements', error: error.message });
  }
};

exports.createAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.create({
      ...req.body,
      createdByUserId: req.user.id
    });
    res.status(201).json(announcement);
  } catch (error) {
    res.status(400).json({ message: 'Error creating announcement', error: error.message });
  }
};

exports.updateAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) return res.status(404).json({ message: 'Announcement not found' });

    await announcement.update(req.body);
    res.status(200).json(announcement);
  } catch (error) {
    res.status(400).json({ message: 'Error updating announcement', error: error.message });
  }
};

exports.deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) return res.status(404).json({ message: 'Announcement not found' });

    await announcement.update({ isActive: false });
    res.status(200).json({ message: 'Announcement deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting announcement', error: error.message });
  }
};

exports.pinAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) return res.status(404).json({ message: 'Announcement not found' });

    await announcement.update({ isPinned: !announcement.isPinned });
    res.status(200).json(announcement);
  } catch (error) {
    res.status(400).json({ message: 'Error pinning announcement', error: error.message });
  }
};
