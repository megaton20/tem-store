const { Op } = require('sequelize');
const { UserSubscription, User } = require('../models');
const emailService = require('./emailService');

/**
 * Sends a vault expiry reminder to anyone whose subscription expires
 * within the next 3 days (or who just entered their grace period),
 * once per subscription - reminderSentAt guards against re-sending on
 * every run.
 */
async function sendVaultExpiryReminders() {
  const now = new Date();
  const threeDaysOut = new Date(now);
  threeDaysOut.setDate(threeDaysOut.getDate() + 3);

  const dueSoon = await UserSubscription.findAll({
    where: {
      status: { [Op.in]: ['active', 'grace'] },
      expiresAt: { [Op.lte]: threeDaysOut },
      graceEndsAt: { [Op.gt]: now },
      reminderSentAt: null,
    },
  });

  for (const sub of dueSoon) {
    const user = await User.findByPk(sub.userId);
    if (!user) continue;
    const daysLeft = Math.ceil((new Date(sub.expiresAt) - now) / (1000 * 60 * 60 * 24));
    await emailService.sendVaultExpiryReminder(user, sub, daysLeft);
    sub.reminderSentAt = now;
    await sub.save();
  }

  return dueSoon.length;
}

/**
 * Kicks off the daily job loop. Runs once immediately on boot, then every
 * 24 hours. Fine for a single-instance deployment - if this ever runs on
 * multiple instances, move to a real job queue so reminders aren't sent twice.
 */
function startDailyJobs() {
  const runAll = async () => {
    try {
      const sent = await sendVaultExpiryReminders();
      if (sent) console.log(`[scheduler] Sent ${sent} vault expiry reminder(s).`);
    } catch (err) {
      console.error('[scheduler] Daily job failed:', err);
    }
  };

  runAll();
  setInterval(runAll, 24 * 60 * 60 * 1000);
}

module.exports = { startDailyJobs, sendVaultExpiryReminders };
