const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Application to become a POS/sales attendant at a branch. Mirrors
// RiderApplication's shape - same login-required, snapshot-identity
// pattern - just with fields relevant to counter/register work instead
// of delivery.
const PosApplication = sequelize.define('PosApplication', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
  fullName: { type: DataTypes.STRING, allowNull: false, field: 'full_name' },
  email: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: false },
  address: { type: DataTypes.STRING, allowNull: false },
  city: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Calabar' },
  state: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Cross River' },
  hasSmartphone: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'has_smartphone' },
  hasRetailExperience: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'has_retail_experience' },
  yearsExperience: { type: DataTypes.INTEGER, allowNull: true, field: 'years_experience' },
  preferredBranchId: { type: DataTypes.UUID, allowNull: true, field: 'preferred_branch_id' },
  notes: { type: DataTypes.TEXT, allowNull: true },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
  },
  reviewedByUserId: { type: DataTypes.UUID, allowNull: true, field: 'reviewed_by_user_id' },
}, {
  tableName: 'pos_applications',
  underscored: true,
});

module.exports = PosApplication;
