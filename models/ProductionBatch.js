const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// One row per production run. batchNumber is what you'd write on a
// production log/label, e.g. "SN-20260814-A" (product prefix + date + letter).
const ProductionBatch = sequelize.define('ProductionBatch', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  batchNumber: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'batch_number' },
  productId: { type: DataTypes.UUID, allowNull: false, field: 'product_id' },
  quantityProduced: { type: DataTypes.INTEGER, allowNull: false, field: 'quantity_produced' },
  producedAt: { type: DataTypes.DATEONLY, allowNull: false, field: 'produced_at' },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'production_batches',
  underscored: true,
});

module.exports = ProductionBatch;
