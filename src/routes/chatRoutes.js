const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { requireAuth } = require('../middleware/authMiddleware');

// Chat endpoint
router.post('/', requireAuth, chatController.handleChatMessage);

module.exports = router;
