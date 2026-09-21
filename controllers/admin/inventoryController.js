const { Op } = require('sequelize');
const { BranchInventory, Branch, Product, Category } = require('../../models');
const { scopedBranchId } = require('../../middleware/staffAuth');
const inventoryService = require('../../services/inventoryService');

async function listInventory(req, res) {
  const branchId = scopedBranchId(req.currentUser);
  const filterBranchId = req.query.branchId || branchId;

  const where = filterBranchId ? { branchId: filterBranchId } : {};
  const [rows, branches] = await Promise.all([
    BranchInventory.findAll({
      where,
      include: [{ model: Product, include: [Category] }, Branch],
      order: [[Product, 'name', 'ASC']],
    }),
    branchId ? [] : Branch.findAll({ where: { isActive: true }, order: [['name', 'ASC']] }),
  ]);

  // Group into { "Category Name": [rows...] } so the page reads by department/category
  // rather than one flat list - "Uncategorized" catches products with no category set.
  const grouped = {};
  rows.forEach((row) => {
    const catName = row.Product && row.Product.Category ? row.Product.Category.name : 'Uncategorized';
    if (!grouped[catName]) grouped[catName] = [];
    grouped[catName].push(row);
  });

  // Products this branch has never stocked yet - can't "adjust" something
  // with no row, so this powers the "Add Product to Inventory" form.
  let unstockedProducts = [];
  if (filterBranchId) {
    const stockedProductIds = rows.map((r) => r.productId);
    unstockedProducts = await Product.findAll({
      where: {
        isActive: true,
        fulfillmentType: 'in_house',
        ...(stockedProductIds.length ? { id: { [Op.notIn]: stockedProductIds } } : {}),
      },
      order: [['name', 'ASC']],
    });
  }

  res.render('admin/inventory/index', {
    title: 'Inventory — Admin',
    layout: 'admin/layout',
    grouped,
    branches,
    filterBranchId,
    unstockedProducts,
    scopedToOwnBranch: !!branchId,
  });
}

async function adjustStock(req, res) {
  const { productId, branchId, delta, note } = req.body;
  const allowedBranchId = scopedBranchId(req.currentUser);

  // staff scoped to a branch can only ever adjust their own branch's stock
  if (allowedBranchId && allowedBranchId !== branchId) {
    return res.status(403).render('admin/forbidden', { layout: false });
  }

  try {
    await inventoryService.adjustBranchStock({
      productId,
      branchId,
      delta: parseInt(delta, 10),
      reason: 'adjustment',
      performedByUserId: req.currentUser.id,
      note: note || 'Manual adjustment via admin panel',
    });
  } catch (err) {
    // stock going negative, etc - surface it and bounce back
    req.session.flashError = err.message;
  }

  res.redirect(`/admin/inventory${branchId ? '?branchId=' + branchId : ''}`);
}

// Adds a product to this branch's inventory for the first time (no
// existing BranchInventory row) - the counterpart to adjustStock, which
// only works on rows that already exist.
async function addToInventory(req, res) {
  const { productId, branchId, quantity } = req.body;
  const allowedBranchId = scopedBranchId(req.currentUser);

  if (allowedBranchId && allowedBranchId !== branchId) {
    return res.status(403).render('admin/forbidden', { layout: false });
  }

  const qty = parseInt(quantity, 10);
  if (!productId || !branchId || !Number.isInteger(qty) || qty <= 0) {
    req.session.flashError = 'Please select a product and enter a valid starting quantity.';
    return res.redirect(`/admin/inventory${branchId ? '?branchId=' + branchId : ''}`);
  }

  try {
    await inventoryService.adjustBranchStock({
      productId,
      branchId,
      delta: qty,
      reason: 'production',
      performedByUserId: req.currentUser.id,
      note: 'Added to branch inventory for the first time',
    });
  } catch (err) {
    req.session.flashError = err.message;
  }

  res.redirect(`/admin/inventory?branchId=${branchId}`);
}

module.exports = { listInventory, adjustStock, addToInventory };
