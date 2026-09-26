const bcrypt = require('bcryptjs');
const { User, LoyaltyTier, LoyaltyReward } = require('../models');
const { getOperatingLocationsGrouped } = require('../services/locationService');
const NIGERIA_STATES = require('../utils/nigeriaStates');

async function getLoyaltyData(userId) {
  const user = await User.findByPk(userId);
  const [tiers, rewards] = await Promise.all([
    LoyaltyTier.findAll({ where: { isActive: true }, order: [['stageNumber', 'ASC']] }),
    LoyaltyReward.findAll({ where: { userId }, include: [LoyaltyTier], order: [['earnedAt', 'DESC']] }),
  ]);

  const purchaseCount = user.loyaltyPurchaseCount;
  const nextTier = tiers.find((t) => t.purchasesRequired > purchaseCount) || null;

  return { purchaseCount, tiers, rewards, nextTier };
}

async function showProfile(req, res) {
  const [loyalty, locationsByState] = await Promise.all([
    getLoyaltyData(req.currentUser.id),
    getOperatingLocationsGrouped(),
  ]);
  res.render('profile', {
    title: 'My Profile — TEM Store', errors: [], success: null,
    verified: req.query.verified === '1', resent: req.query.resent === '1',
    loyalty, locationsByState, states: NIGERIA_STATES,
  });
}

async function updateProfile(req, res) {
  const { fullName, phone, address, city, state, otherLocationNote } = req.body;
  const errors = [];
  if (!fullName || fullName.trim().length < 2) errors.push('Please enter your full name.');
  if (!phone || phone.trim().length < 7) errors.push('Please enter a valid phone number.');

  if (errors.length) {
    const [loyalty, locationsByState] = await Promise.all([getLoyaltyData(req.currentUser.id), getOperatingLocationsGrouped()]);
    return res.render('profile', { title: 'My Profile — TEM Store', errors, success: null, loyalty, locationsByState, states: NIGERIA_STATES });
  }

  const user = await User.findByPk(req.currentUser.id);
  user.fullName = fullName.trim();
  user.phone = phone.trim();
  user.address = address ? address.trim() : null;
  user.city = city ? city.trim() : null;
  user.state = state ? state.trim() : user.state;
  user.otherLocationNote = city === 'Other' && otherLocationNote ? otherLocationNote.trim() : null;
  await user.save();

  const [loyalty, locationsByState] = await Promise.all([getLoyaltyData(req.currentUser.id), getOperatingLocationsGrouped()]);
  res.render('profile', { title: 'My Profile — TEM Store', errors: [], success: 'Profile updated.', loyalty, locationsByState, states: NIGERIA_STATES });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const errors = [];

  const user = await User.findByPk(req.currentUser.id);
  const matches = await bcrypt.compare(currentPassword || '', user.passwordHash);
  if (!matches) errors.push('Current password is incorrect.');
  if (!newPassword || newPassword.length < 6) errors.push('New password must be at least 6 characters.');
  if (newPassword !== confirmPassword) errors.push('New passwords do not match.');

  const [loyalty, locationsByState] = await Promise.all([getLoyaltyData(req.currentUser.id), getOperatingLocationsGrouped()]);

  if (errors.length) {
    return res.render('profile', { title: 'My Profile — TEM Store', errors, success: null, loyalty, locationsByState, states: NIGERIA_STATES });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  res.render('profile', { title: 'My Profile — TEM Store', errors: [], success: 'Password changed.', loyalty, locationsByState, states: NIGERIA_STATES });
}

module.exports = { showProfile, updateProfile, changePassword };
