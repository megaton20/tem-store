const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Every single stock change, anywhere in the system, writes one row here.
// This is the record management can pull to see "all work" - who moved
// what, when, why, and what the running balance was at that branch after.
const InventoryLog = sequelize.define('InventoryLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  productId: { type: DataTypes.UUID, allowNull: false, field: 'product_id' },
  branchId: { type: DataTypes.UUID, allowNull: false, field: 'branch_id' },
  delta: { type: DataTypes.INTEGER, allowNull: false }, // positive = stock in, negative = stock out
  resultingQuantity: { type: DataTypes.INTEGER, allowNull: false, field: 'resulting_quantity' },
  reason: {
    type: DataTypes.ENUM('production', 'transfer_in', 'transfer_out', 'online_order', 'pos_sale', 'adjustment', 'order_cancelled'),
    allowNull: false,
  },
  referenceType: { type: DataTypes.STRING, allowNull: true, field: 'reference_type' }, // 'Order', 'StockTransfer', 'ProductionBatch', etc.
  referenceId: { type: DataTypes.UUID, allowNull: true, field: 'reference_id' },
  performedByUserId: { type: DataTypes.UUID, allowNull: true, field: 'performed_by_user_id' },
  note: { type: DataTypes.STRING, allowNull: true },
}, {
  tableName: 'inventory_logs',
  underscored: true,
});

module.exports = InventoryLog;
