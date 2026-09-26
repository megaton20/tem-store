const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// The authoritative list of cities TEM Store actually operates in,
// controlled entirely by the super admin. This is what populates the
// city dropdown at registration, on the profile page, and on staff
// applications - distinct from DeliveryZone/CourierZone (which carry
// pricing for a specific service) because a place can be "somewhere we
// have a presence" before it's priced for home delivery or courier.
const OperatingLocation = sequelize.define('OperatingLocation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  state: { type: DataTypes.STRING, allowNull: false },
  city: { type: DataTypes.STRING, allowNull: false },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0, field: 'sort_order' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, {
  tableName: 'operating_locations',
  underscored: true,
  indexes: [{ unique: true, fields: ['state', 'city'] }],
});

module.exports = OperatingLocation;
