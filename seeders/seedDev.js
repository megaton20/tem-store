require('dotenv').config();
const bcrypt = require('bcryptjs');
const {
  sequelize, User, Product, Branch, DeliveryZone,
  Order, OrderItem, SubscriptionTier, UserSubscription, Shipment,
} = require('../models');
const { generateOrderNumber } = require('../utils/orderNumber');
const { generateDeliveryConfirmationCode } = require('../utils/codeGenerator');
const runSeed = require('./seed');

const DEV_PASSWORD = 'password123';

async function seedDev() {
  await sequelize.sync({ alter: true });

  // make sure the base catalog/kiosks/zones/tier exist first
  await runSeed({ sync: false });

  // ---- Test users ----
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  const [buyer] = await User.findOrCreate({
    where: { email: 'buyer@test.com' },
    defaults: {
      fullName: 'Chidinma Buyer',
      phone: '08011111111',
      passwordHash,
      address: '12 Marian Road',
      city: 'Calabar',
      state: 'Cross River',
    },
  });

  const [vaultMember] = await User.findOrCreate({
    where: { email: 'vault@test.com' },
    defaults: {
      fullName: 'Emeka Vault',
      phone: '08022222222',
      passwordHash,
      address: '4 Ndidem Usang Iso Road',
      city: 'Calabar',
      state: 'Cross River',
    },
  });

  const [newUser] = await User.findOrCreate({
    where: { email: 'newuser@test.com' },
    defaults: {
      fullName: 'Fresh Signup',
      phone: '08033333333',
      passwordHash,
      state: 'Cross River',
    },
  });

  // ---- Give the vault member an active subscription ----
  const tier = await SubscriptionTier.findOne({ where: { isActive: true } });
  if (tier) {
    const existingSub = await UserSubscription.findOne({ where: { userId: vaultMember.id } });
    if (!existingSub) {
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + tier.durationMonths);
      const graceEndsAt = new Date(expiresAt);
      graceEndsAt.setDate(graceEndsAt.getDate() + tier.gracePeriodDays);

      await UserSubscription.create({
        userId: vaultMember.id,
        tierId: tier.id,
        startedAt: now,
        expiresAt,
        graceEndsAt,
        status: 'active',
        paymentReference: 'DEV-SEED-VAULT-REF',
      });
    }
  }

  // ---- Sample orders for the buyer, so /orders has something to show ----
  const products = await Product.findAll({ where: { visibilityTier: 'public' }, limit: 3 });
  const branch = await Branch.findOne({ where: { type: 'kiosk', isPickupEnabled: true } });
  const deliveryZone = await DeliveryZone.findOne({ where: { state: 'Cross River' } });

  const existingOrders = await Order.count({ where: { userId: buyer.id } });
  if (existingOrders === 0 && products.length && branch && deliveryZone) {
    // Order 1: paid, pickup
    const subtotal1 = products.slice(0, 2).reduce((sum, p) => sum + Number(p.price), 0);
    const order1 = await Order.create({
      orderNumber: generateOrderNumber(),
      userId: buyer.id,
      deliveryMethod: 'pickup',
      branchId: branch.id,
      deliveryPhone: buyer.phone,
      subtotal: subtotal1,
      deliveryFee: 0,
      total: subtotal1,
      status: 'paid',
      paymentStatus: 'paid',
      paymentReference: 'DEV-SEED-ORDER-1',
      paidAt: new Date(),
    });
    for (const p of products.slice(0, 2)) {
      await OrderItem.create({
        orderId: order1.id, productId: p.id, productName: p.name,
        unitPrice: p.price, quantity: 1, lineTotal: p.price,
      });
    }

    // Order 2: paid, home delivery
    const subtotal2 = Number(products[2].price) * 2;
    const total2 = subtotal2 + Number(deliveryZone.fee);
    const order2 = await Order.create({
      orderNumber: generateOrderNumber(),
      userId: buyer.id,
      deliveryMethod: 'home',
      branchId: branch.id,
      deliveryAddress: buyer.address,
      deliveryCity: buyer.city,
      deliveryState: buyer.state,
      deliveryPhone: buyer.phone,
      deliveryConfirmationCode: generateDeliveryConfirmationCode(),
      subtotal: subtotal2,
      deliveryFee: deliveryZone.fee,
      total: total2,
      status: 'processing',
      paymentStatus: 'paid',
      paymentReference: 'DEV-SEED-ORDER-2',
      paidAt: new Date(),
    });
    await OrderItem.create({
      orderId: order2.id, productId: products[2].id, productName: products[2].name,
      unitPrice: products[2].price, quantity: 2, lineTotal: subtotal2,
    });

    // Order 3: pending payment, so you can see that state too
    const subtotal3 = Number(products[0].price);
    const order3 = await Order.create({
      orderNumber: generateOrderNumber(),
      userId: buyer.id,
      deliveryMethod: 'pickup',
      branchId: branch.id,
      deliveryPhone: buyer.phone,
      subtotal: subtotal3,
      deliveryFee: 0,
      total: subtotal3,
      status: 'pending_payment',
      paymentStatus: 'pending',
      paymentReference: 'DEV-SEED-ORDER-3',
    });
    await OrderItem.create({
      orderId: order3.id, productId: products[0].id, productName: products[0].name,
      unitPrice: products[0].price, quantity: 1, lineTotal: subtotal3,
    });
  }

  // ---- Staff test accounts, tied to a real kiosk branch, for exercising the admin panel ----
  if (branch) {
    await User.findOrCreate({
      where: { email: 'manager@test.com' },
      defaults: {
        fullName: 'Blessing Manager', phone: '08044444444', passwordHash,
        role: 'branch_manager', branchId: branch.id, state: 'Cross River',
      },
    });
    await User.findOrCreate({
      where: { email: 'pos@test.com' },
      defaults: {
        fullName: 'Ifeoma Cashier', phone: '08055555555', passwordHash,
        role: 'sales_pos', branchId: branch.id, state: 'Cross River',
      },
    });
    await User.findOrCreate({
      where: { email: 'inventory@test.com' },
      defaults: {
        fullName: 'Okon Stockman', phone: '08066666666', passwordHash,
        role: 'inventory_staff', branchId: branch.id, state: 'Cross River',
      },
    });
    await User.findOrCreate({
      where: { email: 'logistics@test.com' },
      defaults: {
        fullName: 'Grace Logistics', phone: '08077777777', passwordHash,
        role: 'logistics', state: 'Cross River',
      },
    });
    const [rider] = await User.findOrCreate({
      where: { email: 'rider@test.com' },
      defaults: {
        fullName: 'Samuel Rider', phone: '08088888888', passwordHash,
        role: 'rider', branchId: branch.id, state: 'Cross River',
      },
    });

    // ---- Demo shipment: order2 processed and assigned to the rider, so
    // the dispatch queue, process page, and rider dashboard all have data ----
    const order2 = await Order.findOne({ where: { paymentReference: 'DEV-SEED-ORDER-2' } });
    if (order2) {
      const existingShipment = await Shipment.findOne({ where: { orderId: order2.id } });
      if (!existingShipment) {
        const items = await OrderItem.findAll({ where: { orderId: order2.id } });
        await Shipment.create({
          source: 'tem_store',
          orderId: order2.id,
          pickupBranchId: branch.id,
          recipientName: buyer.fullName,
          recipientPhone: buyer.phone,
          deliveryAddress: order2.deliveryAddress,
          deliveryCity: order2.deliveryCity,
          deliveryState: order2.deliveryState,
          manifest: items.map((i) => `${i.quantity}x ${i.productName}`).join(', '),
          status: 'assigned',
          assignedRiderId: rider.id,
          assignedAt: new Date(),
          confirmationCode: order2.deliveryConfirmationCode,
        });
      }
    }
  }

  console.log('\nDev seed complete. Test accounts (all use the same password):');
  console.log(`  Password for all accounts: ${DEV_PASSWORD}\n`);
  console.log('  buyer@test.com      - has order history (paid pickup, paid delivery, pending payment)');
  console.log('  vault@test.com      - has an ACTIVE vault subscription, can visit /vault directly');
  console.log('  newuser@test.com    - clean account, no orders, no subscription');
  console.log('  manager@test.com    - branch_manager at ' + (branch ? branch.name : '—') + ' (inventory + POS + own-branch orders)');
  console.log('  pos@test.com        - sales_pos at the same branch (POS terminal only)');
  console.log('  inventory@test.com  - inventory_staff at the same branch (inventory + receiving transfers only)');
  console.log('  logistics@test.com  - logistics HOD, sees the full dispatch queue across branches');
  console.log('  rider@test.com      - rider with one active delivery assigned (test the manifest + complete flow)');
  console.log('\n  Super admin (full access, from the base seed): admin@temstore.com / admin12345\n');
}

module.exports = seedDev;

if (require.main === module) {
  seedDev()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Dev seed failed:', err);
      process.exit(1);
    });
}
