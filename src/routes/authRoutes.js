const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', authController.register);
router.post('/login-email', authController.loginEmail);
router.get('/login', authController.loginGoogle);
router.get('/connect-additional', requireAuth, authController.connectAdditionalGmail);
router.get('/callback', authController.googleCallback);
router.get('/callback-additional', authController.googleCallbackAdditional);

// Protected routes
router.post('/logout', requireAuth, authController.logout);

module.exports = router;
