const crypto = require('crypto');

// Excludes visually-confusable characters (0/O, 1/I/L) since these get
// printed on small stickers and typed back in by hand.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomGroup(length) {
  let out = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

// Format: TEM-XXXX-XXXX-XXXX (uppercase, grouped for readability on a label)
function generateVerificationCode() {
  return `TEM-${randomGroup(4)}-${randomGroup(4)}-${randomGroup(4)}`;
}

// Format: <PRODUCT_PREFIX>-YYYYMMDD-<LETTER>, e.g. SN-20260814-A
// Caller supplies the running letter/number to keep same-day batches distinct.
function generateBatchNumber(productPrefix, date, suffix) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${productPrefix}-${y}${m}${d}-${suffix}`;
}

// Short customer-facing confirmation code, e.g. 7K3M9Q. Shown to the
// customer on their order page; the rider asks for it in person before
// marking a delivery complete.
function generateDeliveryConfirmationCode() {
  return randomGroup(6);
}

module.exports = { generateVerificationCode, generateBatchNumber, generateDeliveryConfirmationCode };
