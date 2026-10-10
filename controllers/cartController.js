const { CartItem, Product } = require('../models');
const { getOrCreateCart, getCartWithItems } = require('../services/cartService');

async function viewCart(req, res) {
  const { items, subtotal } = await getCartWithItems(req);
  res.render('cart', {
    title: 'Your Cart — TEM Store',
    items,
    subtotal,
  });
}

async function addToCart(req, res) {
  const { productId, quantity } = req.body;
  const qty = Math.max(1, parseInt(quantity, 10) || 1);

  const product = await Product.findOne({ where: { id: productId, isActive: true } });
  if (!product || product.visibilityTier === 'exclusive') {
    return res.status(404).json({ error: 'Product not found.' });
  }

  const cart = await getOrCreateCart(req);
  let item = await CartItem.findOne({ where: { cartId: cart.id, productId: product.id } });
  if (item) {
    item.quantity += qty;
    await item.save();
  } else {
    item = await CartItem.create({
      cartId: cart.id,
      productId: product.id,
      quantity: qty,
      unitPrice: product.price,
    });
  }

  const { itemCount } = await getCartWithItems(req);

  if (req.headers['content-type']?.includes('application/json') || req.xhr) {
    return res.json({ success: true, itemCount });
  }
  res.redirect('back');
}

async function updateItem(req, res) {
  const { itemId } = req.params;
  const { quantity } = req.body;
  const qty = Math.max(0, parseInt(quantity, 10) || 0);

  const cart = await getOrCreateCart(req);
  const item = await CartItem.findOne({ where: { id: itemId, cartId: cart.id } });
  if (item) {
    if (qty === 0) {
      await item.destroy();
    } else {
      item.quantity = qty;
      await item.save();
    }
  }
  res.redirect('/cart');
}

async function removeItem(req, res) {
  const { itemId } = req.params;
  const cart = await getOrCreateCart(req);
  await CartItem.destroy({ where: { id: itemId, cartId: cart.id } });
  res.redirect('/cart');
}

async function incrementByProduct(req, res) {
  const { productId } = req.body;
  const product = await Product.findOne({ where: { id: productId, isActive: true } });
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  const cart = await getOrCreateCart(req);
  let item = await CartItem.findOne({ where: { cartId: cart.id, productId: product.id } });
  if (item) {
    item.quantity += 1;
    await item.save();
  } else {
    item = await CartItem.create({ cartId: cart.id, productId: product.id, quantity: 1, unitPrice: product.price });
  }
  const { itemCount } = await getCartWithItems(req);
  res.json({ success: true, quantity: item.quantity, itemCount });
}

async function decrementByProduct(req, res) {
  const { productId } = req.body;
  const cart = await getOrCreateCart(req);
  const item = await CartItem.findOne({ where: { cartId: cart.id, productId } });
  if (!item) return res.json({ success: true, quantity: 0 });

  if (item.quantity <= 1) {
    await item.destroy();
    const { itemCount } = await getCartWithItems(req);
    return res.json({ success: true, quantity: 0, itemCount });
  }
  item.quantity -= 1;
  await item.save();
  const { itemCount } = await getCartWithItems(req);
  res.json({ success: true, quantity: item.quantity, itemCount });
}

module.exports = { viewCart, addToCart, updateItem, removeItem, incrementByProduct, decrementByProduct };
