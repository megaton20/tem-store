const { Op } = require('sequelize');
const { Product, Category } = require('../models');

// Public shop grid - only ever shows public-tier products.
// Discreet items are reachable by direct link only (see discreetShop below).
async function listPublic(req, res) {
  const { category, search, minPrice, maxPrice, sort } = req.query;
  const where = { isActive: true, visibilityTier: 'public' };

  let activeCategory = null;
  if (category) {
    activeCategory = await Category.findOne({ where: { slug: category, tier: 'public' } });
    if (activeCategory) where.categoryId = activeCategory.id;
  }

  if (search) {
    where.name = { [Op.iLike]: `%${search.trim()}%` };
  }
  if (minPrice) where.price = { ...(where.price || {}), [Op.gte]: Number(minPrice) };
  if (maxPrice) where.price = { ...(where.price || {}), [Op.lte]: Number(maxPrice) };

  const sortOptions = {
    price_asc: [['price', 'ASC']],
    price_desc: [['price', 'DESC']],
    name_asc: [['name', 'ASC']],
    newest: [['createdAt', 'DESC']],
  };
  const order = sortOptions[sort] || sortOptions.newest;

  const [products, categories] = await Promise.all([
    Product.findAll({ where, order }),
    Category.findAll({ where: { tier: 'public' }, order: [['sortOrder', 'ASC']] }),
  ]);

  res.render('products/index', {
    title: 'Shop — TEM Store',
    products,
    categories,
    activeCategory,
    search: search || '',
    minPrice: minPrice || '',
    maxPrice: maxPrice || '',
    sort: sort || 'newest',
  });
}

// Discreet category - never linked from nav/search. Reached only via direct URL.
async function discreetShop(req, res) {
  const products = await Product.findAll({
    where: { isActive: true, visibilityTier: 'discreet' },
    order: [['createdAt', 'DESC']],
  });
  res.render('products/index', {
    title: 'TEM Store',
    products,
    categories: [],
    activeCategory: null,
    discreet: true,
  });
}

async function show(req, res) {
  const product = await Product.findOne({
    where: { slug: req.params.slug, isActive: true },
    include: [{ model: Category }],
  });

  if (!product || product.visibilityTier === 'exclusive') {
    return res.status(404).render('404', { layout: false });
  }

  res.render('products/show', {
    title: `${product.name} — TEM Store`,
    product,
  });
}

module.exports = { listPublic, discreetShop, show };
