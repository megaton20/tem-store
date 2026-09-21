const { Product, Branch, ProductionBatch, VerificationCode } = require('../../models');
const { generateVerificationCode, generateBatchNumber } = require('../../utils/codeGenerator');
const { scopedBranchId } = require('../../middleware/staffAuth');
const inventoryService = require('../../services/inventoryService');

async function listBatches(req, res) {
  const branchId = scopedBranchId(req.currentUser);
  const batches = await ProductionBatch.findAll({
    include: [Product],
    order: [['createdAt', 'DESC']],
    limit: 50,
  });
  res.render('admin/batches/index', { title: 'Production Batches — Admin', layout: 'admin/layout', batches, branchId });
}

async function newBatchForm(req, res) {
  const branchId = scopedBranchId(req.currentUser);
  const [products, branches] = await Promise.all([
    Product.findAll({ where: { isActive: true, fulfillmentType: 'in_house' }, order: [['name', 'ASC']] }),
    branchId ? [] : Branch.findAll({ where: { isActive: true }, order: [['name', 'ASC']] }),
  ]);
  res.render('admin/batches/new', {
    title: 'New Production Batch — Admin', layout: 'admin/layout', products, branches, ownBranchId: branchId, errors: [],
  });
}

async function createBatch(req, res) {
  const branchId = scopedBranchId(req.currentUser);
  const targetBranchId = branchId || req.body.branchId;
  const { productId, quantity, notes } = req.body;

  const errors = [];
  const qty = parseInt(quantity, 10);
  if (!productId) errors.push('Please select a product.');
  if (!targetBranchId) errors.push('Please select a branch.');
  if (!Number.isInteger(qty) || qty <= 0) errors.push('Quantity must be a positive whole number.');

  if (errors.length) {
    const [products, branches] = await Promise.all([
      Product.findAll({ where: { isActive: true, fulfillmentType: 'in_house' }, order: [['name', 'ASC']] }),
      branchId ? [] : Branch.findAll({ where: { isActive: true }, order: [['name', 'ASC']] }),
    ]);
    return res.render('admin/batches/new', {
      title: 'New Production Batch — Admin', layout: 'admin/layout', products, branches, ownBranchId: branchId, errors,
    });
  }

  const product = await Product.findByPk(productId);
  const today = new Date();
  const prefix = product.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 4) || 'PRD';

  let suffix = 'A';
  let batchNumber = generateBatchNumber(prefix, today, suffix);
  while (await ProductionBatch.findOne({ where: { batchNumber } })) {
    suffix = String.fromCharCode(suffix.charCodeAt(0) + 1);
    batchNumber = generateBatchNumber(prefix, today, suffix);
  }

  const batch = await ProductionBatch.create({
    batchNumber,
    productId: product.id,
    quantityProduced: qty,
    producedAt: today.toISOString().slice(0, 10),
    notes: notes || null,
  });

  // generate one unique, single-use code per unit
  const codes = [];
  for (let i = 0; i < qty; i++) {
    let code;
    let attempts = 0;
    do {
      code = generateVerificationCode();
      attempts++;
    } while (await VerificationCode.findOne({ where: { code } }) && attempts < 10);
    codes.push(code);
  }
  await VerificationCode.bulkCreate(codes.map((code) => ({
    code, productId: product.id, batchId: batch.id, status: 'unused',
  })));

  // land the stock at the branch, fully audited
  await inventoryService.adjustBranchStock({
    productId: product.id,
    branchId: targetBranchId,
    delta: qty,
    reason: 'production',
    referenceType: 'ProductionBatch',
    referenceId: batch.id,
    performedByUserId: req.currentUser.id,
    note: `Batch ${batchNumber}`,
  });

  res.redirect(`/admin/batches/${batch.id}/codes`);
}

// Shows the generated codes on-screen (copy/print) plus a CSV download link
async function showCodes(req, res) {
  const batch = await ProductionBatch.findOne({ where: { id: req.params.id }, include: [Product] });
  if (!batch) return res.status(404).render('404', { layout: false });

  const codes = await VerificationCode.findAll({ where: { batchId: batch.id }, order: [['createdAt', 'ASC']] });

  res.render('admin/batches/codes', { title: `Codes for ${batch.batchNumber} — Admin`, layout: 'admin/layout', batch, codes });
}

async function downloadCodesCsv(req, res) {
  const batch = await ProductionBatch.findOne({ where: { id: req.params.id }, include: [Product] });
  if (!batch) return res.status(404).render('404', { layout: false });

  const codes = await VerificationCode.findAll({ where: { batchId: batch.id }, order: [['createdAt', 'ASC']] });
  const header = 'code,product,batch_number\n';
  const rows = codes.map((c) => `${c.code},"${batch.Product.name}",${batch.batchNumber}`).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${batch.batchNumber}.csv"`);
  res.send(header + rows);
}

module.exports = { listBatches, newBatchForm, createBatch, showCodes, downloadCodesCsv };
