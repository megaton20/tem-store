const { sequelize, Order, OrderItem, Shipment, CourierZone, User } = require('../models');
const { generateDeliveryConfirmationCode } = require('../utils/codeGenerator');
const emailService = require('./emailService');
const loyaltyService = require('./loyaltyService');

/**
 * Flat fee by destination zone, plus a surcharge if the package isn't
 * negligible in size. Negligible packages (documents, small envelopes)
 * are covered entirely by the zone's base fee.
 */
function computeCourierFee(zone, packageSize) {
  const base = Number(zone.baseFee);
  if (packageSize === 'large') return base + Number(zone.largeSurcharge);
  if (packageSize === 'medium') return base + Number(zone.mediumSurcharge);
  return base;
}

// A rider's cut of the delivery/courier fee for a shipment. Percentage is
// configurable via RIDER_PAYOUT_PERCENT so it can change without a code edit.
function computeRiderPayout(feeAmount) {
  const percent = Number(process.env.RIDER_PAYOUT_PERCENT || 60);
  return Number(feeAmount) * (percent / 100);
}

/**
 * Books a standalone courier job - a walk-in or phoned-in delivery that
 * has nothing to do with a TEM Store product order. This is the entry
 * point that actually makes "logistics as a separate business" real:
 * it creates a Shipment with no Order behind it at all.
 */
async function createExternalShipment(data, staffUserId) {
  const zone = await CourierZone.findByPk(data.courierZoneId);
  if (!zone) throw new Error('Please select a valid destination.');

  const fee = computeCourierFee(zone, data.packageSize);

  return Shipment.create({
    source: 'external',
    externalClientName: data.senderName,
    pickupBranchId: data.pickupBranchId,
    senderName: data.senderName,
    senderPhone: data.senderPhone,
    recipientName: data.recipientName,
    recipientPhone: data.recipientPhone,
    deliveryAddress: data.deliveryAddress,
    deliveryCity: zone.city,
    deliveryState: zone.state,
    manifest: data.description,
    courierZoneId: zone.id,
    packageSize: data.packageSize,
    fee,
    riderPayout: computeRiderPayout(fee),
    paymentStatus: data.paymentReceived ? 'paid' : 'pending',
    paymentMethod: data.paymentMethod || null,
    status: 'awaiting_dispatch',
    confirmationCode: generateDeliveryConfirmationCode(),
    assignedByUserId: staffUserId,
  });
}

/**
 * Turns a paid/processing TEM Store home-delivery order into a shipment -
 * the moment logistics actually starts caring about it. Called by branch
 * staff ("inventory managers") once an order is packed and ready to leave
 * the branch. Builds a plain-text manifest from the order's line items so
 * a rider can see exactly what they're carrying without needing access to
 * order internals.
 */
async function createShipmentFromOrder(order, performedByUserId) {
  const existing = await Shipment.findOne({ where: { orderId: order.id } });
  if (existing) return existing; // idempotent - don't double-create on a double click

  const { User } = require('../models');
  const [items, customer] = await Promise.all([
    OrderItem.findAll({ where: { orderId: order.id } }),
    order.userId ? User.findByPk(order.userId) : null,
  ]);
  const manifest = items.map((i) => `${i.quantity}x ${i.productName}`).join(', ');

  return Shipment.create({
    source: 'tem_store',
    orderId: order.id,
    pickupBranchId: order.branchId,
    recipientName: customer ? customer.fullName : (order.walkInCustomerName || 'TEM Store Customer'),
    recipientPhone: order.deliveryPhone,
    deliveryAddress: order.deliveryAddress,
    deliveryCity: order.deliveryCity,
    deliveryState: order.deliveryState,
    manifest,
    riderPayout: computeRiderPayout(order.deliveryFee),
    status: 'awaiting_dispatch',
    confirmationCode: order.deliveryConfirmationCode,
  });
}

/**
 * Assigns (or reassigns) a rider to a shipment. Available to logistics HOD
 * (any branch) and to branch-scoped staff (their own branch's shipments
 * only - enforced by the caller, not here).
 */
async function assignRider(shipment, riderId, assignedByUserId) {
  shipment.assignedRiderId = riderId;
  shipment.assignedByUserId = assignedByUserId;
  shipment.assignedAt = new Date();
  if (shipment.status === 'awaiting_dispatch') shipment.status = 'assigned';
  await shipment.save();

  // Keep the Order's own rider fields in sync purely for the customer-facing
  // order page, which reads directly off Order rather than joining Shipment.
  if (shipment.orderId) {
    const order = await Order.findByPk(shipment.orderId);
    if (order) {
      order.assignedRiderId = riderId;
      await order.save();
    }
  }

  const rider = await User.findByPk(riderId);
  if (rider) await emailService.sendRiderAssignment(rider, shipment);

  return shipment;
}

async function startDelivery(shipment) {
  shipment.status = 'out_for_delivery';
  shipment.dispatchedAt = new Date();
  await shipment.save();

  if (shipment.orderId) {
    const order = await Order.findByPk(shipment.orderId);
    if (order) {
      order.status = 'out_for_delivery';
      await order.save();
    }
  }
  return shipment;
}

async function completeDelivery(shipment) {
  shipment.status = 'delivered';
  shipment.deliveredAt = new Date();
  await shipment.save();

  if (shipment.orderId) {
    const order = await Order.findByPk(shipment.orderId);
    if (order) {
      order.status = 'completed';
      await order.save();
      await loyaltyService.recordCompletedPurchase(order);
    }
  }
  return shipment;
}

module.exports = { createShipmentFromOrder, createExternalShipment, computeCourierFee, computeRiderPayout, assignRider, startDelivery, completeDelivery };
