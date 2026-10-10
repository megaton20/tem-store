const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// tier controls how the category behaves in navigation:
// 'public'    -> shown in main nav, searchable, on homepage
// 'discreet'  -> reachable only via direct link, not in search/homepage grids
// 'exclusive' -> vault-only, requires active subscription, 404 otherwise
const Category = sequelize.define('Category', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: { type: DataTypes.STRING, allowNull: false },
  slug: { type: DataTypes.STRING, allowNull: false, unique: true },
  description: DataTypes.TEXT,
  tier: {
    type: DataTypes.ENUM('public', 'discreet', 'exclusive'),
    defaultValue: 'public',
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'sort_order',
  },
}, {
  tableName: 'categories',
  underscored: true,
});

module.exports = Category;
