const slugify = require('slugify');
const { Product, Category, Branch, BranchInventory, OrderItem, CartItem } = require('../../models');
const inventoryService = require('../../services/inventoryService');
const { uploadImageBuffer } = require('../../services/cloudinaryService');
const { hasPermission } = require('../../middleware/staffAuth');

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

async function showProduct(req, res) {
  const product = await Product.findByPk(req.params.id, { include: [Category] });
  if (!product) return res.redirect('/admin/products');

  const [categories, branches, cartUsage, orderUsage] = await Promise.all([
    Category.findAll({ order: [['sortOrder', 'ASC']] }),
    Branch.findAll({ where: { isActive: true }, order: [['name', 'ASC']] }),
    CartItem.count({ where: { productId: product.id } }),
    OrderItem.count({ where: { productId: product.id } }),
  ]);

  res.render('admin/products/show', {
    title: `${product.name} — Admin`,
    layout: 'admin/layout',
    product, categories, branches, cartUsage, orderUsage,
    errors: [],
  });
}

// ---------- image helpers ----------
async function resolvePrimaryImage(req, currentUrl) {
  // explicit clear wins only if no new file was provided
  if (String(req.body.clearPrimary) === '1' && !req.files?.imageFile?.[0]) {
    return null;
  }
  if (req.files?.imageFile?.[0]) {
    try {
      return await uploadImageBuffer(req.files.imageFile[0].buffer, 'tem-store/products');
    } catch (err) {
      req.session.flashError = `Saved, but the primary image upload failed: ${err.message}`;
      return currentUrl;
    }
  }
  if (req.body.imageUrl !== undefined && String(req.body.clearPrimary) !== '1') {
    return req.body.imageUrl || null;
  }
  return currentUrl;
}

async function resolveGallery(req, currentGallery) {
  let gallery = Array.isArray(currentGallery) ? [...currentGallery] : [];
  const toRemove = [].concat(req.body.removeGallery || []);
  gallery = gallery.filter((url) => !toRemove.includes(url));

  if (req.files?.imageFiles?.length) {
    for (const file of req.files.imageFiles) {
      try {
        gallery.push(await uploadImageBuffer(file.buffer, 'tem-store/products'));
      } catch (err) {
        req.session.flashError = `Saved, but a gallery image failed to upload: ${err.message}`;
      }
    }
  }
  return gallery;
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
  const finalImageUrl = await resolvePrimaryImage(req, imageUrl || null);
  const gallery = await resolveGallery(req, []);

  const product = await Product.create({
    name: name.trim(),
    slug,
    description: description || null,
    price,
    imageUrl: finalImageUrl,
    gallery,
    categoryId,
    visibilityTier: visibilityTier || 'public',
    fulfillmentType: fulfillmentType || 'in_house',
    leadTimeDays: fulfillmentType === 'third_party' ? (leadTimeDays || 7) : 0,
    supplierName: supplierName || null,
    stock: 0,
  });

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

async function updateProduct(req, res) {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.redirect('/admin/products');

  const {
    name, description, price, categoryId, imageUrl, visibilityTier,
    fulfillmentType, leadTimeDays, supplierName,
  } = req.body;

  const errors = [];
  if (!name || !categoryId) errors.push('Name and category are required.');
  if (hasPermission(req.currentUser, 'products') && !price) errors.push('Price is required.');

  if (errors.length) {
    const [categories, branches, cartUsage, orderUsage] = await Promise.all([
      Category.findAll({ order: [['sortOrder', 'ASC']] }),
      Branch.findAll({ where: { isActive: true }, order: [['name', 'ASC']] }),
      CartItem.count({ where: { productId: product.id } }),
      OrderItem.count({ where: { productId: product.id } }),
    ]);
    return res.render('admin/products/show', {
      title: `${product.name} — Admin`, layout: 'admin/layout',
      product, categories, branches, cartUsage, orderUsage, errors,
    });
  }

  const finalImageUrl = await resolvePrimaryImage(req, product.imageUrl);
  const gallery = await resolveGallery(req, product.gallery);

  if (name.trim() !== product.name) {
    product.slug = slugify(name, { lower: true, strict: true }) + '-' + Date.now().toString(36).slice(-4);
  }

  const editable = {
    name: name.trim(),
    description: description || null,
    imageUrl: finalImageUrl,
    gallery,
    categoryId,
  };

  if (hasPermission(req.currentUser, 'products')) {
    Object.assign(editable, {
      price,
      visibilityTier: visibilityTier || 'public',
      fulfillmentType: fulfillmentType || 'in_house',
      leadTimeDays: fulfillmentType === 'third_party' ? (leadTimeDays || 7) : 0,
      supplierName: supplierName || null,
    });
  }

  await product.update(editable);

  res.redirect(`/admin/products/${product.id}`);
}

async function toggleActive(req, res) {
  const product = await Product.findByPk(req.params.id);
  if (product) {
    product.isActive = !product.isActive;
    await product.save();
  }
  res.redirect('/admin/products');
}

async function deleteProduct(req, res) {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.redirect('/admin/products');

  await CartItem.destroy({ where: { productId: product.id } });

  const orderUsage = await OrderItem.count({ where: { productId: product.id } });

  if (orderUsage > 0) {
    product.isActive = false;
    await product.save();
    req.session.flashError = `“${product.name}” appears in ${orderUsage} past order${orderUsage === 1 ? '' : 's'}, so it was deactivated instead of deleted.`;
    return res.redirect('/admin/products');
  }

  await BranchInventory.destroy({ where: { productId: product.id } });
  await product.destroy();

  res.redirect('/admin/products');
}

module.exports = { listProducts, showProduct, createProduct, updateProduct, toggleActive, deleteProduct };