const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Simple key/value store for app-wide toggles that don't need their own
// table - e.g. whether rider or POS applications are currently open.
const Setting = sequelize.define('Setting', {
  key: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
  value: { type: DataTypes.STRING, allowNull: true },
}, {
  tableName: 'settings',
  underscored: true,
  timestamps: true,
});

module.exports = Setting;
