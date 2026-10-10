const bcrypt = require('bcryptjs');
const { User, Branch } = require('../../models');

async function showProfile(req, res) {
  const user = await User.findByPk(req.currentUser.id, { include: [{ model: Branch, as: 'branch' }] });
  res.render('admin/profile', {
    title: 'My Profile — Admin', layout: 'admin/layout',
    profileUser: user, errors: [], success: null,
  });
}

async function updateProfile(req, res) {
  const { fullName, phone } = req.body;
  const errors = [];
  if (!fullName || fullName.trim().length < 2) errors.push('Please enter your full name.');
  if (!phone || phone.trim().length < 7) errors.push('Please enter a valid phone number.');

  const user = await User.findByPk(req.currentUser.id, { include: [{ model: Branch, as: 'branch' }] });

  if (errors.length) {
    return res.render('admin/profile', { title: 'My Profile — Admin', layout: 'admin/layout', profileUser: user, errors, success: null });
  }

  user.fullName = fullName.trim();
  user.phone = phone.trim();
  await user.save();

  res.render('admin/profile', { title: 'My Profile — Admin', layout: 'admin/layout', profileUser: user, errors: [], success: 'Profile updated.' });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const errors = [];

  const user = await User.findByPk(req.currentUser.id, { include: [{ model: Branch, as: 'branch' }] });
  const matches = await bcrypt.compare(currentPassword || '', user.passwordHash);
  if (!matches) errors.push('Current password is incorrect.');
  if (!newPassword || newPassword.length < 6) errors.push('New password must be at least 6 characters.');
  if (newPassword !== confirmPassword) errors.push('New passwords do not match.');

  if (errors.length) {
    return res.render('admin/profile', { title: 'My Profile — Admin', layout: 'admin/layout', profileUser: user, errors, success: null });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  res.render('admin/profile', { title: 'My Profile — Admin', layout: 'admin/layout', profileUser: user, errors: [], success: 'Password changed.' });
}

module.exports = { showProfile, updateProfile, changePassword };
