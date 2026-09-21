const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// A record of stock moving from one branch to another. This is a
// two-step handoff, not an instant move: a transfer sits 'pending' the
// moment the sending branch creates it, and the actual stock deduction
// (from the sender) and addition (to the receiver) only happen once the
// RECEIVING branch confirms it actually arrived - see
// services/inventoryService for where that adjustment happens.
//
// fromBranchId is nullable for a "new stock intake" - fresh production
// stock landing directly at a branch with no other branch's stock being
// reduced. Those complete immediately since there's nothing to confirm
// receipt of from another branch's countable inventory.
const StockTransfer = sequelize.define('StockTransfer', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  productId: { type: DataTypes.UUID, allowNull: false, field: 'product_id' },
  fromBranchId: { type: DataTypes.UUID, allowNull: true, field: 'from_branch_id' },
  toBranchId: { type: DataTypes.UUID, allowNull: false, field: 'to_branch_id' },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'cancelled'),
    defaultValue: 'pending',
  },
  notes: { type: DataTypes.TEXT, allowNull: true },
  initiatedByUserId: { type: DataTypes.UUID, allowNull: true, field: 'initiated_by_user_id' },
  receivedByUserId: { type: DataTypes.UUID, allowNull: true, field: 'received_by_user_id' },
  receivedAt: { type: DataTypes.DATE, allowNull: true, field: 'received_at' },
  cancelledByUserId: { type: DataTypes.UUID, allowNull: true, field: 'cancelled_by_user_id' },
}, {
  tableName: 'stock_transfers',
  underscored: true,
});

module.exports = StockTransfer;
