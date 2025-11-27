const express = require('express');
const router = express.Router();
const multer = require('multer');
const uploadController = require('../controllers/uploadController');
const { requireAuth } = require('../middleware/authMiddleware');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

router.post('/', requireAuth, upload.single('file'), uploadController.handleFileUpload);

module.exports = router;
