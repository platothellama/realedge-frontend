const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Task = sequelize.define('Task', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium'
  },
  status: {
    type: DataTypes.ENUM('todo', 'in_progress', 'review', 'completed', 'cancelled'),
    defaultValue: 'todo'
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  assignedToUserId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  assignedByUserId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  relatedType: {
    type: DataTypes.ENUM('property', 'lead', 'deal', 'visit', 'general'),
    defaultValue: 'general'
  },
  relatedId: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Task;
