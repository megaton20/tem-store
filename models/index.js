const sequelize = require('../config/database');

const User = require('./User');
const Category = require('./Category');
const Product = require('./Product');
const Cart = require('./Cart');
const CartItem = require('./CartItem');
const Branch = require('./Branch');
const DeliveryZone = require('./DeliveryZone');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const SubscriptionTier = require('./SubscriptionTier');
const UserSubscription = require('./UserSubscription');
const ProductionBatch = require('./ProductionBatch');
const VerificationCode = require('./VerificationCode');
const BranchInventory = require('./BranchInventory');
const StockTransfer = require('./StockTransfer');
const InventoryLog = require('./InventoryLog');
const RiderApplication = require('./RiderApplication');
const PosApplication = require('./PosApplication');
const Setting = require('./Setting');
const LoyaltyTier = require('./LoyaltyTier');
const LoyaltyReward = require('./LoyaltyReward');
const TeamMember = require('./TeamMember');
const Shipment = require('./Shipment');
const CourierZone = require('./CourierZone');
const DiscountCode = require('./DiscountCode');

// ---- Associations ----

// categoryId isn't declared inside Product.js directly - Sequelize creates
// the FK column automatically from this association at sync time.
Category.hasMany(Product, { foreignKey: 'categoryId' });
Product.belongsTo(Category, { foreignKey: 'categoryId' });

User.hasMany(Cart, { foreignKey: 'userId' });
Cart.belongsTo(User, { foreignKey: 'userId' });

Cart.hasMany(CartItem, { foreignKey: 'cartId', onDelete: 'CASCADE' });
CartItem.belongsTo(Cart, { foreignKey: 'cartId' });

Product.hasMany(CartItem, { foreignKey: 'productId' });
CartItem.belongsTo(Product, { foreignKey: 'productId' });

User.hasMany(Order, { foreignKey: 'userId' });
Order.belongsTo(User, { foreignKey: 'userId' });

Branch.hasMany(Order, { foreignKey: 'branchId' });
Order.belongsTo(Branch, { foreignKey: 'branchId' });

Order.hasMany(OrderItem, { foreignKey: 'orderId', onDelete: 'CASCADE' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });

Product.hasMany(OrderItem, { foreignKey: 'productId' });
OrderItem.belongsTo(Product, { foreignKey: 'productId' });

SubscriptionTier.hasMany(UserSubscription, { foreignKey: 'tierId' });
UserSubscription.belongsTo(SubscriptionTier, { foreignKey: 'tierId' });

User.hasMany(UserSubscription, { foreignKey: 'userId' });
UserSubscription.belongsTo(User, { foreignKey: 'userId' });

Product.hasMany(ProductionBatch, { foreignKey: 'productId' });
ProductionBatch.belongsTo(Product, { foreignKey: 'productId' });

ProductionBatch.hasMany(VerificationCode, { foreignKey: 'batchId', onDelete: 'CASCADE' });
VerificationCode.belongsTo(ProductionBatch, { foreignKey: 'batchId' });

Product.hasMany(VerificationCode, { foreignKey: 'productId' });
VerificationCode.belongsTo(Product, { foreignKey: 'productId' });

// ---- Staff / branch assignment ----
Branch.hasMany(User, { foreignKey: 'branchId', as: 'staff' });
User.belongsTo(Branch, { foreignKey: 'branchId', as: 'branch' });

// ---- POS: who rang up a walk-in sale ----
User.hasMany(Order, { foreignKey: 'soldByStaffId', as: 'posSales' });
Order.belongsTo(User, { foreignKey: 'soldByStaffId', as: 'soldByStaff' });

// ---- Logistics: which rider is fulfilling a home-delivery order ----
User.hasMany(Order, { foreignKey: 'assignedRiderId', as: 'riderDeliveries' });
Order.belongsTo(User, { foreignKey: 'assignedRiderId', as: 'rider' });

// ---- Per-branch inventory ----
Branch.hasMany(BranchInventory, { foreignKey: 'branchId' });
BranchInventory.belongsTo(Branch, { foreignKey: 'branchId' });

Product.hasMany(BranchInventory, { foreignKey: 'productId' });
BranchInventory.belongsTo(Product, { foreignKey: 'productId' });

// ---- Stock transfers between branches ----
Product.hasMany(StockTransfer, { foreignKey: 'productId' });
StockTransfer.belongsTo(Product, { foreignKey: 'productId' });

Branch.hasMany(StockTransfer, { foreignKey: 'fromBranchId', as: 'transfersOut' });
StockTransfer.belongsTo(Branch, { foreignKey: 'fromBranchId', as: 'fromBranch' });

Branch.hasMany(StockTransfer, { foreignKey: 'toBranchId', as: 'transfersIn' });
StockTransfer.belongsTo(Branch, { foreignKey: 'toBranchId', as: 'toBranch' });

User.hasMany(StockTransfer, { foreignKey: 'initiatedByUserId' });
StockTransfer.belongsTo(User, { foreignKey: 'initiatedByUserId', as: 'initiatedBy' });

User.hasMany(StockTransfer, { foreignKey: 'receivedByUserId' });
StockTransfer.belongsTo(User, { foreignKey: 'receivedByUserId', as: 'receivedBy' });

// ---- Inventory audit log ----
Product.hasMany(InventoryLog, { foreignKey: 'productId' });
InventoryLog.belongsTo(Product, { foreignKey: 'productId' });

Branch.hasMany(InventoryLog, { foreignKey: 'branchId' });
InventoryLog.belongsTo(Branch, { foreignKey: 'branchId' });

User.hasMany(InventoryLog, { foreignKey: 'performedByUserId' });
InventoryLog.belongsTo(User, { foreignKey: 'performedByUserId' });

User.hasMany(RiderApplication, { foreignKey: 'reviewedByUserId' });
RiderApplication.belongsTo(User, { foreignKey: 'reviewedByUserId' });

User.hasMany(RiderApplication, { foreignKey: 'userId', as: 'riderApplications' });
RiderApplication.belongsTo(User, { foreignKey: 'userId', as: 'applicant' });

User.hasMany(PosApplication, { foreignKey: 'reviewedByUserId' });
PosApplication.belongsTo(User, { foreignKey: 'reviewedByUserId' });

User.hasMany(PosApplication, { foreignKey: 'userId', as: 'posApplications' });
PosApplication.belongsTo(User, { foreignKey: 'userId', as: 'applicant' });

Branch.hasMany(PosApplication, { foreignKey: 'preferredBranchId' });
PosApplication.belongsTo(Branch, { foreignKey: 'preferredBranchId', as: 'preferredBranch' });

// ---- Loyalty program ----
User.hasMany(LoyaltyReward, { foreignKey: 'userId' });
LoyaltyReward.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(LoyaltyReward, { foreignKey: 'redeemedByUserId' });
LoyaltyReward.belongsTo(User, { foreignKey: 'redeemedByUserId', as: 'redeemedBy' });

LoyaltyTier.hasMany(LoyaltyReward, { foreignKey: 'tierId' });
LoyaltyReward.belongsTo(LoyaltyTier, { foreignKey: 'tierId' });

// ---- Logistics domain: Shipment is loosely coupled to Order (nullable FK) -
// this is the "communication" boundary that lets logistics run as its own
// function while still fulfilling TEM Store orders today.
Order.hasOne(Shipment, { foreignKey: 'orderId' });
Shipment.belongsTo(Order, { foreignKey: 'orderId' });

Branch.hasMany(Shipment, { foreignKey: 'pickupBranchId' });
Shipment.belongsTo(Branch, { foreignKey: 'pickupBranchId', as: 'pickupBranch' });

User.hasMany(Shipment, { foreignKey: 'assignedRiderId', as: 'shipments' });
Shipment.belongsTo(User, { foreignKey: 'assignedRiderId', as: 'rider' });

User.hasMany(Shipment, { foreignKey: 'assignedByUserId' });
Shipment.belongsTo(User, { foreignKey: 'assignedByUserId', as: 'assignedBy' });

CourierZone.hasMany(Shipment, { foreignKey: 'courierZoneId' });
Shipment.belongsTo(CourierZone, { foreignKey: 'courierZoneId' });

module.exports = {
  sequelize,
  User,
  Category,
  Product,
  Cart,
  CartItem,
  Branch,
  DeliveryZone,
  Order,
  OrderItem,
  SubscriptionTier,
  UserSubscription,
  ProductionBatch,
  VerificationCode,
  BranchInventory,
  StockTransfer,
  InventoryLog,
  RiderApplication,
  PosApplication,
  Setting,
  LoyaltyTier,
  LoyaltyReward,
  TeamMember,
  Shipment,
  CourierZone,
  DiscountCode,
};
