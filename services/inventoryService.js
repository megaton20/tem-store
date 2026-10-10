const { sequelize, Branch, BranchInventory, InventoryLog, Product } = require('../models');

/**
 * The single choke point for every stock change in the system. Whether
 * it's a production batch landing, a transfer between branches, an online
 * order being fulfilled, or a POS walk-in sale - it goes through here so
 * every movement is logged and Product.stock (the denormalized network
 * total) never drifts out of sync with the branch-level truth.
 *
 * delta: positive to add stock, negative to remove it.
 * Throws if a negative delta would take a branch below zero.
 */
async function adjustBranchStock(
  { productId, branchId, delta, reason, referenceType = null, referenceId = null, performedByUserId = null, note = null },
  transaction = null
) {
  const t = transaction || (await sequelize.transaction());
  const ownTransaction = !transaction;

  try {
    let inventory = await BranchInventory.findOne({
      where: { productId, branchId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!inventory) {
      inventory = await BranchInventory.create(
        { productId, branchId, quantity: 0 },
        { transaction: t }
      );
    }

    const newQuantity = inventory.quantity + delta;
    if (newQuantity < 0) {
      throw new Error(
        `Insufficient stock at this branch (have ${inventory.quantity}, tried to remove ${Math.abs(delta)}).`
      );
    }

    inventory.quantity = newQuantity;
    await inventory.save({ transaction: t });

    await InventoryLog.create(
      {
        productId,
        branchId,
        delta,
        resultingQuantity: newQuantity,
        reason,
        referenceType,
        referenceId,
        performedByUserId,
        note,
      },
      { transaction: t }
    );

    // Keep Product.stock as a fast-to-read sum across all branches -
    // used for storefront display only, never for fulfillment decisions.
    const product = await Product.findByPk(productId, { transaction: t, lock: t.LOCK.UPDATE });
    if (product) {
      product.stock = Math.max(0, product.stock + delta);
      await product.save({ transaction: t });
    }

    if (ownTransaction) await t.commit();
    return inventory;
  } catch (err) {
    if (ownTransaction) await t.rollback();
    throw err;
  }
}

async function getBranchStock(productId, branchId) {
  const inventory = await BranchInventory.findOne({ where: { productId, branchId } });
  return inventory ? inventory.quantity : 0;
}

/**
 * Checks whether a branch can fully cover a cart (every line item, in the
 * quantity requested). Used both for pickup validation and delivery
 * fulfillment scoring.
 */
async function branchCanFulfill(branchId, items) {
  for (const item of items) {
    const stock = await getBranchStock(item.productId, branchId);
    if (stock < item.quantity) return false;
  }
  return true;
}

/**
 * THE FULFILLMENT ALGORITHM for home-delivery online orders.
 *
 * Priority order:
 *   1. Active, fulfillment-enabled branches in the customer's own state
 *      that can fully cover the cart - prefer the one with the most
 *      total spare stock across the cart (least likely to run out next).
 *   2. If no branch in-state can fully cover it, fall back to any active,
 *      fulfillment-enabled branch nationwide that can fully cover it
 *      (e.g. a central warehouse), same scoring.
 *   3. If nothing can fully cover it, return null - caller should reject
 *      the order or offer partial fulfillment/backorder (not automated here).
 *
 * This intentionally does NOT split one order across multiple branches -
 * keeping fulfillment single-branch keeps picking, packing, and courier
 * handoff simple as you scale to more locations.
 */
async function findFulfillingBranch(items, customerState, customerCity = null) {
  const activeBranches = await Branch.findAll({
    where: { isActive: true, isFulfillmentEnabled: true },
  });

  const scoreBranch = async (branch) => {
    if (!(await branchCanFulfill(branch.id, items))) return null;
    let spare = 0;
    for (const item of items) {
      const stock = await getBranchStock(item.productId, branch.id);
      spare += stock - item.quantity;
    }
    return { branch, spare };
  };

  const pickBest = (branches) => {
    return Promise.all(branches.map(scoreBranch)).then((scored) => {
      const valid = scored.filter(Boolean);
      if (!valid.length) return null;
      valid.sort((a, b) => b.spare - a.spare);
      return valid[0].branch;
    });
  };

  // Same city first (closest, cheapest to actually deliver from), then
  // same state, then anywhere active - each tier only checked if the one
  // before it comes up empty.
  if (customerCity) {
    const inCity = activeBranches.filter((b) => b.state === customerState && b.city === customerCity);
    const cityMatch = await pickBest(inCity);
    if (cityMatch) return cityMatch;
  }

  const inState = activeBranches.filter((b) => b.state === customerState);
  const stateMatch = await pickBest(inState);
  if (stateMatch) return stateMatch;

  return pickBest(activeBranches);
}

/**
 * Deducts stock for every line item in a paid order, from the order's
 * assigned branch. Called once, right after payment is confirmed.
 */
async function fulfillOrder(order, items, performedByUserId = null) {
  const t = await sequelize.transaction();
  try {
    for (const item of items) {
      const product = await Product.findByPk(item.productId, { transaction: t });
      if (product && product.fulfillmentType === 'third_party') continue; // sourced on order, not branch stock
      await adjustBranchStock(
        {
          productId: item.productId,
          branchId: order.branchId,
          delta: -item.quantity,
          reason: order.source === 'pos' ? 'pos_sale' : 'online_order',
          referenceType: 'Order',
          referenceId: order.id,
          performedByUserId,
        },
        t
      );
    }
    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

/**
 * Reverses a fulfilled order's stock deduction (e.g. on cancellation
 * after payment). Adds the stock back to the branch it was taken from.
 */
async function reverseOrderFulfillment(order, items, performedByUserId = null) {
  const t = await sequelize.transaction();
  try {
    for (const item of items) {
      const product = await Product.findByPk(item.productId, { transaction: t });
      if (product && product.fulfillmentType === 'third_party') continue;
      await adjustBranchStock(
        {
          productId: item.productId,
          branchId: order.branchId,
          delta: item.quantity,
          reason: 'order_cancelled',
          referenceType: 'Order',
          referenceId: order.id,
          performedByUserId,
        },
        t
      );
    }
    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

module.exports = {
  adjustBranchStock,
  getBranchStock,
  branchCanFulfill,
  findFulfillingBranch,
  fulfillOrder,
  reverseOrderFulfillment,
};
