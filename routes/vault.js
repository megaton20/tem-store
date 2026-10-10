const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireVaultAccess } = require('../middleware/vaultAccess');
const vaultController = require('../controllers/vaultController');

// The "subscribe" gate is fine to be reachable/visible.
router.get('/vault/redeem', requireAuth, vaultController.showRedeem);
router.post('/vault/subscribe', requireAuth, vaultController.initiateSubscription);
router.get('/vault/callback', requireAuth, vaultController.subscriptionCallback);

// The vault CONTENTS require an active/grace subscription, else 404.
router.get('/vault', requireVaultAccess, vaultController.showVault);

module.exports = router;
