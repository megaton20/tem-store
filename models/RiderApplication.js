const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RiderApplication = sequelize.define('RiderApplication', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // Applications require a logged-in account (see riderApplicationController)
  // so identity is never taken on trust from a form - fullName/email/phone
  // below are just a snapshot of the account at the time they applied.
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
  fullName: { type: DataTypes.STRING, allowNull: false, field: 'full_name' },
  email: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: false },
  address: { type: DataTypes.STRING, allowNull: false },
  city: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Calabar' },
  state: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Cross River' },
  vehicleType: {
    type: DataTypes.ENUM('bicycle', 'motorcycle', 'car', 'none'),
    allowNull: false,
    field: 'vehicle_type',
  },
  hasValidId: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'has_valid_id' },
  hasSmartphone: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'has_smartphone' },
  yearsExperience: { type: DataTypes.INTEGER, allowNull: true, field: 'years_experience' },
  notes: { type: DataTypes.TEXT, allowNull: true },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
  },
  reviewedByUserId: { type: DataTypes.UUID, allowNull: true, field: 'reviewed_by_user_id' },
}, {
  tableName: 'rider_applications',
  underscored: true,
});

module.exports = RiderApplication;
