const express = require('express');
const router = express.Router();
const storyController = require('../controllers/storyController');
const { requireAuth } = require('../middleware/authMiddleware');

// Generate story for a period
router.get('/:period', requireAuth, storyController.generateStory);

module.exports = router;
