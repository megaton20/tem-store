const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// One row per loyalty stage. Kept admin-configurable (not hardcoded)
// so the purchase thresholds and rewards can be tuned later without a
// code change - seeded with sensible starting numbers.
const LoyaltyTier = sequelize.define('LoyaltyTier', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  stageNumber: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: 'stage_number' },
  purchasesRequired: { type: DataTypes.INTEGER, allowNull: false, field: 'purchases_required' },
  rewardLabel: { type: DataTypes.STRING, allowNull: false, field: 'reward_label' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, {
  tableName: 'loyalty_tiers',
  underscored: true,
});

module.exports = LoyaltyTier;
