const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User, Branch } = require('../../models');

const STAFF_ROLES = ['branch_manager', 'inventory_staff', 'sales_pos', 'logistics', 'super_admin'];

async function listStaff(req, res) {
  const staff = await User.findAll({
    where: { role: { [Op.ne]: 'customer' } },
    include: [{ model: Branch, as: 'branch' }],
    order: [['fullName', 'ASC']],
  });
  const branches = await Branch.findAll({ where: { isActive: true }, order: [['name', 'ASC']] });

  res.render('admin/staff/index', {
    title: 'Staff — Admin',
    layout: 'admin/layout',
    staff,
    branches,
    roles: STAFF_ROLES,
    errors: [],
  });
}

async function createStaff(req, res) {
  const { fullName, email, phone, password, role, branchId } = req.body;
  const errors = [];

  if (!fullName || !email || !phone || !password || !role) errors.push('All fields are required.');
  if (!STAFF_ROLES.includes(role)) errors.push('Invalid role selected.');
  if (role !== 'super_admin' && !branchId) errors.push('This role requires a branch assignment.');

  if (!errors.length) {
    const existing = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (existing) errors.push('An account with this email already exists.');
  }

  if (errors.length) {
    const [staff, branches] = await Promise.all([
      User.findAll({ where: { role: { [Op.ne]: 'customer' } }, include: [{ model: Branch, as: 'branch' }], order: [['fullName', 'ASC']] }),
      Branch.findAll({ where: { isActive: true }, order: [['name', 'ASC']] }),
    ]);
    return res.render('admin/staff/index', {
      title: 'Staff — Admin', layout: 'admin/layout', staff, branches, roles: STAFF_ROLES, errors,
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    fullName: fullName.trim(),
    email: email.toLowerCase().trim(),
    phone: phone.trim(),
    passwordHash,
    role,
    branchId: role === 'super_admin' ? null : branchId,
    isActiveStaff: true,
  });

  res.redirect('/admin/staff');
}

async function updateStaff(req, res) {
  const { role, branchId, isActiveStaff } = req.body;
  const staffMember = await User.findByPk(req.params.id);
  if (!staffMember || staffMember.role === 'customer') return res.status(404).render('404', { layout: false });

  // never let someone accidentally lock themselves out
  if (staffMember.id === req.currentUser.id && isActiveStaff !== 'on') {
    req.session.flashError = "You can't deactivate your own account.";
    return res.redirect('/admin/staff');
  }

  staffMember.role = role;
  staffMember.branchId = role === 'super_admin' ? null : branchId;
  staffMember.isActiveStaff = isActiveStaff === 'on';
  await staffMember.save();

  res.redirect('/admin/staff');
}

module.exports = { listStaff, createStaff, updateStaff };
