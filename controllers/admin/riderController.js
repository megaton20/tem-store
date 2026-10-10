const { Op } = require('sequelize');
const { Shipment, Branch } = require('../../models');
const logisticsService = require('../../services/logisticsService');

async function myDeliveries(req, res) {
  const deliveries = await Shipment.findAll({
    where: { assignedRiderId: req.currentUser.id, status: { [Op.in]: ['assigned', 'out_for_delivery'] } },
    include: [{ model: Branch, as: 'pickupBranch' }],
    order: [['assignedAt', 'ASC']],
  });
  const completedToday = await Shipment.count({
    where: {
      assignedRiderId: req.currentUser.id,
      status: 'delivered',
      deliveredAt: { [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
  });
  res.render('admin/dashboard-rider', {
    title: 'My Deliveries — TEM Store', layout: 'admin/layout', deliveries, completedToday, error: null,
  });
}

async function myEarnings(req, res) {
  const completed = await Shipment.findAll({
    where: { assignedRiderId: req.currentUser.id, status: 'delivered' },
    order: [['deliveredAt', 'DESC']],
    limit: 200,
  });

  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const sumSince = (date) => completed
    .filter((s) => new Date(s.deliveredAt) >= date)
    .reduce((sum, s) => sum + Number(s.riderPayout), 0);

  const totals = {
    today: sumSince(startOfToday),
    thisWeek: sumSince(startOfWeek),
    allTime: completed.reduce((sum, s) => sum + Number(s.riderPayout), 0),
    unpaid: completed.filter((s) => s.payoutStatus === 'unpaid').reduce((sum, s) => sum + Number(s.riderPayout), 0),
  };

  res.render('admin/earnings', { title: 'My Earnings — TEM Store', layout: 'admin/layout', completed, totals });
}

async function startDelivery(req, res) {
  const shipment = await Shipment.findOne({ where: { id: req.params.id, assignedRiderId: req.currentUser.id, status: 'assigned' } });
  if (shipment) await logisticsService.startDelivery(shipment);
  res.redirect('/admin/rider');
}

// The customer reads their confirmation code off their order page and gives
// it to the rider in person - the "proof of ownership" step before a rider
// can close out a delivery.
async function completeDelivery(req, res) {
  const shipment = await Shipment.findOne({ where: { id: req.params.id, assignedRiderId: req.currentUser.id, status: 'out_for_delivery' } });
  if (!shipment) return res.redirect('/admin/rider');

  const submittedCode = (req.body.code || '').trim().toUpperCase();
  if (submittedCode !== shipment.confirmationCode) {
    const deliveries = await Shipment.findAll({
      where: { assignedRiderId: req.currentUser.id, status: { [Op.in]: ['assigned', 'out_for_delivery'] } },
      include: [{ model: Branch, as: 'pickupBranch' }],
      order: [['assignedAt', 'ASC']],
    });
    return res.render('admin/dashboard-rider', {
      title: 'My Deliveries — TEM Store', layout: 'admin/layout', deliveries, completedToday: 0,
      error: `Incorrect code for this delivery. Ask the recipient to check their order page again.`,
    });
  }

  await logisticsService.completeDelivery(shipment);
  res.redirect('/admin/rider');
}

module.exports = { myDeliveries, myEarnings, startDelivery, completeDelivery };
