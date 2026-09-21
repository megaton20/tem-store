const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SubscriptionTier = sequelize.define('SubscriptionTier', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Vault Access' },
  durationMonths: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 6, field: 'duration_months' },
  price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  gracePeriodDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5, field: 'grace_period_days' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, {
  tableName: 'subscription_tiers',
  underscored: true,
});

module.exports = SubscriptionTier;
