const { Op } = require('sequelize');
const { UserSubscription } = require('../models');

// Vault stays invisible to anyone without access - a 404, not a "locked" page,
// so the section's existence isn't advertised to people who don't have it.
async function requireVaultAccess(req, res, next) {
  if (!req.session.userId) {
    return res.status(404).render('404', { layout: false });
  }

  const sub = await UserSubscription.findOne({
    where: {
      userId: req.session.userId,
      status: { [Op.in]: ['active', 'grace'] },
      graceEndsAt: { [Op.gt]: new Date() },
    },
    order: [['expiresAt', 'DESC']],
  });

  if (!sub) {
    return res.status(404).render('404', { layout: false });
  }

  // keep status fresh even if the daily cron hasn't run yet
  const now = new Date();
  sub.status = now > sub.expiresAt ? 'grace' : 'active';
  req.vaultSubscription = sub;
  res.locals.vaultSubscription = sub;
  next();
}

module.exports = { requireVaultAccess };
