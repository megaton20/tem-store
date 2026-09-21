const { Cart, CartItem, Product } = require('../models');

// Every visitor gets a session-based guest cart. If they're logged in,
// we use their persistent user cart instead. On login, guest cart items
// are merged into the user's cart (see mergeGuestCartIntoUser below).

async function getOrCreateCart(req) {
  if (req.session.userId) {
    let cart = await Cart.findOne({ where: { userId: req.session.userId, status: 'active' } });
    if (!cart) {
      cart = await Cart.create({ userId: req.session.userId, status: 'active' });
    }
    return cart;
  }

  let cart = await Cart.findOne({ where: { sessionId: req.sessionID, status: 'active' } });
  if (!cart) {
    cart = await Cart.create({ sessionId: req.sessionID, status: 'active' });
  }
  return cart;
}

async function getCartWithItems(req) {
  const cart = await getOrCreateCart(req);
  const items = await CartItem.findAll({
    where: { cartId: cart.id },
    include: [{ model: Product }],
    order: [['createdAt', 'ASC']],
  });
  const subtotal = items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  return { cart, items, subtotal, itemCount };
}

async function mergeGuestCartIntoUser(sessionId, userId) {
  const guestCart = await Cart.findOne({ where: { sessionId, status: 'active' } });
  if (!guestCart) return;

  let userCart = await Cart.findOne({ where: { userId, status: 'active' } });
  if (!userCart) {
    // simplest path: just hand the guest cart over to the user
    guestCart.userId = userId;
    guestCart.sessionId = null;
    await guestCart.save();
    return;
  }

  const guestItems = await CartItem.findAll({ where: { cartId: guestCart.id } });
  for (const item of guestItems) {
    const existing = await CartItem.findOne({ where: { cartId: userCart.id, productId: item.productId } });
    if (existing) {
      existing.quantity += item.quantity;
      await existing.save();
    } else {
      await CartItem.create({
        cartId: userCart.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      });
    }
  }
  await CartItem.destroy({ where: { cartId: guestCart.id } });
  guestCart.status = 'abandoned';
  await guestCart.save();
}

async function getCartQuantitiesMap(req) {
  const { items } = await getCartWithItems(req);
  const map = {};
  items.forEach((item) => { map[item.productId] = item.quantity; });
  return map;
}

module.exports = { getOrCreateCart, getCartWithItems, mergeGuestCartIntoUser, getCartQuantitiesMap };
