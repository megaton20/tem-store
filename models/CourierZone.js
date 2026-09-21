const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// A flat-fee destination for standalone courier jobs (walk-in deliveries
// that aren't tied to a TEM Store order). Distinct from DeliveryZone,
// which prices home delivery for online product orders - courier pricing
// is its own thing since it's sold as a service, not bundled into a sale.
const CourierZone = sequelize.define('CourierZone', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: { type: DataTypes.STRING, allowNull: false }, // e.g. "Calabar Municipality", "Uyo"
  city: { type: DataTypes.STRING, allowNull: false },
  state: { type: DataTypes.STRING, allowNull: false },
  // Base fee covers a negligible-size package (documents, small envelopes,
  // anything that doesn't meaningfully add bulk/weight).
  baseFee: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: 'base_fee' },
  mediumSurcharge: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'medium_surcharge' },
  largeSurcharge: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'large_surcharge' },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0, field: 'sort_order' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, {
  tableName: 'courier_zones',
  underscored: true,
});

module.exports = CourierZone;
