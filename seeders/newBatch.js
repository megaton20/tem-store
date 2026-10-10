/**
 * Records a new production batch and generates one unique, single-use
 * verification code per unit produced. Stock lands at a branch (default:
 * the Central Production branch) via the inventory service, so it's
 * logged and ready to transfer out to retail kiosks.
 *
 * Usage:
 *   node seeders/newBatch.js <product-slug> <quantity> [--branch=<branch-slug>] ["notes"]
 *
 * Examples:
 *   node seeders/newBatch.js classic-chocolate-chip 200 "August batch, morning run"
 *   node seeders/newBatch.js classic-chocolate-chip 200 --branch=tem-kiosk-marian-market "Direct to kiosk"
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { sequelize, Product, Branch, ProductionBatch, VerificationCode } = require('../models');
const { generateVerificationCode, generateBatchNumber } = require('../utils/codeGenerator');
const inventoryService = require('../services/inventoryService');

async function run() {
  const rawArgs = process.argv.slice(2);
  const branchFlag = rawArgs.find((a) => a.startsWith('--branch='));
  const branchSlug = branchFlag ? branchFlag.split('=')[1] : 'central-production';
  const positional = rawArgs.filter((a) => !a.startsWith('--branch='));
  const [slug, quantityArg, ...notesParts] = positional;
  const notes = notesParts.join(' ') || null;

  if (!slug || !quantityArg) {
    console.error('Usage: node seeders/newBatch.js <product-slug> <quantity> [--branch=<branch-slug>] ["notes"]');
    process.exit(1);
  }

  const quantity = parseInt(quantityArg, 10);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    console.error('Quantity must be a positive whole number.');
    process.exit(1);
  }

  await sequelize.sync();

  const product = await Product.findOne({ where: { slug } });
  if (!product) {
    console.error(`No product found with slug "${slug}". Check the slug and try again.`);
    process.exit(1);
  }

  const branch = await Branch.findOne({ where: { slug: branchSlug } });
  if (!branch) {
    console.error(`No branch found with slug "${branchSlug}". Run "node seeders/seed.js" first, or check the branch slug.`);
    process.exit(1);
  }

  // Build a short prefix from the product name for the batch number, e.g.
  // "Classic Chocolate Chip" -> "CCC". Falls back to first 3 letters of slug.
  const prefix = product.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4) || slug.slice(0, 3).toUpperCase();

  const today = new Date();

  // Find the next free letter suffix for today's date, so multiple batches
  // of the same product on the same day don't collide (A, B, C...).
  let suffix = 'A';
  let batchNumber = generateBatchNumber(prefix, today, suffix);
  while (await ProductionBatch.findOne({ where: { batchNumber } })) {
    suffix = String.fromCharCode(suffix.charCodeAt(0) + 1);
    batchNumber = generateBatchNumber(prefix, today, suffix);
  }

  const batch = await ProductionBatch.create({
    batchNumber,
    productId: product.id,
    quantityProduced: quantity,
    producedAt: today.toISOString().slice(0, 10),
    notes,
  });

  console.log(`Created batch ${batchNumber} for "${product.name}" (${quantity} units). Generating codes...`);

  const codes = [];
  for (let i = 0; i < quantity; i++) {
    let code;
    let attempts = 0;
    // regenerate on the rare collision rather than trusting randomness blindly
    do {
      code = generateVerificationCode();
      attempts++;
    } while (await VerificationCode.findOne({ where: { code } }) && attempts < 10);

    codes.push(code);
  }

  // Bulk insert for speed on large batches
  await VerificationCode.bulkCreate(
    codes.map((code) => ({
      code,
      productId: product.id,
      batchId: batch.id,
      status: 'unused',
    }))
  );

  // Land the stock at the branch via the audited inventory service - this
  // also keeps Product.stock (the storefront's denormalized total) in sync.
  await inventoryService.adjustBranchStock({
    productId: product.id,
    branchId: branch.id,
    delta: quantity,
    reason: 'production',
    referenceType: 'ProductionBatch',
    referenceId: batch.id,
    note: `Batch ${batchNumber}`,
  });

  // Write codes to a CSV for printing onto labels/stickers
  const exportsDir = path.join(__dirname, '..', 'exports');
  fs.mkdirSync(exportsDir, { recursive: true });
  const csvPath = path.join(exportsDir, `${batchNumber}.csv`);
  const csvContent = ['code,product,batch_number', ...codes.map((c) => `${c},"${product.name}",${batchNumber}`)].join('\n');
  fs.writeFileSync(csvPath, csvContent);

  const updatedProduct = await Product.findByPk(product.id);

  console.log(`\nBatch complete.`);
  console.log(`  Batch number:        ${batchNumber}`);
  console.log(`  Product:             ${product.name}`);
  console.log(`  Units produced:      ${quantity}`);
  console.log(`  Landed at branch:    ${branch.name}`);
  console.log(`  New network total:   ${updatedProduct.stock}`);
  console.log(`  Codes exported to:   ${csvPath}`);
  console.log(`\nTransfer stock from ${branch.name} to retail kiosks via /admin/transfers.`);
  console.log(`Customers can verify any of these codes at /verify.`);

  process.exit(0);
}

run().catch((err) => {
  console.error('Batch creation failed:', err);
  process.exit(1);
});
