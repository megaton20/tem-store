const { DeliveryZone } = require('../../models');

async function listZones(req, res) {
  const zones = await DeliveryZone.findAll({ order: [['state', 'ASC'], ['sortOrder', 'ASC'], ['city', 'ASC']] });
  res.render('admin/delivery-zones/index', { title: 'Delivery Zones & Pricing — Admin', layout: 'admin/layout', zones, errors: [] });
}

async function createZone(req, res) {
  const { state, city, fee, estimatedDays, sortOrder } = req.body;
  const errors = [];
  if (!state || !city || !fee) errors.push('State, city, and fee are required.');

  if (!errors.length) {
    const existing = await DeliveryZone.findOne({ where: { state: state.trim(), city: city.trim() } });
    if (existing) errors.push(`${city.trim()}, ${state.trim()} is already in the list.`);
  }

  if (errors.length) {
    const zones = await DeliveryZone.findAll({ order: [['state', 'ASC'], ['sortOrder', 'ASC'], ['city', 'ASC']] });
    return res.render('admin/delivery-zones/index', { title: 'Delivery Zones & Pricing — Admin', layout: 'admin/layout', zones, errors });
  }

  await DeliveryZone.create({
    state: state.trim(),
    city: city.trim(),
    fee,
    estimatedDays: estimatedDays || '1-2 days',
    sortOrder: sortOrder ? parseInt(sortOrder, 10) : 0,
  });

  res.redirect('/admin/delivery-zones');
}

async function updateZone(req, res) {
  const zone = await DeliveryZone.findByPk(req.params.id);
  if (!zone) return res.status(404).render('404', { layout: false });

  const { fee, estimatedDays, sortOrder } = req.body;
  zone.fee = fee || zone.fee;
  zone.estimatedDays = estimatedDays || zone.estimatedDays;
  zone.sortOrder = sortOrder ? parseInt(sortOrder, 10) : zone.sortOrder;
  await zone.save();

  res.redirect('/admin/delivery-zones');
}

async function toggleActive(req, res) {
  const zone = await DeliveryZone.findByPk(req.params.id);
  if (zone) {
    zone.isActive = !zone.isActive;
    await zone.save();
  }
  res.redirect('/admin/delivery-zones');
}

module.exports = { listZones, createZone, updateZone, toggleActive };
