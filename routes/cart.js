const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');

router.get('/cart', cartController.viewCart);
router.post('/cart/add', cartController.addToCart);
router.post('/cart/increment', cartController.incrementByProduct);
router.post('/cart/decrement', cartController.decrementByProduct);
router.post('/cart/:itemId/update', cartController.updateItem);
router.post('/cart/:itemId/remove', cartController.removeItem);

module.exports = router;
