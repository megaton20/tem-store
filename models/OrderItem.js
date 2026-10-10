const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  orderId: { type: DataTypes.UUID, allowNull: false, field: 'order_id' },
  productId: { type: DataTypes.UUID, allowNull: false, field: 'product_id' },
  // snapshots so historical orders stay accurate even if the product changes later
  productName: { type: DataTypes.STRING, allowNull: false, field: 'product_name' },
  unitPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: 'unit_price' },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  lineTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: 'line_total' },
}, {
  tableName: 'order_items',
  underscored: true,
});

module.exports = OrderItem;
