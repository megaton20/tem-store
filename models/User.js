const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'full_name',
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'password_hash',
  },
  address: DataTypes.STRING,
  city: DataTypes.STRING,
  state: {
    type: DataTypes.STRING,
    defaultValue: 'Cross River',
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_verified',
  },
  // Set at registration, cleared once verified. Verification is currently
  // soft (not enforced at checkout/login) - see README for how to make it required.
  verificationToken: { type: DataTypes.STRING, allowNull: true, field: 'verification_token' },
  // 'customer' is the default for everyone who signs up on the storefront.
  // Staff roles are assigned by a super_admin via /admin/staff, never by self-registration.
  role: {
    type: DataTypes.ENUM('customer', 'super_admin', 'branch_manager', 'inventory_staff', 'sales_pos', 'logistics', 'rider'),
    defaultValue: 'customer',
  },
  // Which branch this staff member works at. Null for customers and for
  // super_admin (who isn't scoped to one branch). Every other staff role
  // requires a branchId - enforced in the admin staff form, not the DB,
  // so it stays easy to reassign someone to a different branch later.
  branchId: { type: DataTypes.UUID, allowNull: true, field: 'branch_id' },
  isActiveStaff: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active_staff' },
  // Counts completed purchases toward the loyalty program - incremented
  // once per order the moment it reaches 'completed', never before (a
  // paid-but-not-yet-delivered order doesn't count yet).
  loyaltyPurchaseCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'loyalty_purchase_count' },
}, {
  tableName: 'users',
  underscored: true,
});

module.exports = User;
