const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Cart = sequelize.define('Cart', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // nullable: guest carts are tracked by sessionId until the user logs in
  userId: { type: DataTypes.UUID, allowNull: true, field: 'user_id' },
  sessionId: { type: DataTypes.STRING, allowNull: true, field: 'session_id' },
  status: {
    type: DataTypes.ENUM('active', 'converted', 'abandoned'),
    defaultValue: 'active',
  },
}, {
  tableName: 'carts',
  underscored: true,
});

module.exports = Cart;
