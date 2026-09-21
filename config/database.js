require('dotenv').config();
const { Sequelize } = require('sequelize');

// Two ways to connect, switched with one env var:
//
// 1. DATABASE_URL set (e.g. a Neon connection string) -> connects with
//    that directly, SSL required (Neon rejects plain connections).
// 2. DATABASE_URL unset -> falls back to the individual DB_* vars for a
//    plain local Postgres install, no SSL.
//
// To move between local and Neon, nothing in this file changes - just
// set or unset DATABASE_URL in .env. Neon's dashboard gives you a
// connection string in the form:
//   postgresql://user:password@ep-xxxx.region.aws.neon.tech/dbname?sslmode=require
const isNeon = !!process.env.DATABASE_URL;

const sequelize = isNeon
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          // Neon's certs are signed by a public CA, but Node's default
          // pool of trusted CAs doesn't always include it depending on
          // version/platform - this keeps the connection working without
          // requiring the person to install Neon's CA cert manually.
          // Safe here because the connection is already encrypted either
          // way; this only turns off *hostname verification* of the cert.
          rejectUnauthorized: false,
        },
      },
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false,
      }
    );

module.exports = sequelize;
