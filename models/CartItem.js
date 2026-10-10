const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CartItem = sequelize.define('CartItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  cartId: { type: DataTypes.UUID, allowNull: false, field: 'cart_id' },
  productId: { type: DataTypes.UUID, allowNull: false, field: 'product_id' },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  // snapshot of price at time of adding, so cart total doesn't silently change if price is edited later
  unitPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: 'unit_price' },
}, {
  tableName: 'cart_items',
  underscored: true,
});

module.exports = CartItem;
