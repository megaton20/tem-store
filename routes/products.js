const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

router.get('/shop', productController.listPublic);
// Discreet category: intentionally NOT linked from nav or /shop - direct URL only.
router.get('/shop/discreet', productController.discreetShop);
router.get('/product/:slug', productController.show);

module.exports = router;
