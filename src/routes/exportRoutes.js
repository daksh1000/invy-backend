const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { requireAuth } = require('../middleware/authMiddleware');

// Export invoices to CSV
router.post('/csv', requireAuth, exportController.exportInvoicesToCSV);

module.exports = router;
