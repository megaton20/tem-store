const express = require('express');
const router = express.Router();

const homeController = require('../controllers/homeController');
const pageController = require('../controllers/pageController');
const riderApplicationController = require('../controllers/riderApplicationController');
const posApplicationController = require('../controllers/posApplicationController');
const profileController = require('../controllers/profileController');
const { requireAuth } = require('../middleware/auth');

router.get('/', homeController.home);

router.get('/about', pageController.about);
router.get('/contact', pageController.contact);
router.post('/contact', pageController.submitContact);
router.get('/terms', pageController.terms);
router.get('/privacy', pageController.privacy);
router.get('/locations', pageController.locations);
router.get('/team', pageController.team);
router.get('/investors', pageController.investors);
router.get('/where-we-ship', pageController.whereWeShip);
router.get('/loyalty', pageController.loyalty);

router.get('/apply/rider', riderApplicationController.showApplyForm);
router.post('/apply/rider', requireAuth, riderApplicationController.submitApplication);

router.get('/apply/pos', posApplicationController.showApplyForm);
router.post('/apply/pos', requireAuth, posApplicationController.submitApplication);

router.get('/profile', requireAuth, profileController.showProfile);
router.post('/profile', requireAuth, profileController.updateProfile);
router.post('/profile/password', requireAuth, profileController.changePassword);

module.exports = router;
