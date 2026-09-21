const { Op, fn, col, literal } = require('sequelize');
const { sequelize, Order, OrderItem, Branch } = require('../../models');

async function showReports(req, res) {
  const days = parseInt(req.query.days, 10) || 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const paidOrderWhere = {
    paymentStatus: 'paid',
    createdAt: { [Op.gte]: since },
  };

  // Revenue by day (online + POS combined)
  const dailyRevenue = await Order.findAll({
    where: paidOrderWhere,
    attributes: [
      [fn('DATE', col('created_at')), 'day'],
      [fn('SUM', col('total')), 'revenue'],
      [fn('COUNT', col('id')), 'orderCount'],
    ],
    group: [fn('DATE', col('created_at'))],
    order: [[fn('DATE', col('created_at')), 'ASC']],
    raw: true,
  });

  // Top products by quantity sold
  const topProducts = await OrderItem.findAll({
    attributes: [
      'productName',
      [fn('SUM', col('quantity')), 'totalQuantity'],
      [fn('SUM', col('line_total')), 'totalRevenue'],
    ],
    include: [{ model: Order, attributes: [], where: paidOrderWhere }],
    group: ['product_name'],
    order: [[literal('"totalQuantity"'), 'DESC']],
    limit: 10,
    raw: true,
  });

  // Revenue by branch
  const branchRevenue = await Order.findAll({
    where: { ...paidOrderWhere, branchId: { [Op.ne]: null } },
    attributes: [
      'branchId',
      [fn('SUM', col('total')), 'revenue'],
      [fn('COUNT', col('Order.id')), 'orderCount'],
    ],
    include: [{ model: Branch, attributes: ['name'] }],
    group: ['branchId', 'Branch.id', 'Branch.name'],
    order: [[literal('revenue'), 'DESC']],
    raw: true,
  });

  const totalRevenue = dailyRevenue.reduce((sum, d) => sum + Number(d.revenue), 0);
  const totalOrders = dailyRevenue.reduce((sum, d) => sum + Number(d.orderCount), 0);

  res.render('admin/reports', {
    title: 'Reports — Admin',
    layout: 'admin/layout',
    days,
    dailyRevenue,
    topProducts,
    branchRevenue,
    totalRevenue,
    totalOrders,
  });
}

// Simple CSV export of paid orders in the selected window
async function exportCsv(req, res) {
  const days = parseInt(req.query.days, 10) || 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const orders = await Order.findAll({
    where: { paymentStatus: 'paid', createdAt: { [Op.gte]: since } },
    order: [['createdAt', 'ASC']],
  });

  const header = 'order_number,date,source,delivery_method,subtotal,delivery_fee,discount,total\n';
  const rows = orders.map((o) => [
    o.orderNumber,
    o.createdAt.toISOString().slice(0, 10),
    o.source,
    o.deliveryMethod,
    o.subtotal,
    o.deliveryFee,
    o.discountAmount,
    o.total,
  ].join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="tem-store-orders-${days}d.csv"`);
  res.send(header + rows);
}

module.exports = { showReports, exportCsv };
