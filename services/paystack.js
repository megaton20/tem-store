const axios = require('axios');

const paystackApi = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Initialize a Paystack transaction.
 * amountNaira is converted to kobo (Paystack expects the smallest currency unit).
 */
async function initializeTransaction({ email, amountNaira, reference, callbackUrl, metadata = {} }) {
  const response = await paystackApi.post('/transaction/initialize', {
    email,
    amount: Math.round(amountNaira * 100),
    reference,
    callback_url: callbackUrl,
    metadata,
  });
  return response.data; // { status, message, data: { authorization_url, access_code, reference } }
}

/**
 * Verify a transaction by reference. Always re-verify server-side before
 * marking an order as paid - never trust the client-side redirect alone.
 */
async function verifyTransaction(reference) {
  const response = await paystackApi.get(`/transaction/verify/${encodeURIComponent(reference)}`);
  return response.data; // { status, message, data: { status: 'success'|'failed', amount, ... } }
}

/**
 * Refunds a transaction in full by reference. Used when a paid order is
 * cancelled - every online order is paid via Paystack, so cancellation
 * always means a refund back to the original payment method.
 */
async function refundTransaction(reference) {
  const response = await paystackApi.post('/refund', { transaction: reference });
  return response.data;
}

module.exports = { initializeTransaction, verifyTransaction, refundTransaction };
