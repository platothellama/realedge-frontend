const { Task, User, Notification } = require('../models/associations');
const { Op } = require('sequelize');

exports.getTasks = async (req, res) => {
  try {
    const { status, priority, assignedToUserId } = req.query;
    let where = {};

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assignedToUserId) where.assignedToUserId = assignedToUserId;

    const tasks = await Task.findAll({
      where,
      include: [
        { model: User, as: 'assignedTo', attributes: ['id', 'name', 'photo'] },
        { model: User, as: 'assignedBy', attributes: ['id', 'name'] }
      ],
      order: [
        ['priority', 'DESC'],
        ['dueDate', 'ASC'],
        ['createdAt', 'DESC']
      ]
    });

    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tasks', error: error.message });
  }
};

exports.getMyTasks = async (req, res) => {
  try {
    const tasks = await Task.findAll({
      where: {
        assignedToUserId: req.user.id,
        status: { [Op.ne]: 'completed' }
      },
      include: [
        { model: User, as: 'assignedBy', attributes: ['id', 'name'] }
      ],
      order: [
        ['priority', 'DESC'],
        ['dueDate', 'ASC']
      ]
    });

    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tasks', error: error.message });
  }
};

exports.createTask = async (req, res) => {
  try {
    const task = await Task.create({
      ...req.body,
      assignedByUserId: req.user.id
    });
    res.status(201).json(task);
  } catch (error) {
    res.status(400).json({ message: 'Error creating task', error: error.message });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id, {
      include: [
        { model: User, as: 'assignedTo', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'assignedBy', attributes: ['id', 'name'] }
      ]
    });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const oldStatus = task.status;

    if (req.body.status === 'completed' && task.status !== 'completed') {
      req.body.completedAt = new Date();
    }

    await task.update(req.body);

    if (req.body.status === 'review' && oldStatus !== 'review' && task.assignedToUserId) {
      await Notification.create({
        userId: task.assignedToUserId,
        title: 'Task Ready for Review',
        message: `Task "${task.title}" has been submitted for your review.`,
        type: 'system',
        link: '/tasks'
      });
    }

    if (req.body.status === 'completed' && oldStatus !== 'completed' && task.assignedByUserId) {
      await Notification.create({
        userId: task.assignedByUserId,
        title: 'Task Completed',
        message: `Task "${task.title}" has been completed.`,
        type: 'system',
        link: '/tasks'
      });
    }

    const updatedTask = await Task.findByPk(req.params.id, {
      include: [
        { model: User, as: 'assignedTo', attributes: ['id', 'name', 'photo'] },
        { model: User, as: 'assignedBy', attributes: ['id', 'name'] }
      ]
    });

    res.status(200).json(updatedTask);
  } catch (error) {
    res.status(400).json({ message: 'Error updating task', error: error.message });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    await task.destroy();
    res.status(200).json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting task', error: error.message });
  }
};

exports.getTaskStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const [total, completed, overdue, today] = await Promise.all([
      Task.count({ where: { assignedToUserId: userId } }),
      Task.count({ where: { assignedToUserId: userId, status: 'completed' } }),
      Task.count({ 
        where: { 
          assignedToUserId: userId, 
          status: { [Op.ne]: 'completed' },
          dueDate: { [Op.lt]: new Date() }
        } 
      }),
      Task.count({ 
        where: { 
          assignedToUserId: userId,
          dueDate: { 
            [Op.between]: [new Date().setHours(0,0,0,0), new Date().setHours(23,59,59,999)] 
          }
        } 
      })
    ]);

    res.status(200).json({
      total,
      completed,
      overdue,
      today,
      pending: total - completed
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching task stats', error: error.message });
  }
};
