const { Notification, User } = require('../models/associations');

// Get all notifications for current user
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
};

// Get unread notification count
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.count({
      where: { userId: req.user.id, isRead: false }
    });
    res.status(200).json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching count', error: error.message });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    await notification.update({
      isRead: true,
      readAt: new Date()
    });

    res.status(200).json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Error marking notification', error: error.message });
  }
};

// Mark all as read
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.update(
      { isRead: true, readAt: new Date() },
      { where: { userId: req.user.id, isRead: false } }
    );

    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Error marking notifications', error: error.message });
  }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    await notification.destroy();
    res.status(200).json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting notification', error: error.message });
  }
};

// Create a notification (helper function for other controllers)
exports.createNotification = async (userId, title, message, type, link = null) => {
  try {
    return await Notification.create({
      userId,
      title,
      message,
      type,
      link
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};
