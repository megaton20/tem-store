const { Op } = require('sequelize');
const { Product, Category } = require('../models');

async function home(req, res) {
  const flagshipProducts = await Product.findAll({
    where: { isFlagship: true, isActive: true },
    order: [['createdAt', 'ASC']],
    limit: 6,
  });

  const publicCategories = await Category.findAll({
    where: { tier: 'public' },
    order: [['sortOrder', 'ASC']],
  });

  // a handful of non-flagship public products per category, for the "shop more" strip
  const otherProducts = await Product.findAll({
    where: {
      isActive: true,
      isFlagship: false,
      visibilityTier: 'public',
    },
    limit: 8,
    order: [['createdAt', 'DESC']],
  });

  res.render('home', {
    title: 'TEM Store — Second Nature Cookies & More',
    flagshipProducts,
    publicCategories,
    otherProducts,
  });
}

module.exports = { home };
