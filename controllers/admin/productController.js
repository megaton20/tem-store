const slugify = require('slugify');
const { Product, Category, Branch, BranchInventory } = require('../../models');
const inventoryService = require('../../services/inventoryService');
const { uploadImageBuffer } = require('../../services/cloudinaryService');

async function listProducts(req, res) {
  const [products, categories] = await Promise.all([
    Product.findAll({ include: [Category], order: [['createdAt', 'DESC']] }),
    Category.findAll({ order: [['sortOrder', 'ASC']] }),
  ]);
  const branches = await Branch.findAll({ where: { isActive: true }, order: [['name', 'ASC']] });
  res.render('admin/products/index', {
    title: 'Products — Admin', layout: 'admin/layout', products, categories, branches, errors: [],
  });
}

async function createProduct(req, res) {
  const {
    name, description, price, categoryId, imageUrl, visibilityTier,
    fulfillmentType, leadTimeDays, supplierName,
    initialBranchId, initialQuantity,
  } = req.body;

  const errors = [];
  if (!name || !price || !categoryId) errors.push('Name, price, and category are required.');

  if (errors.length) {
    const [products, categories] = await Promise.all([
      Product.findAll({ include: [Category], order: [['createdAt', 'DESC']] }),
      Category.findAll({ order: [['sortOrder', 'ASC']] }),
    ]);
    const branches = await Branch.findAll({ where: { isActive: true }, order: [['name', 'ASC']] });
    return res.render('admin/products/index', {
      title: 'Products — Admin', layout: 'admin/layout', products, categories, branches, errors,
    });
  }

  const slug = slugify(name, { lower: true, strict: true }) + '-' + Date.now().toString(36).slice(-4);

  // Prefer an uploaded file (via Cloudinary); fall back to a pasted URL if no file was chosen.
  let finalImageUrl = imageUrl || null;
  if (req.file) {
    try {
      finalImageUrl = await uploadImageBuffer(req.file.buffer, 'tem-store/products');
    } catch (err) {
      req.session.flashError = `Product created, but the image upload failed: ${err.message}`;
    }
  }

  const product = await Product.create({
    name: name.trim(),
    slug,
    description: description || null,
    price,
    imageUrl: finalImageUrl,
    categoryId,
    visibilityTier: visibilityTier || 'public',
    fulfillmentType: fulfillmentType || 'in_house',
    leadTimeDays: fulfillmentType === 'third_party' ? (leadTimeDays || 7) : 0,
    supplierName: supplierName || null,
    stock: 0,
  });

  // Optionally give it starting stock at one branch right away, so it
  // doesn't sit invisible in inventory management with zero everywhere.
  if (initialBranchId && initialQuantity && Number(initialQuantity) > 0 && product.fulfillmentType === 'in_house') {
    await inventoryService.adjustBranchStock({
      productId: product.id,
      branchId: initialBranchId,
      delta: parseInt(initialQuantity, 10),
      reason: 'production',
      performedByUserId: req.currentUser.id,
      note: 'Initial stock at product creation',
    });
  }

  res.redirect('/admin/products');
}

async function toggleActive(req, res) {
  const product = await Product.findByPk(req.params.id);
  if (product) {
    product.isActive = !product.isActive;
    await product.save();
  }
  res.redirect('/admin/products');
}

module.exports = { listProducts, createProduct, toggleActive };
