const { Op } = require('sequelize');
const { sequelize, StockTransfer, Branch, Product, User } = require('../../models');
const { scopedBranchId } = require('../../middleware/staffAuth');
const inventoryService = require('../../services/inventoryService');

async function listTransfers(req, res) {
  const branchId = scopedBranchId(req.currentUser);

  const scopeWhere = branchId
    ? { [Op.or]: [{ fromBranchId: branchId }, { toBranchId: branchId }] }
    : {};

  const include = [
    Product,
    { model: Branch, as: 'fromBranch' },
    { model: Branch, as: 'toBranch' },
    { model: User, as: 'initiatedBy' },
    { model: User, as: 'receivedBy' },
  ];

  const [pendingIncoming, pendingOutgoing, history, branches, products] = await Promise.all([
    // Transfers THIS branch needs to confirm receipt of (or, for
    // super_admin, every pending incoming transfer network-wide).
    StockTransfer.findAll({
      where: { status: 'pending', ...(branchId ? { toBranchId: branchId } : {}) },
      include,
      order: [['createdAt', 'ASC']],
    }),
    // Transfers THIS branch sent that are still waiting on the other side -
    // shown so a sender can see what's outstanding and cancel if needed.
    StockTransfer.findAll({
      where: { status: 'pending', ...(branchId ? { fromBranchId: branchId } : { id: { [Op.in]: [] } }) },
      include,
      order: [['createdAt', 'ASC']],
    }),
    StockTransfer.findAll({
      where: { ...scopeWhere, status: { [Op.in]: ['completed', 'cancelled'] } },
      include,
      order: [['createdAt', 'DESC']],
      limit: 50,
    }),
    Branch.findAll({ where: { isActive: true }, order: [['name', 'ASC']] }),
    Product.findAll({ where: { isActive: true, fulfillmentType: 'in_house' }, order: [['name', 'ASC']] }),
  ]);

  res.render('admin/transfers/index', {
    title: 'Stock Transfers — Admin',
    layout: 'admin/layout',
    pendingIncoming,
    pendingOutgoing,
    history,
    branches,
    products,
    ownBranchId: branchId,
  });
}

async function createTransfer(req, res) {
  const { productId, fromBranchId, toBranchId, quantity, notes } = req.body;
  const ownBranchId = scopedBranchId(req.currentUser);
  const qty = parseInt(quantity, 10);

  if (ownBranchId) {
    // Branch-scoped staff can only ever SEND from their own branch, or
    // receive a fresh production intake (no fromBranchId) landing at
    // their own branch - never move stock between two OTHER branches.
    if (fromBranchId && fromBranchId !== ownBranchId) {
      return res.status(403).render('admin/forbidden', { layout: false });
    }
    if (!fromBranchId && toBranchId !== ownBranchId) {
      return res.status(403).render('admin/forbidden', { layout: false });
    }
  }

  if (!Number.isInteger(qty) || qty <= 0) {
    req.session.flashError = 'Quantity must be a positive whole number.';
    return res.redirect('/admin/transfers');
  }

  try {
    if (fromBranchId) {
      // A real branch-to-branch transfer: stays pending until the
      // receiving branch confirms it - no stock moves yet.
      await StockTransfer.create({
        productId,
        fromBranchId,
        toBranchId,
        quantity: qty,
        notes: notes || null,
        status: 'pending',
        initiatedByUserId: req.currentUser.id,
      });
    } else {
      // Fresh production intake, not coming from another branch's stock -
      // nothing to confirm receipt of, so this lands immediately.
      const transfer = await StockTransfer.create({
        productId,
        fromBranchId: null,
        toBranchId,
        quantity: qty,
        notes: notes || null,
        status: 'completed',
        initiatedByUserId: req.currentUser.id,
        receivedByUserId: req.currentUser.id,
        receivedAt: new Date(),
      });
      await inventoryService.adjustBranchStock({
        productId,
        branchId: toBranchId,
        delta: qty,
        reason: 'production',
        referenceType: 'StockTransfer',
        referenceId: transfer.id,
        performedByUserId: req.currentUser.id,
      });
    }
  } catch (err) {
    req.session.flashError = err.message;
  }

  res.redirect('/admin/transfers');
}

// The receiving branch confirms the stock actually arrived - THIS is when
// the sender's stock is deducted and the receiver's is credited, not at
// send time. Keeps both branches' counts honest: the sender still shows
// the stock as theirs (sellable) right up until someone at the other end
// confirms it physically arrived.
async function receiveTransfer(req, res) {
  const ownBranchId = scopedBranchId(req.currentUser);
  const transfer = await StockTransfer.findOne({ where: { id: req.params.id, status: 'pending' } });

  if (!transfer) {
    req.session.flashError = 'That transfer is no longer pending.';
    return res.redirect('/admin/transfers');
  }
  if (ownBranchId && transfer.toBranchId !== ownBranchId) {
    return res.status(403).render('admin/forbidden', { layout: false });
  }

  const t = await sequelize.transaction();
  try {
    await inventoryService.adjustBranchStock(
      {
        productId: transfer.productId,
        branchId: transfer.fromBranchId,
        delta: -transfer.quantity,
        reason: 'transfer_out',
        referenceType: 'StockTransfer',
        referenceId: transfer.id,
        performedByUserId: req.currentUser.id,
      },
      t
    );
    await inventoryService.adjustBranchStock(
      {
        productId: transfer.productId,
        branchId: transfer.toBranchId,
        delta: transfer.quantity,
        reason: 'transfer_in',
        referenceType: 'StockTransfer',
        referenceId: transfer.id,
        performedByUserId: req.currentUser.id,
      },
      t
    );

    transfer.status = 'completed';
    transfer.receivedByUserId = req.currentUser.id;
    transfer.receivedAt = new Date();
    await transfer.save({ transaction: t });

    await t.commit();
  } catch (err) {
    await t.rollback();
    // Most likely cause: the sending branch no longer has enough stock
    // (sold via POS, adjusted, etc. since the transfer was sent). Leaves
    // the transfer pending rather than silently completing it wrong.
    req.session.flashError = `Couldn't confirm this transfer: ${err.message}`;
  }

  res.redirect('/admin/transfers');
}

// Either side of a still-pending transfer can call it off - nothing has
// moved yet, so cancelling is just marking it dead, no stock to reverse.
async function cancelTransfer(req, res) {
  const ownBranchId = scopedBranchId(req.currentUser);
  const transfer = await StockTransfer.findOne({ where: { id: req.params.id, status: 'pending' } });

  if (!transfer) {
    req.session.flashError = 'That transfer is no longer pending.';
    return res.redirect('/admin/transfers');
  }
  if (ownBranchId && transfer.fromBranchId !== ownBranchId && transfer.toBranchId !== ownBranchId) {
    return res.status(403).render('admin/forbidden', { layout: false });
  }

  transfer.status = 'cancelled';
  transfer.cancelledByUserId = req.currentUser.id;
  await transfer.save();

  res.redirect('/admin/transfers');
}

module.exports = { listTransfers, createTransfer, receiveTransfer, cancelTransfer };
