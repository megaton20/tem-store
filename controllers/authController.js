const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User } = require('../models');
const { mergeGuestCartIntoUser } = require('../services/cartService');
const emailService = require('../services/emailService');
const { getOperatingLocationsGrouped } = require('../services/locationService');
const NIGERIA_STATES = require('../utils/nigeriaStates');

// Where each role lands after logging in. Customers go to the storefront
// (or wherever they were headed, e.g. checkout); every staff role goes
// straight into the part of /admin that's actually relevant to them.
function destinationForRole(role) {
  switch (role) {
    case 'super_admin': return '/admin';
    case 'branch_manager': return '/admin/inventory';
    case 'inventory_staff': return '/admin/inventory';
    case 'sales_pos': return '/admin/pos';
    case 'logistics': return '/admin/logistics/queue';
    case 'rider': return '/admin/rider';
    default: return '/';
  }
}

// Already-logged-in visitors shouldn't see the login/register forms again -
// bounce them straight to where they'd end up anyway.
function redirectIfAuthenticated(req, res, next) {
  if (req.session.userId && req.currentUser) {
    return res.redirect(destinationForRole(req.currentUser.role));
  }
  next();
}

async function showRegister(req, res) {
  const locationsByState = await getOperatingLocationsGrouped();
  res.render('auth/register', {
    title: 'Create your account',
    errors: [],
    old: {},
    next: req.query.next || '/',
    locationsByState,
    states: NIGERIA_STATES,
  });
}

async function register(req, res) {
  const { fullName, email, phone, password, confirmPassword, address, city, state, otherLocationNote } = req.body;
  const errors = [];

  if (!fullName || fullName.trim().length < 2) errors.push('Please enter your full name.');
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) errors.push('Please enter a valid email address.');
  if (!phone || phone.trim().length < 7) errors.push('Please enter a valid phone number.');
  if (!password || password.length < 6) errors.push('Password must be at least 6 characters.');
  if (password !== confirmPassword) errors.push('Passwords do not match.');

  if (!errors.length) {
    const existing = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (existing) errors.push('An account with this email already exists. Try logging in instead.');
  }

  if (errors.length) {
    const locationsByState = await getOperatingLocationsGrouped();
    return res.render('auth/register', {
      title: 'Create your account',
      errors,
      old: req.body,
      next: req.body.next || '/',
      locationsByState,
      states: NIGERIA_STATES,
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const verificationToken = crypto.randomBytes(24).toString('hex');
  const user = await User.create({
    fullName: fullName.trim(),
    email: email.toLowerCase().trim(),
    phone: phone.trim(),
    passwordHash,
    address: address ? address.trim() : null,
    // 'Other' means their real city isn't in our operating list yet -
    // otherLocationNote optionally captures what they actually typed,
    // useful for spotting expansion demand.
    city: city ? city.trim() : null,
    state: state ? state.trim() : 'Cross River',
    otherLocationNote: city === 'Other' && otherLocationNote ? otherLocationNote.trim() : null,
    verificationToken,
  });

  // Soft verification: the account works immediately (login and checkout
  // are never blocked on this) - it's just a nudge, tracked via isVerified.
  const verificationUrl = `${process.env.APP_URL}/verify-email?token=${verificationToken}`;
  emailService.sendVerificationEmail(user, verificationUrl);

  req.session.userId = user.id;
  await mergeGuestCartIntoUser(req.sessionID, user.id);

  // registration is customer-only (staff accounts are created by a super_admin),
  // so this always respects wherever they were trying to go
  const next = req.body.next && req.body.next.startsWith('/') ? req.body.next : '/';
  res.redirect(next);
}

async function verifyEmail(req, res) {
  const { token } = req.query;
  if (!token) return res.redirect('/');

  const user = await User.findOne({ where: { verificationToken: token } });
  if (user) {
    user.isVerified = true;
    user.verificationToken = null;
    await user.save();
  }
  res.redirect(req.session.userId ? '/profile?verified=1' : '/login?verified=1');
}

async function resendVerification(req, res) {
  const user = req.currentUser;
  if (!user || user.isVerified) return res.redirect('/profile');

  const verificationToken = crypto.randomBytes(24).toString('hex');
  user.verificationToken = verificationToken;
  await user.save();

  const verificationUrl = `${process.env.APP_URL}/verify-email?token=${verificationToken}`;
  await emailService.sendVerificationEmail(user, verificationUrl);

  res.redirect('/profile?resent=1');
}

function showLogin(req, res) {
  res.render('auth/login', {
    title: 'Log in',
    error: null,
    next: req.query.next || '/',
  });
}

async function login(req, res) {
  const { email, password } = req.body;
  const next = req.body.next && req.body.next.startsWith('/') ? req.body.next : '/';

  const user = await User.findOne({ where: { email: (email || '').toLowerCase().trim() } });
  const passwordOk = user ? await bcrypt.compare(password || '', user.passwordHash) : false;

  if (!user || !passwordOk) {
    return res.render('auth/login', {
      title: 'Log in',
      error: 'Incorrect email or password.',
      next,
    });
  }

  req.session.userId = user.id;
  await mergeGuestCartIntoUser(req.sessionID, user.id);

  const redirectTo = user.role === 'customer'
    ? (req.session.redirectAfterLogin || next)
    : destinationForRole(user.role);
  delete req.session.redirectAfterLogin;
  res.redirect(redirectTo);
}

function logout(req, res) {
  req.session.destroy(() => {
    res.redirect('/');
  });
}

module.exports = { showRegister, register, showLogin, login, logout, redirectIfAuthenticated, verifyEmail, resendVerification };
