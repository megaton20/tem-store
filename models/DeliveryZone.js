const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// One row per CITY/LGA we deliver product orders to - not one flat rate
// per state. A state like Cross River has many LGAs with very different
// distances from a branch, so pricing (and whether we even deliver there
// yet) is set per city. Checkout only ever offers cities that exist here,
// never free text, so a customer can't select somewhere we don't cover.
const DeliveryZone = sequelize.define('DeliveryZone', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  state: { type: DataTypes.STRING, allowNull: false },
  city: { type: DataTypes.STRING, allowNull: false },
  fee: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  estimatedDays: { type: DataTypes.STRING, field: 'estimated_days', defaultValue: '1-2 days' },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0, field: 'sort_order' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, {
  tableName: 'delivery_zones',
  underscored: true,
  indexes: [{ unique: true, fields: ['state', 'city'] }],
});

module.exports = DeliveryZone;
