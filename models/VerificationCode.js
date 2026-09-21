const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// One row per physical unit produced. The `code` is what's printed on the
// packaging (e.g. a sticker or card insert). A customer enters it at
// /verify to confirm the item is genuine TEM Store / Second Nature stock.
// Once verified, it flips to 'verified' and can never be used again -
// so a counterfeiter copying a code from one package can't reuse it.
const VerificationCode = sequelize.define('VerificationCode', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  code: { type: DataTypes.STRING, allowNull: false, unique: true },
  productId: { type: DataTypes.UUID, allowNull: false, field: 'product_id' },
  batchId: { type: DataTypes.UUID, allowNull: false, field: 'batch_id' },
  status: {
    type: DataTypes.ENUM('unused', 'verified'),
    defaultValue: 'unused',
  },
  verifiedAt: { type: DataTypes.DATE, allowNull: true, field: 'verified_at' },
  // Tracks WHO first verified this code, via their session id (verification
  // is public - no login required - so a session is the closest thing to
  // "identity" we have). If the same session submits again (e.g. their
  // first request timed out and they retried), we treat it as the same
  // person checking again, not a reused/counterfeit code. A DIFFERENT
  // session submitting the same code is what actually signals a problem.
  verifiedBySessionId: { type: DataTypes.STRING, allowNull: true, field: 'verified_by_session_id' },
}, {
  tableName: 'verification_codes',
  underscored: true,
  indexes: [{ fields: ['code'] }],
});

module.exports = VerificationCode;
