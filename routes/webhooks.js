const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// express.raw() here (NOT express.json()) - Paystack's signature is computed
// over the exact raw request body, so it must never be parsed/re-serialized
// before verification.
router.post('/webhooks/paystack', express.raw({ type: 'application/json' }), webhookController.handleWebhook);

module.exports = router;
