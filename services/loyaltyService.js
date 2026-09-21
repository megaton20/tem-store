const { sequelize, User, LoyaltyTier, LoyaltyReward, Order } = require('../models');
const { generateVerificationCode } = require('../utils/codeGenerator');

/**
 * Called the moment an order reaches 'completed' - the purchase only
 * counts toward loyalty once it's actually been delivered/picked up,
 * not just paid for. Idempotent via Order.loyaltyAwarded, since
 * 'completed' can be reached from more than one code path (admin panel,
 * rider delivery flow).
 */
async function recordCompletedPurchase(order) {
  if (order.loyaltyAwarded || !order.userId) return;

  const t = await sequelize.transaction();
  try {
    const user = await User.findByPk(order.userId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) { await t.rollback(); return; }

    user.loyaltyPurchaseCount += 1;
    await user.save({ transaction: t });

    order.loyaltyAwarded = true;
    await order.save({ transaction: t });

    // Award any tier the customer has now reached for the first time -
    // a customer could cross more than one threshold in a single jump
    // if tiers are close together, so check all of them, not just the next one.
    const tiers = await LoyaltyTier.findAll({
      where: { isActive: true },
      transaction: t,
    });
    const qualifying = tiers.filter((tier) => tier.purchasesRequired <= user.loyaltyPurchaseCount);

    for (const tier of qualifying) {
      const existing = await LoyaltyReward.findOne({ where: { userId: user.id, tierId: tier.id }, transaction: t });
      if (existing) continue;

      await LoyaltyReward.create(
        {
          userId: user.id,
          tierId: tier.id,
          redemptionCode: `LOY-${generateVerificationCode().replace('TEM-', '')}`,
          status: 'earned',
          earnedAt: new Date(),
        },
        { transaction: t }
      );
    }

    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

/**
 * Staff-facing redemption - a customer shows their code in person (at a
 * kiosk counter, or to a rider) and staff enters it here to mark the
 * reward given out. Single-use: a second attempt with the same code
 * fails since status is no longer 'earned'.
 */
async function redeemReward(code, staffUserId) {
  const reward = await LoyaltyReward.findOne({ where: { redemptionCode: code.trim().toUpperCase() } });
  if (!reward) throw new Error('No reward found with that code.');
  if (reward.status === 'redeemed') throw new Error('This reward has already been redeemed.');

  reward.status = 'redeemed';
  reward.redeemedAt = new Date();
  reward.redeemedByUserId = staffUserId;
  await reward.save();

  return reward;
}

module.exports = { recordCompletedPurchase, redeemReward };
