const { Order, OrderItem, Branch, User } = require('../models');

async function listOrders(req, res) {
  const orders = await Order.findAll({
    where: { userId: req.currentUser.id },
    order: [['createdAt', 'DESC']],
  });
  res.render('orders/index', { title: 'Your Orders — TEM Store', orders });
}

async function showOrder(req, res) {
  const order = await Order.findOne({
    where: { id: req.params.id, userId: req.currentUser.id },
    include: [OrderItem, Branch, { model: User, as: 'rider' }],
  });
  if (!order) return res.status(404).render('404', { layout: false });

  res.render('orders/show', {
    title: `Order ${order.orderNumber} — TEM Store`,
    order,
    success: req.query.success === '1',
    failed: req.query.failed === '1',
  });
}

module.exports = { listOrders, showOrder };
