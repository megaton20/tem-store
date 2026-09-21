const { Branch, TeamMember, CourierZone, DeliveryZone } = require('../models');
const emailService = require('../services/emailService');

function about(req, res) {
  res.render('pages/about', { title: 'About Us — TEM Store' });
}

function contact(req, res) {
  res.render('pages/contact', { title: 'Contact Us — TEM Store', sent: false, error: null });
}

async function submitContact(req, res) {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.render('pages/contact', {
      title: 'Contact Us — TEM Store',
      sent: false,
      error: 'Please fill in all fields.',
    });
  }
  await emailService.sendContactFormNotification(name, email, message);
  res.render('pages/contact', { title: 'Contact Us — TEM Store', sent: true, error: null });
}

function terms(req, res) {
  res.render('pages/terms', { title: 'Terms & Conditions — TEM Store' });
}

function privacy(req, res) {
  res.render('pages/privacy', { title: 'Privacy Policy — TEM Store' });
}

async function locations(req, res) {
  const branches = await Branch.findAll({
    where: { isActive: true, isPickupEnabled: true },
    order: [['city', 'ASC'], ['name', 'ASC']],
  });
  res.render('pages/locations', { title: 'Our Locations — TEM Store', branches });
}

async function team(req, res) {
  const members = await TeamMember.findAll({ where: { isActive: true }, order: [['sortOrder', 'ASC']] });
  res.render('pages/team', { title: 'Our Team — TEM Store', members });
}

function investors(req, res) {
  res.render('pages/investors', { title: 'For Investors — TEM Store' });
}

async function whereWeShip(req, res) {
  const [courierZones, deliveryZones] = await Promise.all([
    CourierZone.findAll({ where: { isActive: true }, order: [['sortOrder', 'ASC'], ['name', 'ASC']] }),
    DeliveryZone.findAll({ where: { isActive: true }, order: [['state', 'ASC'], ['sortOrder', 'ASC'], ['city', 'ASC']] }),
  ]);
  res.render('pages/where-we-ship', { title: 'Where We Ship — TEM Store', courierZones, deliveryZones });
}

async function loyalty(req, res) {
  const { LoyaltyTier } = require('../models');
  const tiers = await LoyaltyTier.findAll({ where: { isActive: true }, order: [['stageNumber', 'ASC']] });
  res.render('pages/loyalty', { title: 'TEM Rewards — TEM Store', tiers });
}

module.exports = { about, contact, submitContact, terms, privacy, locations, team, investors, whereWeShip, loyalty };
