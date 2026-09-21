const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: { type: DataTypes.STRING, allowNull: false },
  slug: { type: DataTypes.STRING, allowNull: false, unique: true },
  description: DataTypes.TEXT,
  price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  compareAtPrice: { type: DataTypes.DECIMAL(12, 2), field: 'compare_at_price' },
  imageUrl: { type: DataTypes.STRING, field: 'image_url' },
  gallery: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  stock: { type: DataTypes.INTEGER, defaultValue: 0 },
  // whether this appears in the hero / featured strip (used for Second Nature cookies)
  isFlagship: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_flagship' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  // mirrors category tier at product level so a query never needs a join to decide visibility
  visibilityTier: {
    type: DataTypes.ENUM('public', 'discreet', 'exclusive'),
    defaultValue: 'public',
    field: 'visibility_tier',
  },
  // 'in_house' = TEM Store's own stock, tracked in BranchInventory as normal.
  // 'third_party' = sourced on order from an outside supplier (e.g. Oriflame) -
  // not held in branch inventory, so it skips the branch stock check at
  // checkout and instead carries a lead time before it's ready.
  fulfillmentType: {
    type: DataTypes.ENUM('in_house', 'third_party'),
    defaultValue: 'in_house',
    field: 'fulfillment_type',
  },
  leadTimeDays: { type: DataTypes.INTEGER, defaultValue: 0, field: 'lead_time_days' },
  supplierName: { type: DataTypes.STRING, allowNull: true, field: 'supplier_name' },
}, {
  tableName: 'products',
  underscored: true,
});

module.exports = Product;
