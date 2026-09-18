const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Optional grouping for listings: apartments/units in the same
// building or development share one Project (e.g. "Marina Gate Tower").
// Property.projectId is nullable — standalone listings have NULL.
const Project = sequelize.define('Project', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { len: [1, 255] }
  },
  developer: {
    type: DataTypes.STRING,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true
  },
  country: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('Planned', 'Under Construction', 'Completed'),
    defaultValue: 'Completed'
  },
  coverImage: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Project;
