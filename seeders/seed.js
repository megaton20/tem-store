require('dotenv').config();
const bcrypt = require('bcryptjs');
const slugify = require('slugify');
const {
  sequelize, Category, Product, Branch, DeliveryZone, SubscriptionTier, User, BranchInventory, TeamMember, CourierZone, LoyaltyTier,
} = require('../models');
const inventoryService = require('../services/inventoryService');

// Safe to call multiple times - everything below uses findOrCreate, so it
// never duplicates rows. Called both from `npm run seed` (CLI) and
// automatically from server.js on startup when the store is empty.
async function seed({ sync = true } = {}) {
  if (sync) await sequelize.sync({ alter: true });

  // ---- Categories ----
  const [cookiesCat] = await Category.findOrCreate({
    where: { slug: 'cookies' },
    defaults: { name: 'Second Nature Cookies', tier: 'public', sortOrder: 1, description: 'Our own baked flagship product.' },
  });
  const [kidsCat] = await Category.findOrCreate({
    where: { slug: 'kid-toys' },
    defaults: { name: 'Kid Toys', tier: 'public', sortOrder: 2 },
  });
  const [gadgetsCat] = await Category.findOrCreate({
    where: { slug: 'gadgets' },
    defaults: { name: 'Gadgets', tier: 'public', sortOrder: 3 },
  });
  const [discreetCat] = await Category.findOrCreate({
    where: { slug: 'discreet' },
    defaults: { name: 'Discreet', tier: 'discreet', sortOrder: 99 },
  });
  const [vaultCat] = await Category.findOrCreate({
    where: { slug: 'vault' },
    defaults: { name: 'The Vault', tier: 'exclusive', sortOrder: 100 },
  });

  // ---- Second Nature cookies (flagship / hero) ----
  const cookies = [
    { name: 'Classic Chocolate Chip', slug: 'classic-chocolate-chip', price: 2500, image: '/images/cookie-classic.png', desc: 'Our original recipe — crisp edges, gooey center, real chocolate chunks.' },
    { name: 'Double Fudge Brownie', slug: 'double-fudge-brownie', price: 2800, image: '/images/cookie-fudge.png', desc: 'Rich cocoa dough loaded with fudge chunks. Not for the faint of heart.' },
    { name: 'Peanut Butter Crunch', slug: 'peanut-butter-crunch', price: 2700, image: '/images/cookie-peanut.png', desc: 'Roasted peanut butter with a satisfying crunch in every bite.' },
    { name: 'Oatmeal Raisin Spice', slug: 'oatmeal-raisin-spice', price: 2400, image: '/images/cookie-oatmeal.png', desc: 'Warm cinnamon and nutmeg, plump raisins, hearty oats.' },
  ];
  for (const c of cookies) {
    await Product.findOrCreate({
      where: { slug: c.slug },
      defaults: {
        name: c.name,
        description: c.desc,
        price: c.price,
        imageUrl: c.image,
        stock: 200,
        isFlagship: true,
        visibilityTier: 'public',
        categoryId: cookiesCat.id,
      },
    });
  }

  // ---- Sample third-party products ----
  await Product.findOrCreate({
    where: { slug: 'remote-control-car' },
    defaults: {
      name: 'Remote Control Racer', description: 'Rechargeable RC car, ages 6+.', price: 8500,
      imageUrl: '/images/toy-rc-car.png', stock: 30, visibilityTier: 'public', categoryId: kidsCat.id,
    },
  });
  await Product.findOrCreate({
    where: { slug: 'wireless-earbuds' },
    defaults: {
      name: 'Wireless Earbuds Pro', description: 'Noise-isolating earbuds with charging case.', price: 15000,
      imageUrl: '/images/gadget-earbuds.png', stock: 40, visibilityTier: 'public', categoryId: gadgetsCat.id,
    },
  });
  await Product.findOrCreate({
    where: { slug: 'gold-pendant-necklace' },
    defaults: {
      name: '18K Gold Pendant Necklace', description: 'Certified 18K gold, vault members only.', price: 450000,
      imageUrl: '/images/vault-gold-pendant.png', stock: 5, visibilityTier: 'exclusive', categoryId: vaultCat.id,
    },
  });

  // ---- Branches (Calabar kiosks) ----
  const kioskSpecs = [
    { name: 'TEM Kiosk — Marian Market', address: 'Marian Market, Calabar', city: 'Calabar', state: 'Cross River' },
    { name: 'TEM Kiosk — Watt Market', address: 'Watt Market, Calabar', city: 'Calabar', state: 'Cross River' },
    { name: 'TEM Kiosk — Unical Junction', address: 'Unical Junction, Calabar', city: 'Calabar', state: 'Cross River' },
  ];
  const branches = [];
  for (const spec of kioskSpecs) {
    const [branch] = await Branch.findOrCreate({
      where: { slug: slugify(spec.name, { lower: true, strict: true }) },
      defaults: { ...spec, slug: slugify(spec.name, { lower: true, strict: true }), type: 'kiosk', pickupFee: 0 },
    });
    branches.push(branch);
  }

  // A central production/warehouse branch - not shown at checkout for pickup,
  // but where new production batches land before being transferred to kiosks.
  const [warehouse] = await Branch.findOrCreate({
    where: { slug: 'central-production' },
    defaults: {
      name: 'Central Production',
      slug: 'central-production',
      address: 'Mega Essentials Ltd Production Site',
      city: 'Calabar',
      state: 'Cross River',
      type: 'production',
      isPickupEnabled: false,
      isFulfillmentEnabled: false,
    },
  });

  // ---- Give each kiosk some starting stock of the public products, so the
  // storefront and POS aren't empty on first run. Skipped if inventory already exists.
  const publicProducts = await Product.findAll({ where: { visibilityTier: 'public' } });
  for (const branch of branches) {
    for (const product of publicProducts) {
      const existing = await BranchInventory.findOne({ where: { branchId: branch.id, productId: product.id } });
      if (!existing) {
        await inventoryService.adjustBranchStock({
          productId: product.id,
          branchId: branch.id,
          delta: 50,
          reason: 'production',
          note: 'Initial seed stock',
        });
      }
    }
  }

  // ---- Delivery zones (product home delivery, priced per city/LGA) ----
  const deliveryZoneSeed = [
    { state: 'Cross River', city: 'Calabar Municipal', fee: 1000, estimatedDays: 'Same day - 1 day', sortOrder: 1 },
    { state: 'Cross River', city: 'Calabar South', fee: 1500, estimatedDays: 'Same day - 1 day', sortOrder: 2 },
  ];
  for (const zone of deliveryZoneSeed) {
    await DeliveryZone.findOrCreate({ where: { state: zone.state, city: zone.city }, defaults: zone });
  }

  // ---- Vault subscription tier ----
  await SubscriptionTier.findOrCreate({
    where: { name: 'Vault Access — 6 Months' },
    defaults: { durationMonths: 6, price: 25000, gracePeriodDays: 5 },
  });

  // ---- Courier zones for walk-in/external deliveries (separate from product delivery pricing) ----
  const courierZoneSeed = [
    { name: 'Calabar Municipality', city: 'Calabar', state: 'Cross River', baseFee: 800, mediumSurcharge: 500, largeSurcharge: 1500, sortOrder: 1 },
    { name: 'Calabar South', city: 'Calabar', state: 'Cross River', baseFee: 1000, mediumSurcharge: 500, largeSurcharge: 1500, sortOrder: 2 },
    { name: 'Uyo', city: 'Uyo', state: 'Akwa Ibom', baseFee: 3500, mediumSurcharge: 1000, largeSurcharge: 2500, sortOrder: 3 },
  ];
  for (const zone of courierZoneSeed) {
    await CourierZone.findOrCreate({ where: { name: zone.name }, defaults: zone });
  }

  // ---- Sample team members for the public /team page ----
  const teamSeed = [
    { name: 'Mega', role: 'Founder & CEO', bio: 'Building TEM Store from the ground up, one kiosk at a time.', sortOrder: 1 },
    { name: 'Blessing', role: 'Branch Operations', bio: 'Keeps the kiosks stocked and running smoothly.', sortOrder: 2 },
    { name: 'Ifeoma', role: 'Customer Experience', bio: 'Making sure every order feels like Second Nature.', sortOrder: 3 },
  ];
  for (const member of teamSeed) {
    await TeamMember.findOrCreate({ where: { name: member.name }, defaults: { ...member, photoUrl: null } });
  }

  // ---- Loyalty program stages (thresholds are starting defaults - tune later via /admin/loyalty-tiers) ----
  const loyaltyTierSeed = [
    { stageNumber: 1, purchasesRequired: 3, rewardLabel: '1 Free Cookie Pack' },
    { stageNumber: 2, purchasesRequired: 6, rewardLabel: '2 Free Cookie Packs' },
    { stageNumber: 3, purchasesRequired: 10, rewardLabel: '1 Free T-Shirt' },
    { stageNumber: 4, purchasesRequired: 15, rewardLabel: '2 Free Cookie Packs + 1 T-Shirt' },
  ];
  for (const tier of loyaltyTierSeed) {
    await LoyaltyTier.findOrCreate({ where: { stageNumber: tier.stageNumber }, defaults: tier });
  }

  // ---- Default super admin account (change this password immediately) ----
  const existingAdmin = await User.findOne({ where: { role: 'super_admin' } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin12345', 10);
    await User.create({
      fullName: 'Mega Admin',
      email: 'admin@temstore.com',
      phone: '08000000000',
      passwordHash,
      role: 'super_admin',
      state: 'Cross River',
    });
    console.log('\nCreated default super admin: admin@temstore.com / admin12345 — change this password immediately.\n');
  }

  console.log('Seed complete.');
}

module.exports = seed;

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
