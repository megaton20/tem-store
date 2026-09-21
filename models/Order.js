const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  orderNumber: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'order_number' },
  // nullable: POS walk-in sales may not have a registered account
  userId: { type: DataTypes.UUID, allowNull: true, field: 'user_id' },

  // 'online' = placed through the website/checkout. 'pos' = walk-in sale rung up at a branch.
  source: {
    type: DataTypes.ENUM('online', 'pos'),
    allowNull: false,
    defaultValue: 'online',
  },
  // For online orders: the branch fulfilling it (pickup branch, or the
  // branch auto-assigned to fulfill a home delivery). For POS orders:
  // the branch where the sale physically happened - always required there.
  branchId: { type: DataTypes.UUID, allowNull: true, field: 'branch_id' },
  // Staff member who rang up a POS sale. Null for online orders.
  soldByStaffId: { type: DataTypes.UUID, allowNull: true, field: 'sold_by_staff_id' },
  // Rider assigned to fulfill a home-delivery order.
  assignedRiderId: { type: DataTypes.UUID, allowNull: true, field: 'assigned_rider_id' },
  // A short code shown to the customer on their order page. The rider asks
  // for it at the doorstep and enters it to mark the order complete - this
  // is how the customer "proves" the order is theirs before a rider can
  // close it out, rather than a rider marking things complete unchecked.
  deliveryConfirmationCode: { type: DataTypes.STRING, allowNull: true, field: 'delivery_confirmation_code' },
  // Walk-in customers without an account - captured for the receipt only.
  walkInCustomerName: { type: DataTypes.STRING, allowNull: true, field: 'walk_in_customer_name' },
  walkInCustomerPhone: { type: DataTypes.STRING, allowNull: true, field: 'walk_in_customer_phone' },

  deliveryMethod: {
    type: DataTypes.ENUM('pickup', 'home', 'walk_in'),
    allowNull: false,
    field: 'delivery_method',
  },
  deliveryAddress: { type: DataTypes.STRING, allowNull: true, field: 'delivery_address' },
  deliveryCity: { type: DataTypes.STRING, allowNull: true, field: 'delivery_city' },
  deliveryState: { type: DataTypes.STRING, allowNull: true, field: 'delivery_state' },
  deliveryPhone: { type: DataTypes.STRING, allowNull: true, field: 'delivery_phone' },

  subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  deliveryFee: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'delivery_fee' },
  discountCode: { type: DataTypes.STRING, allowNull: true, field: 'discount_code' },
  discountAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'discount_amount' },
  total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },

  status: {
    type: DataTypes.ENUM('pending_payment', 'paid', 'processing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled'),
    defaultValue: 'pending_payment',
  },
  paymentStatus: {
    type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
    defaultValue: 'pending',
    field: 'payment_status',
  },
  refundReference: { type: DataTypes.STRING, allowNull: true, field: 'refund_reference' },
  refundedAt: { type: DataTypes.DATE, allowNull: true, field: 'refunded_at' },
  // Guards against double-counting loyalty progress - an order could
  // theoretically hit 'completed' from more than one code path (admin
  // panel, rider flow), so this ensures the purchase only counts once.
  loyaltyAwarded: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'loyalty_awarded' },
  // Latest date the order is expected to be ready, driven by the longest
  // lead time among its line items (third-party products like Oriflame
  // can take days to arrive before an order is ready for pickup/delivery).
  expectedReadyAt: { type: DataTypes.DATEONLY, allowNull: true, field: 'expected_ready_at' },
  paymentMethod: {
    type: DataTypes.ENUM('paystack', 'cash', 'pos_card', 'pos_transfer'),
    defaultValue: 'paystack',
    field: 'payment_method',
  },
  paymentReference: { type: DataTypes.STRING, allowNull: true, unique: true, field: 'payment_reference' },
  paidAt: { type: DataTypes.DATE, allowNull: true, field: 'paid_at' },
}, {
  tableName: 'orders',
  underscored: true,
});

module.exports = Order;
