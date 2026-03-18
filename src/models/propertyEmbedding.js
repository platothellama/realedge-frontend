const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PropertyEmbedding = sequelize.define('PropertyEmbedding', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  propertyId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true
  },
  embedding: {
    type: DataTypes.JSON,
    allowNull: false
  },
  textContent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  embeddingModel: {
    type: DataTypes.STRING,
    defaultValue: 'openai-ada-002'
  },
  dimensions: {
    type: DataTypes.INTEGER,
    defaultValue: 1536
  }
}, {
  timestamps: true
});

module.exports = PropertyEmbedding;
