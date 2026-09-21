require('dotenv').config();
const { sequelize } = require('../models');

async function sync() {
  try {
    await sequelize.sync({ alter: true });
    console.log('All models synced to the database.');
    process.exit(0);
  } catch (err) {
    console.error('Sync failed:', err);
    process.exit(1);
  }
}

sync();
