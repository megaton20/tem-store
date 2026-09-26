const { OperatingLocation } = require('../../models');

async function listLocations(req, res) {
  const locations = await OperatingLocation.findAll({ order: [['state', 'ASC'], ['sortOrder', 'ASC'], ['city', 'ASC']] });
  res.render('admin/operating-locations/index', { title: 'Operating Locations — Admin', layout: 'admin/layout', locations, errors: [] });
}

async function createLocation(req, res) {
  const { state, city, sortOrder } = req.body;
  const errors = [];
  if (!state || !city) errors.push('State and city are required.');

  if (!errors.length) {
    const existing = await OperatingLocation.findOne({ where: { state: state.trim(), city: city.trim() } });
    if (existing) errors.push(`${city.trim()}, ${state.trim()} is already in the list.`);
  }

  if (errors.length) {
    const locations = await OperatingLocation.findAll({ order: [['state', 'ASC'], ['sortOrder', 'ASC'], ['city', 'ASC']] });
    return res.render('admin/operating-locations/index', { title: 'Operating Locations — Admin', layout: 'admin/layout', locations, errors });
  }

  await OperatingLocation.create({
    state: state.trim(),
    city: city.trim(),
    sortOrder: sortOrder ? parseInt(sortOrder, 10) : 0,
  });

  res.redirect('/admin/operating-locations');
}

async function toggleActive(req, res) {
  const location = await OperatingLocation.findByPk(req.params.id);
  if (location) {
    location.isActive = !location.isActive;
    await location.save();
  }
  res.redirect('/admin/operating-locations');
}

module.exports = { listLocations, createLocation, toggleActive };
