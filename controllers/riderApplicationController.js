const { RiderApplication } = require('../models');
const settingsService = require('../services/settingsService');
const { getKnownCities } = require('../services/locationService');
const NIGERIA_STATES = require('../utils/nigeriaStates');

async function showApplyForm(req, res) {
  const isOpen = await settingsService.isOpen('rider_applications_open');
  if (!isOpen) {
    return res.render('pages/applications-closed', { title: 'Rider Applications — TEM Store', channel: 'Rider' });
  }

  // Applying requires an account, since the application is tied to it -
  // no separate name/email/phone form to fill in and no way to spoof
  // someone else's identity through this form.
  if (!req.currentUser) {
    return res.render('pages/apply-login-required', {
      title: 'Apply to be a Rider — TEM Store', channel: 'Rider', applyPath: '/apply/rider',
    });
  }

  const existing = await RiderApplication.findOne({
    where: { userId: req.currentUser.id },
    order: [['createdAt', 'DESC']],
  });

  const [cities, states] = await Promise.all([getKnownCities(), NIGERIA_STATES]);
  res.render('pages/apply-rider', {
    title: 'Apply to be a Rider — TEM Store', errors: [], submitted: false, existing, cities, states, old: {},
  });
}

async function submitApplication(req, res) {
  const isOpen = await settingsService.isOpen('rider_applications_open');
  if (!isOpen || !req.currentUser) return res.redirect('/apply/rider');

  const existing = await RiderApplication.findOne({
    where: { userId: req.currentUser.id },
    order: [['createdAt', 'DESC']],
  });
  if (existing && ['pending', 'approved'].includes(existing.status)) {
    const [cities, states] = await Promise.all([getKnownCities(), NIGERIA_STATES]);
    return res.render('pages/apply-rider', {
      title: 'Apply to be a Rider — TEM Store',
      errors: [existing.status === 'approved' ? "You're already a registered rider." : 'You already have an application under review.'],
      submitted: false, existing, cities, states, old: {},
    });
  }

  const { address, city, state, vehicleType, hasValidId, hasSmartphone, yearsExperience, notes } = req.body;
  const errors = [];

  if (!address || !city || !state) errors.push('Please fill in your full address, city, and state.');
  if (!vehicleType) errors.push("Please select what you'll be riding/driving.");
  if (!hasValidId) errors.push('A valid government-issued ID is required to apply.');

  if (errors.length) {
    const [cities, states] = await Promise.all([getKnownCities(), NIGERIA_STATES]);
    return res.render('pages/apply-rider', {
      title: 'Apply to be a Rider — TEM Store', errors, submitted: false, existing, cities, states, old: req.body,
    });
  }

  // Identity comes from the logged-in account, never the submitted form -
  // a snapshot of it at application time, not something the applicant can edit.
  await RiderApplication.create({
    userId: req.currentUser.id,
    fullName: req.currentUser.fullName,
    email: req.currentUser.email,
    phone: req.currentUser.phone,
    address: address.trim(),
    city: city.trim(),
    state: state.trim(),
    vehicleType,
    hasValidId: hasValidId === 'on',
    hasSmartphone: hasSmartphone === 'on',
    yearsExperience: yearsExperience ? parseInt(yearsExperience, 10) : null,
    notes: notes || null,
  });

  res.render('pages/apply-rider', {
    title: 'Apply to be a Rider — TEM Store', errors: [], submitted: true, existing: null, cities: [], states: NIGERIA_STATES, old: {},
  });
}

module.exports = { showApplyForm, submitApplication };
