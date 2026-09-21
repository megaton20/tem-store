const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/register', authController.redirectIfAuthenticated, authController.showRegister);
router.post('/register', authController.register);
router.get('/login', authController.redirectIfAuthenticated, authController.showLogin);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/verify-email', authController.verifyEmail);
router.post('/resend-verification', require('../middleware/auth').requireAuth, authController.resendVerification);

module.exports = router;
