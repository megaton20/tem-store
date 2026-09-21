const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// A Branch is any physical TEM Store location: a customer-facing pickup
// kiosk, a warehouse/central stock holding point, or a production site.
// Inventory, staff accounts, and POS sales all key off branchId, so
// opening a new branch in another state is just: add a row here.
const Branch = sequelize.define('Branch', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: { type: DataTypes.STRING, allowNull: false },
  slug: { type: DataTypes.STRING, allowNull: false, unique: true },
  address: { type: DataTypes.STRING, allowNull: false },
  city: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Calabar' },
  state: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Cross River' },
  contactPhone: { type: DataTypes.STRING, field: 'contact_phone' },
  type: {
    type: DataTypes.ENUM('kiosk', 'warehouse', 'production'),
    defaultValue: 'kiosk',
  },
  // whether customers can select this branch for pickup at checkout
  isPickupEnabled: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_pickup_enabled' },
  // whether this branch can be auto-assigned to fulfill home-delivery orders
  isFulfillmentEnabled: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_fulfillment_enabled' },
  pickupFee: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0, field: 'pickup_fee' },
  operatingHours: { type: DataTypes.STRING, field: 'operating_hours', defaultValue: '9:00 AM - 7:00 PM' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, {
  tableName: 'branches',
  underscored: true,
});

module.exports = Branch;
