const { Order, OrderItem, Branch, DeliveryZone, Product, DiscountCode } = require('../models');
const { getCartWithItems } = require('../services/cartService');
const { generateOrderNumber } = require('../utils/orderNumber');
const { generateDeliveryConfirmationCode } = require('../utils/codeGenerator');
const paystack = require('../services/paystack');
const inventoryService = require('../services/inventoryService');
const paymentService = require('../services/paymentService');

// Shapes DeliveryZone rows into { state: [{ city, fee, estimatedDays }] }
// for the checkout page's cascading state -> city dropdown.
function groupZonesByState(zones) {
  const grouped = {};
  zones.forEach((z) => {
    if (!grouped[z.state]) grouped[z.state] = [];
    grouped[z.state].push({ city: z.city, fee: Number(z.fee), estimatedDays: z.estimatedDays });
  });
  return grouped;
}

async function showCheckout(req, res) {
  const { items, subtotal } = await getCartWithItems(req);
  if (!items.length) return res.redirect('/cart');

  const [branches, deliveryZones] = await Promise.all([
    Branch.findAll({ where: { isActive: true }, order: [['city', 'ASC']] }),
    DeliveryZone.findAll({ where: { isActive: true }, order: [['state', 'ASC'], ['sortOrder', 'ASC'], ['city', 'ASC']] }),
  ]);

  res.render('checkout', {
    title: 'Checkout — TEM Store',
    items,
    subtotal,
    branches,
    deliveryZones,
    zonesByState: groupZonesByState(deliveryZones),
    user: req.currentUser,
    error: null,
  });
}

// Creates the order (pending payment) then redirects the customer to Paystack.
async function initiateCheckout(req, res) {
  const { items, subtotal } = await getCartWithItems(req);
  if (!items.length) return res.redirect('/cart');

  const { deliveryMethod, branchId, deliveryAddress, deliveryCity, deliveryState, deliveryPhone } = req.body;

  let deliveryFee = 0;
  let resolvedBranchId = null;
  let resolvedAddress = null;
  let resolvedCity = null;
  let resolvedState = null;

  const cartItemsForStock = items
    .filter((i) => i.Product.fulfillmentType !== 'third_party')
    .map((i) => ({ productId: i.productId, quantity: i.quantity }));

  const thirdPartyItems = items.filter((i) => i.Product.fulfillmentType === 'third_party');
  const maxLeadDays = thirdPartyItems.length
    ? Math.max(...thirdPartyItems.map((i) => i.Product.leadTimeDays || 7))
    : 0;
  const expectedReadyAt = maxLeadDays > 0
    ? new Date(Date.now() + maxLeadDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : null;

  if (deliveryMethod === 'pickup') {
    const location = await Branch.findOne({ where: { id: branchId, isActive: true, isPickupEnabled: true } });
    if (!location) {
      return renderCheckoutError(req, res, 'Please choose a valid pickup location.');
    }
    const canFulfill = await inventoryService.branchCanFulfill(location.id, cartItemsForStock);
    if (!canFulfill) {
      return renderCheckoutError(req, res, `${location.name} doesn't have enough stock for everything in your cart right now. Try a different pickup location, or home delivery.`);
    }
    deliveryFee = Number(location.pickupFee) || 0;
    resolvedBranchId = location.id;
  } else if (deliveryMethod === 'home') {
    if (!deliveryAddress || !deliveryCity || !deliveryState || !deliveryPhone) {
      return renderCheckoutError(req, res, 'Please fill in your full delivery address and select your city.');
    }
    // City must be an exact match against a zone we actually service -
    // the checkout form only ever offers cities from this table, never
    // free text, so this should only fail if the form was tampered with.
    const zone = await DeliveryZone.findOne({ where: { state: deliveryState, city: deliveryCity, isActive: true } });
    if (!zone) {
      return renderCheckoutError(req, res, `Sorry, we don't currently deliver to ${deliveryCity}, ${deliveryState}. Try pickup instead, or check back as we expand.`);
    }

    // THE ALGORITHM: pick the branch best positioned to fulfill this order -
    // same city first, then same state, then anywhere active.
    const fulfillingBranch = await inventoryService.findFulfillingBranch(cartItemsForStock, deliveryState, deliveryCity);
    if (!fulfillingBranch) {
      return renderCheckoutError(req, res, "We don't have enough combined stock across our branches to fulfill this order right now. Try reducing quantities, or check back soon.");
    }

    deliveryFee = Number(zone.fee);
    resolvedBranchId = fulfillingBranch.id;
    resolvedAddress = deliveryAddress.trim();
    resolvedCity = zone.city;
    resolvedState = zone.state;
  } else {
    return renderCheckoutError(req, res, 'Please choose pickup or home delivery.');
  }

  const total = Number(subtotal) + Number(deliveryFee);
  const orderNumber = generateOrderNumber();

  // ---- Discount code (optional) ----
  let discountAmount = 0;
  let appliedCode = null;
  const rawCode = (req.body.discountCode || '').trim().toUpperCase();
  if (rawCode) {
    const discount = await DiscountCode.findOne({ where: { code: rawCode, isActive: true } });
    if (!discount) {
      return renderCheckoutError(req, res, `Discount code "${rawCode}" is not valid.`);
    }
    if (discount.expiresAt && new Date() > discount.expiresAt) {
      return renderCheckoutError(req, res, `Discount code "${rawCode}" has expired.`);
    }
    if (discount.maxUses !== null && discount.usesCount >= discount.maxUses) {
      return renderCheckoutError(req, res, `Discount code "${rawCode}" has reached its usage limit.`);
    }
    if (Number(subtotal) < Number(discount.minOrderAmount)) {
      return renderCheckoutError(req, res, `Discount code "${rawCode}" requires a minimum order of ₦${Number(discount.minOrderAmount).toLocaleString()}.`);
    }
    discountAmount = discount.type === 'percent'
      ? Number(subtotal) * (Number(discount.value) / 100)
      : Number(discount.value);
    discountAmount = Math.min(discountAmount, Number(subtotal)); // never discount below zero subtotal
    appliedCode = discount;
  }

  const finalTotal = Math.max(0, total - discountAmount);

  const order = await Order.create({
    orderNumber,
    userId: req.currentUser.id,
    deliveryMethod,
    branchId: resolvedBranchId,
    deliveryAddress: resolvedAddress,
    deliveryCity: resolvedCity,
    deliveryState: resolvedState,
    deliveryPhone: deliveryMethod === 'home' ? deliveryPhone.trim() : req.currentUser.phone,
    subtotal,
    deliveryFee,
    discountCode: appliedCode ? appliedCode.code : null,
    discountAmount,
    total: finalTotal,
    expectedReadyAt,
    deliveryConfirmationCode: generateDeliveryConfirmationCode(),
    status: 'pending_payment',
    paymentStatus: 'pending',
  });

  if (appliedCode) {
    appliedCode.usesCount += 1;
    await appliedCode.save();
  }

  await Promise.all(items.map((item) => OrderItem.create({
    orderId: order.id,
    productId: item.productId,
    productName: item.Product.name,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    lineTotal: Number(item.unitPrice) * item.quantity,
  })));

  const paymentReference = `${orderNumber}-${Date.now()}`;
  order.paymentReference = paymentReference;
  await order.save();

  try {
    const initResult = await paystack.initializeTransaction({
      email: req.currentUser.email,
      amountNaira: finalTotal,
      reference: paymentReference,
      callbackUrl: `${process.env.APP_URL}/checkout/callback`,
      metadata: { orderId: order.id, orderNumber },
    });
    return res.redirect(initResult.data.authorization_url);
  } catch (err) {
    order.status = 'cancelled';
    order.paymentStatus = 'failed';
    await order.save();
    return renderCheckoutError(req, res, 'We could not start your payment. Please try again.');
  }
}

async function paystackCallback(req, res) {
  const { reference } = req.query;
  if (!reference) return res.redirect('/checkout');

  const order = await Order.findOne({ where: { paymentReference: reference } });
  if (!order) return res.redirect('/checkout');

  try {
    const verifyResult = await paystack.verifyTransaction(reference);
    const successful = verifyResult.data.status === 'success';

    if (successful) {
      // The webhook may have already processed this by the time the
      // customer's browser gets redirected back - confirmOrderPayment
      // checks paymentStatus first, so this is always safe to call.
      const confirmedOrder = await paymentService.confirmOrderPayment(reference);
      return res.redirect(`/orders/${confirmedOrder.id}?success=1`);
    }

    if (order.paymentStatus !== 'paid') {
      order.status = 'cancelled';
      order.paymentStatus = 'failed';
      await order.save();
    }
    return res.redirect(`/orders/${order.id}?failed=1`);
  } catch (err) {
    return res.redirect(`/orders/${order.id}?failed=1`);
  }
}

async function renderCheckoutError(req, res, error) {
  const { items, subtotal } = await getCartWithItems(req);
  const [branches, deliveryZones] = await Promise.all([
    Branch.findAll({ where: { isActive: true }, order: [['city', 'ASC']] }),
    DeliveryZone.findAll({ where: { isActive: true }, order: [['state', 'ASC'], ['sortOrder', 'ASC'], ['city', 'ASC']] }),
  ]);
  res.status(400).render('checkout', {
    title: 'Checkout — TEM Store',
    items,
    subtotal,
    branches,
    deliveryZones,
    zonesByState: groupZonesByState(deliveryZones),
    user: req.currentUser,
    error,
  });
}

module.exports = { showCheckout, initiateCheckout, paystackCallback };
