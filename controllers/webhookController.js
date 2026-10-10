const crypto = require('crypto');
const paymentService = require('../services/paymentService');

/**
 * Paystack calls this directly (not through the customer's browser), so
 * it's the safety net that confirms payment even if the customer never
 * makes it back to /checkout/callback - closed tab, dropped connection,
 * crashed app, anything. Verifies the signature before trusting anything
 * in the body.
 */
async function handleWebhook(req, res) {
  const signature = req.headers['x-paystack-signature'];
  const secret = process.env.PAYSTACK_SECRET_KEY;

  const expectedSignature = crypto.createHmac('sha512', secret).update(req.body).digest('hex');
  if (signature !== expectedSignature) {
    return res.status(401).send('Invalid signature');
  }

  // req.body is a raw Buffer here (see the express.raw() middleware on this route)
  const event = JSON.parse(req.body.toString('utf8'));

  // Always respond 200 quickly - Paystack retries on non-2xx, and we don't
  // want a slow downstream step (email, etc.) to cause duplicate retries.
  res.status(200).send('ok');

  if (event.event !== 'charge.success') return;

  const { reference, metadata } = event.data;

  try {
    if (metadata?.purpose === 'vault_subscription') {
      await paymentService.confirmVaultPayment(reference, metadata);
    } else {
      await paymentService.confirmOrderPayment(reference);
    }
  } catch (err) {
    console.error('[webhook] Failed to process charge.success:', err);
  }
}

module.exports = { handleWebhook };
