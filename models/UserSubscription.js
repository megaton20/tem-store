const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserSubscription = sequelize.define('UserSubscription', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
  tierId: { type: DataTypes.UUID, allowNull: false, field: 'tier_id' },
  startedAt: { type: DataTypes.DATE, allowNull: false, field: 'started_at' },
  expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
  graceEndsAt: { type: DataTypes.DATE, allowNull: false, field: 'grace_ends_at' },
  status: {
    type: DataTypes.ENUM('active', 'grace', 'expired', 'cancelled'),
    defaultValue: 'active',
  },
  paymentReference: { type: DataTypes.STRING, field: 'payment_reference' },
  reminderSentAt: { type: DataTypes.DATE, allowNull: true, field: 'reminder_sent_at' },
}, {
  tableName: 'user_subscriptions',
  underscored: true,
});

module.exports = UserSubscription;
