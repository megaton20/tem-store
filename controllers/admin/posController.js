const { sequelize, Product, BranchInventory, Order, OrderItem, Branch, Category } = require('../../models');
const { generateOrderNumber } = require('../../utils/orderNumber');
const inventoryService = require('../../services/inventoryService');

async function showPOS(req, res) {
  const branchId = req.currentUser.branchId;
  if (!branchId) {
    return res.render('admin/pos/no-branch', { title: 'POS — Admin', layout: 'admin/layout' });
  }

  const inventory = await BranchInventory.findAll({
    where: { branchId },
    include: [{ model: Product, include: [Category] }],
    order: [[Product, 'name', 'ASC']],
  });
  const branch = await Branch.findByPk(branchId);

  const activeInventory = inventory.filter((i) => i.Product && i.Product.isActive && i.Product.fulfillmentType === 'in_house');

  // group by category for the POS grid
  const grouped = {};
  activeInventory.forEach((row) => {
    const catName = row.Product.Category ? row.Product.Category.name : 'Other';
    if (!grouped[catName]) grouped[catName] = [];
    grouped[catName].push(row);
  });

  res.render('admin/pos/terminal', {
    title: 'POS Terminal — Admin',
    layout: 'admin/layout',
    grouped,
    branch,
  });
}

// Body: { items: [{productId, quantity}], paymentMethod, customerName, customerPhone }
async function processSale(req, res) {
  const branchId = req.currentUser.branchId;
  if (!branchId) return res.status(400).json({ error: 'You are not assigned to a branch.' });

  let items;
  try {
    items = JSON.parse(req.body.items || '[]');
  } catch {
    return res.status(400).json({ error: 'Invalid cart data.' });
  }
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Cart is empty.' });
  }

  const t = await sequelize.transaction();
  try {
    const products = await Product.findAll({ where: { id: items.map((i) => i.productId) }, transaction: t });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    const lineItems = items.map((i) => {
      const product = productMap.get(i.productId);
      if (!product) throw new Error('Product not found.');
      const lineTotal = Number(product.price) * i.quantity;
      subtotal += lineTotal;
      return { productId: product.id, productName: product.name, unitPrice: product.price, quantity: i.quantity, lineTotal };
    });

    // verify stock BEFORE creating anything - a POS sale must never oversell
    for (const item of lineItems) {
      const stock = await inventoryService.getBranchStock(item.productId, branchId);
      if (stock < item.quantity) {
        throw new Error(`Not enough stock for ${item.productName} at this branch (have ${stock}, need ${item.quantity}).`);
      }
    }

    const order = await Order.create(
      {
        orderNumber: generateOrderNumber(),
        userId: null,
        source: 'pos',
        branchId,
        soldByStaffId: req.currentUser.id,
        walkInCustomerName: req.body.customerName || null,
        walkInCustomerPhone: req.body.customerPhone || null,
        deliveryMethod: 'walk_in',
        subtotal,
        deliveryFee: 0,
        total: subtotal,
        status: 'completed',
        paymentStatus: 'paid',
        paymentMethod: req.body.paymentMethod || 'cash',
        paidAt: new Date(),
      },
      { transaction: t }
    );

    for (const item of lineItems) {
      await OrderItem.create({ orderId: order.id, ...item }, { transaction: t });
    }

    for (const item of lineItems) {
      await inventoryService.adjustBranchStock(
        {
          productId: item.productId,
          branchId,
          delta: -item.quantity,
          reason: 'pos_sale',
          referenceType: 'Order',
          referenceId: order.id,
          performedByUserId: req.currentUser.id,
        },
        t
      );
    }

    await t.commit();
    res.json({ success: true, orderId: order.id, orderNumber: order.orderNumber, total: subtotal });
  } catch (err) {
    await t.rollback();
    res.status(400).json({ error: err.message });
  }
}

async function receipt(req, res) {
  const order = await Order.findOne({
    where: { id: req.params.id, source: 'pos', branchId: req.currentUser.branchId },
    include: [OrderItem, Branch],
  });
  if (!order) return res.status(404).render('404', { layout: false });
  res.render('admin/pos/receipt', { title: `Receipt ${order.orderNumber}`, layout: false, order });
}

async function redeemLoyalty(req, res) {
  const loyaltyService = require('../../services/loyaltyService');
  const { code } = req.body;
  try {
    const reward = await loyaltyService.redeemReward(code, req.currentUser.id);
    res.json({ success: true, message: `Redeemed successfully.` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { showPOS, processSale, receipt, redeemLoyalty };
