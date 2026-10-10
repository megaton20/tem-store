const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// The actual sellable stock count for one product at one branch.
// Product.stock (on the Product model) is kept as a denormalized sum
// across all branches, purely for fast display on the storefront -
// this table is the source of truth used for every real deduction.
const BranchInventory = sequelize.define('BranchInventory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  branchId: { type: DataTypes.UUID, allowNull: false, field: 'branch_id' },
  productId: { type: DataTypes.UUID, allowNull: false, field: 'product_id' },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  lowStockThreshold: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10, field: 'low_stock_threshold' },
}, {
  tableName: 'branch_inventory',
  underscored: true,
  indexes: [{ unique: true, fields: ['branch_id', 'product_id'] }],
});

module.exports = BranchInventory;
