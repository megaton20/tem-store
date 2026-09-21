const express = require('express');
const router = express.Router();
const verifyController = require('../controllers/verifyController');

router.get('/verify', verifyController.showVerifyForm);
router.post('/verify', verifyController.checkCode);

module.exports = router;
