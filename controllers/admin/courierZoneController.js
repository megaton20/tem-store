const { CourierZone } = require('../../models');

async function listZones(req, res) {
  const zones = await CourierZone.findAll({ order: [['sortOrder', 'ASC'], ['name', 'ASC']] });
  res.render('admin/courier-zones/index', { title: 'Courier Zones — Admin', layout: 'admin/layout', zones, errors: [] });
}

async function createZone(req, res) {
  const { name, city, state, baseFee, mediumSurcharge, largeSurcharge } = req.body;
  const errors = [];
  if (!name || !city || !state || !baseFee) errors.push('Name, city, state, and base fee are required.');

  if (errors.length) {
    const zones = await CourierZone.findAll({ order: [['sortOrder', 'ASC'], ['name', 'ASC']] });
    return res.render('admin/courier-zones/index', { title: 'Courier Zones — Admin', layout: 'admin/layout', zones, errors });
  }

  await CourierZone.create({
    name: name.trim(),
    city: city.trim(),
    state: state.trim(),
    baseFee,
    mediumSurcharge: mediumSurcharge || 0,
    largeSurcharge: largeSurcharge || 0,
  });

  res.redirect('/admin/courier-zones');
}

async function toggleActive(req, res) {
  const zone = await CourierZone.findByPk(req.params.id);
  if (zone) {
    zone.isActive = !zone.isActive;
    await zone.save();
  }
  res.redirect('/admin/courier-zones');
}

module.exports = { listZones, createZone, toggleActive };
