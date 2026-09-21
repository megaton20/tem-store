const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DiscountCode = sequelize.define('DiscountCode', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  code: { type: DataTypes.STRING, allowNull: false, unique: true },
  type: {
    type: DataTypes.ENUM('percent', 'flat'),
    allowNull: false,
    defaultValue: 'percent',
  },
  value: { type: DataTypes.DECIMAL(12, 2), allowNull: false }, // 10 for 10%, or a naira amount for flat
  minOrderAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'min_order_amount' },
  maxUses: { type: DataTypes.INTEGER, allowNull: true, field: 'max_uses' }, // null = unlimited
  usesCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'uses_count' },
  expiresAt: { type: DataTypes.DATE, allowNull: true, field: 'expires_at' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, {
  tableName: 'discount_codes',
  underscored: true,
});

module.exports = DiscountCode;
