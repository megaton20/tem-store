const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// A reward a customer has actually earned by hitting a stage's purchase
// threshold. Redeeming it in person (at a kiosk or on delivery) uses a
// single-use code, the same pattern as product verification codes -
// staff enters it, it's marked redeemed, and can never be used again.
const LoyaltyReward = sequelize.define('LoyaltyReward', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
  tierId: { type: DataTypes.UUID, allowNull: false, field: 'tier_id' },
  redemptionCode: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'redemption_code' },
  status: {
    type: DataTypes.ENUM('earned', 'redeemed'),
    defaultValue: 'earned',
  },
  earnedAt: { type: DataTypes.DATE, allowNull: false, field: 'earned_at' },
  redeemedAt: { type: DataTypes.DATE, allowNull: true, field: 'redeemed_at' },
  redeemedByUserId: { type: DataTypes.UUID, allowNull: true, field: 'redeemed_by_user_id' },
}, {
  tableName: 'loyalty_rewards',
  underscored: true,
});

module.exports = LoyaltyReward;
