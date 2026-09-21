const { Order, OrderItem, Branch, User, Product } = require('../../models');
const { scopedBranchId } = require('../../middleware/staffAuth');
const inventoryService = require('../../services/inventoryService');
const paystack = require('../../services/paystack');
const emailService = require('../../services/emailService');
const loyaltyService = require('../../services/loyaltyService');

// Cancel only exists at 'paid' - once an order starts being packed/moved,
// it's too late to just call it off from the admin panel (a rider may
// already be en route, or the customer waiting at the counter). And which
// status comes after 'processing' depends entirely on how it's being
// fulfilled - a pickup order should never offer "out for delivery", and a
// home-delivery order should never offer "ready for pickup".
function getNextStatuses(order) {
  switch (order.status) {
    case 'paid':
      return ['processing', 'cancelled'];
    case 'processing':
      return order.deliveryMethod === 'home' ? ['out_for_delivery'] : ['ready_for_pickup'];
    case 'ready_for_pickup':
      return ['completed'];
    case 'out_for_delivery':
      return ['completed'];
    default:
      return [];
  }
}

async function listOrders(req, res) {
  const branchId = scopedBranchId(req.currentUser);
  const where = { source: 'online' };
  if (branchId) where.branchId = branchId;
  if (req.query.status) where.status = req.query.status;

  const orders = await Order.findAll({
    where,
    include: [Branch, User],
    order: [['createdAt', 'DESC']],
    limit: 100,
  });

  res.render('admin/orders/index', {
    title: 'Orders — Admin',
    layout: 'admin/layout',
    orders,
    statusFilter: req.query.status || '',
  });
}

async function showOrder(req, res) {
  const branchId = scopedBranchId(req.currentUser);
  const where = { id: req.params.id };
  if (branchId) where.branchId = branchId;

  const order = await Order.findOne({
    where,
    include: [OrderItem, Branch, User, { model: User, as: 'rider' }],
  });
  if (!order) return res.status(404).render('404', { layout: false });

  res.render('admin/orders/show', {
    title: `Order ${order.orderNumber} — Admin`,
    layout: 'admin/layout',
    order,
    nextStatuses: getNextStatuses(order),
  });
}

async function updateStatus(req, res) {
  const branchId = scopedBranchId(req.currentUser);
  const where = { id: req.params.id };
  if (branchId) where.branchId = branchId;

  const order = await Order.findOne({ where, include: [OrderItem] });
  if (!order) return res.status(404).render('404', { layout: false });

  const { status } = req.body;
  const allowed = getNextStatuses(order);
  if (!allowed.includes(status)) {
    req.session.flashError = `Can't move an order from "${order.status}" to "${status}".`;
    return res.redirect(`/admin/orders/${order.id}`);
  }

  // Marking an order "completed" from the admin panel is the same claim a
  // rider makes when they tap Complete on a delivery - that the item
  // actually reached the right person. A rider can only do that by
  // entering the customer's code; staff doing it from here go through the
  // exact same check, so nobody (including a super_admin) can just click
  // a button and close out an order with no proof it was ever handed over.
  if (status === 'completed') {
    const submittedCode = (req.body.confirmationCode || '').trim().toUpperCase();
    if (!order.deliveryConfirmationCode || submittedCode !== order.deliveryConfirmationCode) {
      req.session.flashError = 'Incorrect confirmation code - ask the customer to check their order page.';
      return res.redirect(`/admin/orders/${order.id}`);
    }
  }

  // Cancelling after stock was already deducted (anything past 'paid') puts it back.
  if (status === 'cancelled' && order.status !== 'pending_payment') {
    await inventoryService.reverseOrderFulfillment(order, order.OrderItems, req.currentUser.id);
  }

  // Every online order is paid via Paystack up front, so cancelling a paid
  // order always means refunding the customer - POS sales (cash/card at the
  // counter) are handled outside the system and aren't touched here.
  if (status === 'cancelled' && order.source === 'online' && order.paymentStatus === 'paid') {
    try {
      const refund = await paystack.refundTransaction(order.paymentReference);
      order.paymentStatus = 'refunded';
      order.refundReference = refund.data?.transaction_reference || order.paymentReference;
      order.refundedAt = new Date();
    } catch (err) {
      req.session.flashError = `Order cancelled and stock restored, but the automatic refund failed - please refund ${order.orderNumber} manually in your Paystack dashboard. (${err.message})`;
    }
  }

  order.status = status;
  await order.save();

  if (status === 'completed') {
    await loyaltyService.recordCompletedPurchase(order);
  }

  if (order.userId) {
    const customer = await User.findByPk(order.userId);
    if (customer) await emailService.sendOrderStatusUpdate(customer, order);
  }

  res.redirect(`/admin/orders/${order.id}`);
}

module.exports = { listOrders, showOrder, updateStatus };
