const { Op } = require('sequelize');
const { Order, OrderItem, Shipment, Branch, User, CourierZone } = require('../../models');
const { scopedBranchId, hasPermission } = require('../../middleware/staffAuth');
const logisticsService = require('../../services/logisticsService');

// LOGISTICS HOD: every shipment waiting for a rider, or already assigned
// and moving, across every branch. This is the actual "waiting for
// shipment" queue the HOD needs to see.
async function queue(req, res) {
  const shipments = await Shipment.findAll({
    where: { status: { [Op.in]: ['awaiting_dispatch', 'assigned', 'out_for_delivery'] } },
    include: [{ model: Branch, as: 'pickupBranch' }, { model: User, as: 'rider' }],
    order: [['createdAt', 'ASC']],
  });
  const riders = await User.findAll({ where: { role: 'rider', isActiveStaff: true }, include: [{ model: Branch, as: 'branch' }] });

  res.render('admin/logistics/queue', {
    title: 'Dispatch Queue — Admin', layout: 'admin/layout', shipments, riders,
  });
}

// BRANCH MANAGERS: process a packed order into a shipment AND assign a
// rider, both scoped to their own branch. INVENTORY STAFF reach this same
// page (to confirm items are packed/ready for logistics to pick up) but
// the view hides rider assignment and the walk-in booking button for them -
// canAssign/canBook below drive that.
async function process(req, res) {
  const branchId = scopedBranchId(req.currentUser) || req.query.branchId;
  const canAssign = hasPermission(req.currentUser, 'logistics:assign');
  const canBook = hasPermission(req.currentUser, 'logistics:book');

  if (!branchId) {
    return res.render('admin/logistics/process', {
      title: 'Process & Dispatch — Admin', layout: 'admin/layout',
      unprocessedOrders: [], shipments: [], riders: [], noBranch: true, canAssign, canBook,
    });
  }

  const [unprocessedOrders, shipments, riders] = await Promise.all([
    Order.findAll({
      where: { branchId, deliveryMethod: 'home', source: 'online', status: { [Op.in]: ['paid', 'processing'] } },
      include: [OrderItem],
      order: [['createdAt', 'ASC']],
    }),
    Shipment.findAll({
      where: { pickupBranchId: branchId, status: { [Op.in]: ['awaiting_dispatch', 'assigned', 'out_for_delivery'] } },
      include: [{ model: User, as: 'rider' }],
      order: [['createdAt', 'ASC']],
    }),
    canAssign ? User.findAll({ where: { role: 'rider', isActiveStaff: true, branchId } }) : [],
  ]);

  // an order already turned into a shipment shouldn't show up as "unprocessed" again
  const shipmentOrderIds = new Set(shipments.map((s) => s.orderId).filter(Boolean));
  const trulyUnprocessed = unprocessedOrders.filter((o) => !shipmentOrderIds.has(o.id));

  res.render('admin/logistics/process', {
    title: 'Process & Dispatch — Admin', layout: 'admin/layout',
    unprocessedOrders: trulyUnprocessed, shipments, riders, noBranch: false, canAssign, canBook,
  });
}

async function markReady(req, res) {
  const branchId = scopedBranchId(req.currentUser);
  const order = await Order.findOne({
    where: { id: req.params.orderId, ...(branchId ? { branchId } : {}) },
  });
  if (!order) return res.status(404).render('404', { layout: false });

  await logisticsService.createShipmentFromOrder(order, req.currentUser.id);
  order.status = 'processing';
  await order.save();

  res.redirect(req.currentUser.role === 'logistics' || req.currentUser.role === 'super_admin' ? '/admin/logistics/queue' : '/admin/logistics/process');
}

// Shared by HOD (any shipment) and branch staff (their own branch's shipments only).
async function assign(req, res) {
  const branchId = scopedBranchId(req.currentUser);
  const shipment = await Shipment.findOne({
    where: { id: req.params.id, ...(branchId ? { pickupBranchId: branchId } : {}) },
  });
  if (!shipment) return res.status(404).render('404', { layout: false });

  await logisticsService.assignRider(shipment, req.body.riderId, req.currentUser.id);

  res.redirect(branchId ? '/admin/logistics/process' : '/admin/logistics/queue');
}

async function newExternalForm(req, res) {
  const branchId = scopedBranchId(req.currentUser);
  const [zones, branches] = await Promise.all([
    CourierZone.findAll({ where: { isActive: true }, order: [['sortOrder', 'ASC']] }),
    branchId ? [] : Branch.findAll({ where: { isActive: true }, order: [['name', 'ASC']] }),
  ]);
  res.render('admin/logistics/new-external', {
    title: 'Book a Walk-in Delivery — Admin', layout: 'admin/layout',
    zones, branches, ownBranchId: branchId, defaultBranchId: branchId || req.currentUser.branchId || null, errors: [],
  });
}

async function createExternal(req, res) {
  const branchId = scopedBranchId(req.currentUser);
  const pickupBranchId = branchId || req.body.pickupBranchId;

  const { senderName, senderPhone, recipientName, recipientPhone, deliveryAddress, courierZoneId, packageSize, description, paymentMethod, paymentReceived } = req.body;

  const errors = [];
  if (!senderName || !senderPhone) errors.push('Sender name and phone are required.');
  if (!recipientName || !recipientPhone || !deliveryAddress) errors.push('Recipient name, phone, and address are required.');
  if (!courierZoneId) errors.push('Please select a destination.');
  if (!description) errors.push('Please describe what is being sent.');
  if (!pickupBranchId) errors.push('Please select a pickup branch.');

  if (errors.length) {
    const [zones, branches] = await Promise.all([
      CourierZone.findAll({ where: { isActive: true }, order: [['sortOrder', 'ASC']] }),
      branchId ? [] : Branch.findAll({ where: { isActive: true }, order: [['name', 'ASC']] }),
    ]);
    return res.render('admin/logistics/new-external', {
      title: 'Book a Walk-in Delivery — Admin', layout: 'admin/layout',
      zones, branches, ownBranchId: branchId, defaultBranchId: branchId || req.currentUser.branchId || null, errors,
    });
  }

  const shipment = await logisticsService.createExternalShipment({
    senderName, senderPhone, recipientName, recipientPhone, deliveryAddress,
    courierZoneId, packageSize: packageSize || 'negligible', description,
    pickupBranchId, paymentMethod, paymentReceived: paymentReceived === 'on',
  }, req.currentUser.id);

  res.redirect(`/admin/logistics/booking/${shipment.id}/confirmation`);
}

async function bookingConfirmation(req, res) {
  const shipment = await Shipment.findOne({
    where: { id: req.params.id, source: 'external' },
    include: [{ model: Branch, as: 'pickupBranch' }],
  });
  if (!shipment) return res.status(404).render('404', { layout: false });
  res.render('admin/logistics/booking-confirmation', {
    title: 'Delivery Booked — Admin', layout: 'admin/layout', shipment,
  });
}

module.exports = { queue, process, markReady, assign, newExternalForm, createExternal, bookingConfirmation };
