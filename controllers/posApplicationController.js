const { PosApplication, Branch } = require('../models');
const settingsService = require('../services/settingsService');
const { getOperatingLocationsGrouped } = require('../services/locationService');
const NIGERIA_STATES = require('../utils/nigeriaStates');

async function showApplyForm(req, res) {
  const isOpen = await settingsService.isOpen('pos_applications_open');
  if (!isOpen) {
    return res.render('pages/applications-closed', { title: 'POS Attendant Applications — TEM Store', channel: 'POS Attendant' });
  }

  if (!req.currentUser) {
    return res.render('pages/apply-login-required', {
      title: 'Apply for a POS Role — TEM Store', channel: 'POS Attendant', applyPath: '/apply/pos',
    });
  }

  const existing = await PosApplication.findOne({
    where: { userId: req.currentUser.id },
    order: [['createdAt', 'DESC']],
  });

  const [locationsByState, branches] = await Promise.all([
    getOperatingLocationsGrouped(),
    Branch.findAll({ where: { isActive: true, type: 'kiosk' }, order: [['name', 'ASC']] }),
  ]);
  res.render('pages/apply-pos', {
    title: 'Apply for a POS Role — TEM Store', errors: [], submitted: false, existing, locationsByState, states: NIGERIA_STATES, branches, old: {},
  });
}

async function submitApplication(req, res) {
  const isOpen = await settingsService.isOpen('pos_applications_open');
  if (!isOpen || !req.currentUser) return res.redirect('/apply/pos');

  const existing = await PosApplication.findOne({
    where: { userId: req.currentUser.id },
    order: [['createdAt', 'DESC']],
  });
  if (existing && ['pending', 'approved'].includes(existing.status)) {
    const [locationsByState, branches] = await Promise.all([
      getOperatingLocationsGrouped(),
      Branch.findAll({ where: { isActive: true, type: 'kiosk' }, order: [['name', 'ASC']] }),
    ]);
    return res.render('pages/apply-pos', {
      title: 'Apply for a POS Role — TEM Store',
      errors: [existing.status === 'approved' ? "You're already on staff for POS." : 'You already have an application under review.'],
      submitted: false, existing, locationsByState, states: NIGERIA_STATES, branches, old: {},
    });
  }

  const { address, city, state, hasSmartphone, hasRetailExperience, yearsExperience, preferredBranchId, notes, otherLocationNote } = req.body;
  const errors = [];
  if (!address || !city || !state) errors.push('Please fill in your full address, city, and state.');

  if (errors.length) {
    const [locationsByState, branches] = await Promise.all([
      getOperatingLocationsGrouped(),
      Branch.findAll({ where: { isActive: true, type: 'kiosk' }, order: [['name', 'ASC']] }),
    ]);
    return res.render('pages/apply-pos', {
      title: 'Apply for a POS Role — TEM Store', errors, submitted: false, existing, locationsByState, states: NIGERIA_STATES, branches, old: req.body,
    });
  }

  await PosApplication.create({
    userId: req.currentUser.id,
    fullName: req.currentUser.fullName,
    email: req.currentUser.email,
    phone: req.currentUser.phone,
    address: address.trim(),
    city: city.trim(),
    state: state.trim(),
    hasSmartphone: hasSmartphone === 'on',
    hasRetailExperience: hasRetailExperience === 'on',
    yearsExperience: yearsExperience ? parseInt(yearsExperience, 10) : null,
    preferredBranchId: preferredBranchId || null,
    notes: notes || null,
  });

  res.render('pages/apply-pos', {
    title: 'Apply for a POS Role — TEM Store', errors: [], submitted: true, existing: null, locationsByState: {}, states: NIGERIA_STATES, branches: [], old: {},
  });
}

module.exports = { showApplyForm, submitApplication };
