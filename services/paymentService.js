const { Order, OrderItem, CartItem, Cart, User, SubscriptionTier, UserSubscription } = require('../models');
const inventoryService = require('./inventoryService');
const emailService = require('./emailService');

/**
 * Confirms a TEM Store order payment by reference. Idempotent - safe to
 * call twice (once from the customer's browser redirect, once from the
 * webhook, in either order) because it checks paymentStatus before doing
 * anything. This is what makes the webhook a true safety net rather than
 * a duplicate-processing risk.
 */
async function confirmOrderPayment(reference) {
  const order = await Order.findOne({ where: { paymentReference: reference } });
  if (!order) return null;
  if (order.paymentStatus === 'paid') return order; // already handled - nothing to do

  order.status = 'paid';
  order.paymentStatus = 'paid';
  order.paidAt = new Date();
  await order.save();

  const orderItems = await OrderItem.findAll({ where: { orderId: order.id } });
  try {
    await inventoryService.fulfillOrder(order, orderItems, null);
  } catch (stockErr) {
    order.status = 'processing';
    await order.save();
  }

  // clear the buyer's active cart now that the order is confirmed - not
  // session-scoped, so this works the same whether triggered by a redirect
  // (customer's browser present) or a webhook (no session at all)
  if (order.userId) {
    const cart = await Cart.findOne({ where: { userId: order.userId, status: 'active' } });
    if (cart) await CartItem.destroy({ where: { cartId: cart.id } });

    const user = await User.findByPk(order.userId);
    if (user) await emailService.sendOrderConfirmation(user, order, orderItems);
  }

  return order;
}

/**
 * Confirms a vault subscription payment by reference. Same idempotency
 * guarantee as confirmOrderPayment.
 */
async function confirmVaultPayment(reference, metadata) {
  const existing = await UserSubscription.findOne({ where: { paymentReference: reference } });
  if (existing) return existing; // already handled

  const tierId = metadata?.tierId;
  const userId = metadata?.userId;
  if (!tierId || !userId) return null;

  const tier = await SubscriptionTier.findByPk(tierId);
  if (!tier) return null;

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + tier.durationMonths);
  const graceEndsAt = new Date(expiresAt);
  graceEndsAt.setDate(graceEndsAt.getDate() + tier.gracePeriodDays);

  return UserSubscription.create({
    userId,
    tierId: tier.id,
    startedAt: now,
    expiresAt,
    graceEndsAt,
    status: 'active',
    paymentReference: reference,
  });
}

module.exports = { confirmOrderPayment, confirmVaultPayment };
