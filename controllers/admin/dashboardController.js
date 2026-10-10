const { Op } = require('sequelize');
const { Order, OrderItem, BranchInventory, Branch, Product, Shipment, StockTransfer } = require('../../models');
const { scopedBranchId } = require('../../middleware/staffAuth');

async function dashboard(req, res) {
  const user = req.currentUser;

  if (user.role === 'sales_pos') return posDashboard(req, res);
  if (user.role === 'rider') return riderDashboard(req, res);
  if (user.role === 'logistics') return logisticsDashboard(req, res);
  if (user.role === 'branch_manager') return branchManagerDashboard(req, res);
  if (user.role === 'inventory_staff') return inventoryStaffDashboard(req, res);

  return superAdminDashboard(req, res);
}

// sales_pos: their dashboard IS their sales record - nothing else
async function posDashboard(req, res) {
  const user = req.currentUser;
  const sales = await Order.findAll({
    where: { source: 'pos', soldByStaffId: user.id },
    include: [OrderItem],
    order: [['createdAt', 'DESC']],
    limit: 50,
  });
  const todayTotal = sales
    .filter((o) => new Date(o.createdAt).toDateString() === new Date().toDateString())
    .reduce((sum, o) => sum + Number(o.total), 0);
  res.render('admin/dashboard-pos', {
    title: 'My Sales — TEM Store', layout: 'admin/layout', sales, todayTotal,
  });
}

// rider: their dashboard IS their delivery queue
async function riderDashboard(req, res) {
  const user = req.currentUser;
  const deliveries = await Shipment.findAll({
    where: { assignedRiderId: user.id, status: { [Op.in]: ['assigned', 'out_for_delivery'] } },
    include: [{ model: Branch, as: 'pickupBranch' }],
    order: [['assignedAt', 'ASC']],
  });
  res.render('admin/dashboard-rider', {
    title: 'My Deliveries — TEM Store', layout: 'admin/layout', deliveries, completedToday: 0, error: null,
  });
}

// logistics HOD: the dispatch queue is their whole world, not generic order counts
async function logisticsDashboard(req, res) {
  const [awaitingDispatch, assigned, outForDelivery, deliveredToday] = await Promise.all([
    Shipment.count({ where: { status: 'awaiting_dispatch' } }),
    Shipment.count({ where: { status: 'assigned' } }),
    Shipment.count({ where: { status: 'out_for_delivery' } }),
    Shipment.count({ where: { status: 'delivered', deliveredAt: { [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
  ]);
  const recentShipments = await Shipment.findAll({
    where: { status: { [Op.in]: ['awaiting_dispatch', 'assigned'] } },
    include: [{ model: Branch, as: 'pickupBranch' }],
    order: [['createdAt', 'ASC']],
    limit: 8,
  });
  res.render('admin/dashboard-logistics', {
    title: 'Logistics Dashboard — TEM Store', layout: 'admin/layout',
    awaitingDispatch, assigned, outForDelivery, deliveredToday, recentShipments,
  });
}

// branch_manager: everything about their one branch - inventory, POS, dispatch
async function branchManagerDashboard(req, res) {
  const branchId = scopedBranchId(req.currentUser);
  const [lowStockRows, pendingOrders, todaysPosSales, todaysPosTotal, awaitingShipment, pendingIncomingTransfers] = await Promise.all([
    BranchInventory.findAll({ where: { branchId }, include: [Product] }),
    Order.count({ where: { branchId, source: 'online', status: { [Op.in]: ['paid', 'processing'] } } }),
    Order.count({ where: { branchId, source: 'pos', createdAt: { [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    Order.sum('total', { where: { branchId, source: 'pos', createdAt: { [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    Shipment.count({ where: { pickupBranchId: branchId, status: 'awaiting_dispatch' } }),
    StockTransfer.count({ where: { toBranchId: branchId, status: 'pending' } }),
  ]);
  const lowStockItems = lowStockRows.filter((r) => r.quantity <= r.lowStockThreshold);

  res.render('admin/dashboard-branch-manager', {
    title: 'Branch Dashboard — TEM Store', layout: 'admin/layout',
    lowStockItems, pendingOrders, todaysPosSales, todaysPosTotal: todaysPosTotal || 0, awaitingShipment, pendingIncomingTransfers,
  });
}

// inventory_staff: stock health, pending transfers, nothing about sales/orders
async function inventoryStaffDashboard(req, res) {
  const branchId = scopedBranchId(req.currentUser);
  const [lowStockRows, pendingIncomingTransfers, recentTransfers, totalProducts] = await Promise.all([
    BranchInventory.findAll({ where: { branchId }, include: [Product] }),
    StockTransfer.findAll({
      where: { toBranchId: branchId, status: 'pending' },
      include: [Product, { model: Branch, as: 'fromBranch' }],
      order: [['createdAt', 'ASC']],
    }),
    StockTransfer.findAll({
      where: { toBranchId: branchId, status: 'completed' },
      include: [Product],
      order: [['receivedAt', 'DESC']],
      limit: 5,
    }),
    BranchInventory.count({ where: { branchId } }),
  ]);
  const lowStockItems = lowStockRows.filter((r) => r.quantity <= r.lowStockThreshold);

  res.render('admin/dashboard-inventory-staff', {
    title: 'Inventory Dashboard — TEM Store', layout: 'admin/layout',
    lowStockItems, pendingIncomingTransfers, recentTransfers, totalProducts,
  });
}

// super_admin: the network-wide view
async function superAdminDashboard(req, res) {
  const [pendingOrders, lowStockRows, todaysPosSales, branches, pendingTransfers] = await Promise.all([
    Order.count({ where: { source: 'online', status: { [Op.in]: ['paid', 'processing'] } } }),
    BranchInventory.findAll({ include: [Product, Branch] }),
    Order.count({ where: { source: 'pos', createdAt: { [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    Branch.findAll({ where: { isActive: true } }),
    StockTransfer.count({ where: { status: 'pending' } }),
  ]);
  const lowStockItems = lowStockRows.filter((r) => r.quantity <= r.lowStockThreshold);

  res.render('admin/dashboard', {
    title: 'Admin Dashboard — TEM Store',
    layout: 'admin/layout',
    pendingOrders,
    lowStockItems,
    todaysPosSales,
    branches,
    pendingTransfers,
  });
}

module.exports = { dashboard };
