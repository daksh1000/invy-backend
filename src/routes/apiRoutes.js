const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const accountController = require('../controllers/accountController');
const utilityController = require('../controllers/utilityController');
const { requireAuth } = require('../middleware/authMiddleware');

// Invoice routes
router.get('/invoices', requireAuth, invoiceController.getInvoices);

// Connected accounts routes
router.get('/connected-accounts', requireAuth, accountController.getConnectedAccounts);
router.delete('/connected-accounts/:accountId', requireAuth, accountController.deleteConnectedAccount);

// Utility routes
router.post('/update-orphaned-invoices', requireAuth, utilityController.updateOrphanedInvoices);

module.exports = router;
