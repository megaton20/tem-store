require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const methodOverride = require('method-override');
const morgan = require('morgan');
const expressLayouts = require('express-ejs-layouts');

const sequelize = require('./config/database');
const { Product } = require('./models'); // also registers all model associations before sync
const runSeed = require('./seeders/seed');
const { attachUser } = require('./middleware/auth');

const app = express();

// ---- View engine ----
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// ---- Core middleware ----
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Webhook route MUST be registered before express.json() - Paystack's
// signature is verified against the exact raw body, so this route parses
// its own body as a raw Buffer (see routes/webhooks.js) rather than JSON.
app.use('/', require('./routes/webhooks'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// ---- Sessions (Postgres-backed so guest carts survive restarts) ----
const sessionStore = new SequelizeStore({ db: sequelize, tableName: 'sessions' });
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
  store: sessionStore,
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: process.env.NODE_ENV === 'production',
  },
}));
sessionStore.sync();

app.use(attachUser);

app.use((req, res, next) => {
  res.locals.flashError = req.session.flashError || null;
  delete req.session.flashError;
  next();
});

// make cart item count available on every page without extra controller code
const { getCartWithItems, getCartQuantitiesMap } = require('./services/cartService');
app.use(async (req, res, next) => {
  try {
    const { itemCount } = await getCartWithItems(req);
    res.locals.cartItemCount = itemCount;
    res.locals.cartQuantities = await getCartQuantitiesMap(req);
  } catch (e) {
    res.locals.cartItemCount = 0;
    res.locals.cartQuantities = {};
  }
  next();
});

// ---- Routes ----
app.use('/', require('./routes/index'));
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/products'));
app.use('/', require('./routes/cart'));
app.use('/', require('./routes/checkout'));
app.use('/', require('./routes/vault'));
app.use('/', require('./routes/verify'));
app.use('/', require('./routes/admin'));

// ---- 404 ----
app.use((req, res) => {
  res.status(404).render('404', { layout: false });
});

// ---- Error handler ----
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('500', { layout: false, error: process.env.NODE_ENV === 'development' ? err : null });
});

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Creates every table (and any missing columns) from the models if they
    // don't already exist. Safe to run on every boot - alter only adds what's missing.
    await sequelize.sync({ alter: true });
    console.log('Database tables ready.');

    // sequelize's alter:true does not reliably drop NOT NULL constraints on
    // Postgres when a column's model definition changes to allowNull:true
    // (e.g. Order.userId, needed for POS walk-in sales with no account).
    // Force it explicitly so existing databases created before this change
    // don't keep failing with "violates not-null constraint".
    const nullableFixes = [
      'ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL',
      'ALTER TABLE orders ALTER COLUMN branch_id DROP NOT NULL',
    ];
    for (const sql of nullableFixes) {
      try {
        await sequelize.query(sql);
      } catch (e) {
        // column/table may not exist yet on a brand-new database - fine, sync already handled it
      }
    }

    // Auto-seed starter data (categories, Second Nature cookies, pickup
    // kiosks, delivery zone, vault tier) the first time the store is empty.
    const productCount = await Product.count();
    if (productCount === 0) {
      console.log('No products found — seeding starter data...');
      await runSeed({ sync: false }); // already synced above
      console.log('Starter data seeded.');
    }

    app.listen(PORT, () => {
      console.log(`TEM Store running on ${process.env.APP_URL || 'http://localhost:' + PORT}`);
      require('./services/schedulerService').startDailyJobs();
    });
  } catch (err) {
    console.error('Unable to start server:', err);
    process.exit(1);
  }
}

start();
