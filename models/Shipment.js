const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// A Shipment is the unit logistics actually operates on - deliberately
// NOT the same thing as an Order. An order is a TEM Store sale; a
// shipment is "something that needs to physically get from A to B."
//
// Today every shipment comes from a TEM Store home-delivery order
// (source: 'tem_store', orderId set). But logistics is built to run as
// its own function: a future external client's shipment would have
// source: 'external' and no orderId at all, using externalClientName /
// externalReference instead. Riders, the dispatch queue, and status
// tracking all work the same way regardless of where a shipment came
// from - TEM Store's order system is just one source among possible others.
const Shipment = sequelize.define('Shipment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  source: {
    type: DataTypes.ENUM('tem_store', 'external'),
    allowNull: false,
    defaultValue: 'tem_store',
  },
  // Set when source is 'tem_store'. Null for external/future clients.
  orderId: { type: DataTypes.UUID, allowNull: true, field: 'order_id' },
  externalClientName: { type: DataTypes.STRING, allowNull: true, field: 'external_client_name' },
  externalReference: { type: DataTypes.STRING, allowNull: true, field: 'external_reference' },
  // Sender details - only meaningful for external bookings (a TEM Store
  // shipment's "sender" is TEM Store itself, so this stays null there).
  senderName: { type: DataTypes.STRING, allowNull: true, field: 'sender_name' },
  senderPhone: { type: DataTypes.STRING, allowNull: true, field: 'sender_phone' },

  // Pricing for a standalone courier job: flat fee by destination zone,
  // plus a surcharge if the package isn't negligible in size. TEM Store
  // order shipments don't use this - their delivery fee already lives on
  // the Order - so this stays 0/null for source: 'tem_store'.
  courierZoneId: { type: DataTypes.UUID, allowNull: true, field: 'courier_zone_id' },
  packageSize: {
    type: DataTypes.ENUM('negligible', 'medium', 'large'),
    allowNull: true,
    field: 'package_size',
  },
  fee: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  paymentStatus: {
    type: DataTypes.ENUM('pending', 'paid'),
    defaultValue: 'pending',
    field: 'payment_status',
  },
  paymentMethod: {
    type: DataTypes.ENUM('cash', 'transfer', 'pos_card'),
    allowNull: true,
    field: 'payment_method',
  },

  // Where it's picked up from and where it's going - copied in at creation
  // time so a shipment is self-contained and doesn't require joining back
  // to Order/User just to know an address.
  pickupBranchId: { type: DataTypes.UUID, allowNull: false, field: 'pickup_branch_id' },
  recipientName: { type: DataTypes.STRING, allowNull: false, field: 'recipient_name' },
  recipientPhone: { type: DataTypes.STRING, allowNull: false, field: 'recipient_phone' },
  deliveryAddress: { type: DataTypes.STRING, allowNull: false, field: 'delivery_address' },
  deliveryCity: { type: DataTypes.STRING, allowNull: false, field: 'delivery_city' },
  deliveryState: { type: DataTypes.STRING, allowNull: false, field: 'delivery_state' },

  // Plain-text summary of what's being carried, e.g. "2x Classic Chocolate
  // Chip, 1x Wireless Earbuds Pro" - built at creation time so a rider sees
  // exactly what they're carrying without needing order-line access.
  manifest: { type: DataTypes.TEXT, allowNull: false },

  status: {
    type: DataTypes.ENUM('awaiting_dispatch', 'assigned', 'out_for_delivery', 'delivered', 'failed', 'cancelled'),
    defaultValue: 'awaiting_dispatch',
  },
  assignedRiderId: { type: DataTypes.UUID, allowNull: true, field: 'assigned_rider_id' },
  assignedByUserId: { type: DataTypes.UUID, allowNull: true, field: 'assigned_by_user_id' },
  assignedAt: { type: DataTypes.DATE, allowNull: true, field: 'assigned_at' },
  dispatchedAt: { type: DataTypes.DATE, allowNull: true, field: 'dispatched_at' },
  deliveredAt: { type: DataTypes.DATE, allowNull: true, field: 'delivered_at' },

  // The code the recipient hands the rider to prove the delivery is theirs.
  confirmationCode: { type: DataTypes.STRING, allowNull: false, field: 'confirmation_code' },
  failureNote: { type: DataTypes.TEXT, allowNull: true, field: 'failure_note' },

  // What the rider earns for this delivery - a cut of the delivery fee
  // (TEM Store order) or courier fee (walk-in booking), computed at
  // shipment creation time via RIDER_PAYOUT_PERCENT.
  riderPayout: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'rider_payout' },
  payoutStatus: {
    type: DataTypes.ENUM('unpaid', 'paid'),
    defaultValue: 'unpaid',
    field: 'payout_status',
  },
}, {
  tableName: 'shipments',
  underscored: true,
});

module.exports = Shipment;
