const { Op } = require('sequelize');
const { Product, SubscriptionTier, UserSubscription } = require('../models');
const paystack = require('../services/paystack');

// This page IS okay to be linked/visible - it's the "subscribe here" gate.
// Only the vault CONTENTS behind requireVaultAccess are hidden from non-subscribers.
async function showRedeem(req, res) {
  const tier = await SubscriptionTier.findOne({ where: { isActive: true } });
  let currentSub = null;
  if (req.session.userId) {
    currentSub = await UserSubscription.findOne({
      where: {
        userId: req.session.userId,
        status: { [Op.in]: ['active', 'grace'] },
        graceEndsAt: { [Op.gt]: new Date() },
      },
      order: [['expiresAt', 'DESC']],
    });
  }
  res.render('vault/redeem', {
    title: 'TEM Vault — Exclusive Access',
    tier,
    currentSub,
  });
}

async function initiateSubscription(req, res) {
  const tier = await SubscriptionTier.findByPk(req.body.tierId);
  if (!tier) return res.redirect('/vault/redeem');

  const reference = `VAULT-${req.currentUser.id.slice(0, 8)}-${Date.now()}`;

  try {
    const initResult = await paystack.initializeTransaction({
      email: req.currentUser.email,
      amountNaira: Number(tier.price),
      reference,
      callbackUrl: `${process.env.APP_URL}/vault/callback`,
      metadata: { tierId: tier.id, userId: req.currentUser.id, purpose: 'vault_subscription' },
    });
    return res.redirect(initResult.data.authorization_url);
  } catch (err) {
    return res.redirect('/vault/redeem?error=payment');
  }
}

async function subscriptionCallback(req, res) {
  const { reference } = req.query;
  if (!reference) return res.redirect('/vault/redeem');

  try {
    const result = await paystack.verifyTransaction(reference);
    if (result.data.status !== 'success') {
      return res.redirect('/vault/redeem?failed=1');
    }

    const tierId = result.data.metadata.tierId;
    const tier = await SubscriptionTier.findByPk(tierId);
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + tier.durationMonths);
    const graceEndsAt = new Date(expiresAt);
    graceEndsAt.setDate(graceEndsAt.getDate() + tier.gracePeriodDays);

    await UserSubscription.create({
      userId: req.currentUser.id,
      tierId: tier.id,
      startedAt: now,
      expiresAt,
      graceEndsAt,
      status: 'active',
      paymentReference: reference,
    });

    return res.redirect('/vault?welcome=1');
  } catch (err) {
    return res.redirect('/vault/redeem?failed=1');
  }
}

// Protected by requireVaultAccess middleware in routes/vault.js
async function showVault(req, res) {
  const products = await Product.findAll({
    where: { isActive: true, visibilityTier: 'exclusive' },
    order: [['createdAt', 'DESC']],
  });
  res.render('vault/index', {
    title: 'The Vault — TEM Store',
    products,
    subscription: req.vaultSubscription,
    welcome: req.query.welcome === '1',
  });
}

module.exports = { showRedeem, initiateSubscription, subscriptionCallback, showVault };
