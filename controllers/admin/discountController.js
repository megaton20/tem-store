const { DiscountCode } = require('../../models');

async function listCodes(req, res) {
  const codes = await DiscountCode.findAll({ order: [['createdAt', 'DESC']] });
  res.render('admin/discounts/index', { title: 'Discount Codes — Admin', layout: 'admin/layout', codes, errors: [] });
}

async function createCode(req, res) {
  const { code, type, value, minOrderAmount, maxUses, expiresAt } = req.body;
  const errors = [];
  if (!code || !value) errors.push('Code and value are required.');

  if (!errors.length) {
    const existing = await DiscountCode.findOne({ where: { code: code.trim().toUpperCase() } });
    if (existing) errors.push('That code already exists.');
  }

  if (errors.length) {
    const codes = await DiscountCode.findAll({ order: [['createdAt', 'DESC']] });
    return res.render('admin/discounts/index', { title: 'Discount Codes — Admin', layout: 'admin/layout', codes, errors });
  }

  await DiscountCode.create({
    code: code.trim().toUpperCase(),
    type: type || 'percent',
    value,
    minOrderAmount: minOrderAmount || 0,
    maxUses: maxUses ? parseInt(maxUses, 10) : null,
    expiresAt: expiresAt || null,
  });

  res.redirect('/admin/discounts');
}

async function toggleActive(req, res) {
  const code = await DiscountCode.findByPk(req.params.id);
  if (code) {
    code.isActive = !code.isActive;
    await code.save();
  }
  res.redirect('/admin/discounts');
}

module.exports = { listCodes, createCode, toggleActive };
