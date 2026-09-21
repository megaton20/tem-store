const slugify = require('slugify');
const { Branch } = require('../../models');

async function listBranches(req, res) {
  const branches = await Branch.findAll({ order: [['name', 'ASC']] });
  res.render('admin/branches/index', { title: 'Branches — Admin', layout: 'admin/layout', branches, errors: [] });
}

async function createBranch(req, res) {
  const { name, address, city, state, contactPhone, type, pickupFee, operatingHours } = req.body;
  const errors = [];
  if (!name || !address || !city || !state) errors.push('Name, address, city, and state are required.');

  if (errors.length) {
    const branches = await Branch.findAll({ order: [['name', 'ASC']] });
    return res.render('admin/branches/index', { title: 'Branches — Admin', layout: 'admin/layout', branches, errors });
  }

  await Branch.create({
    name: name.trim(),
    slug: slugify(`${name}-${city}`, { lower: true, strict: true }),
    address: address.trim(),
    city: city.trim(),
    state: state.trim(),
    contactPhone: contactPhone || null,
    type: type || 'kiosk',
    pickupFee: pickupFee || 0,
    operatingHours: operatingHours || '9:00 AM - 7:00 PM',
    isPickupEnabled: type !== 'warehouse',
  });

  res.redirect('/admin/branches');
}

async function toggleActive(req, res) {
  const branch = await Branch.findByPk(req.params.id);
  if (branch) {
    branch.isActive = !branch.isActive;
    await branch.save();
  }
  res.redirect('/admin/branches');
}

async function updateBranch(req, res) {
  const branch = await Branch.findByPk(req.params.id);
  if (!branch) return res.status(404).render('404', { layout: false });

  const { name, address, city, state, contactPhone, type, pickupFee, operatingHours, isPickupEnabled, isFulfillmentEnabled } = req.body;

  branch.name = name?.trim() || branch.name;
  branch.address = address?.trim() || branch.address;
  branch.city = city?.trim() || branch.city;
  branch.state = state?.trim() || branch.state;
  branch.contactPhone = contactPhone || null;
  branch.type = type || branch.type;
  branch.pickupFee = pickupFee || 0;
  branch.operatingHours = operatingHours || branch.operatingHours;
  branch.isPickupEnabled = isPickupEnabled === 'on';
  branch.isFulfillmentEnabled = isFulfillmentEnabled === 'on';
  await branch.save();

  res.redirect('/admin/branches');
}

module.exports = { listBranches, createBranch, updateBranch, toggleActive };
