const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const checkoutController = require('../controllers/checkoutController');
const orderController = require('../controllers/orderController');

router.get('/checkout', requireAuth, checkoutController.showCheckout);
router.post('/checkout', requireAuth, checkoutController.initiateCheckout);
// Paystack redirects back here after payment - reference is verified server-side.
router.get('/checkout/callback', requireAuth, checkoutController.paystackCallback);

router.get('/orders', requireAuth, orderController.listOrders);
router.get('/orders/:id', requireAuth, orderController.showOrder);

module.exports = router;
