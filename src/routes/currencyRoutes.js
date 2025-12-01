const express = require('express');
const router = express.Router();
const { fetchExchangeRate } = require('../services/currencyService');

/**
 * GET /api/currency/rate
 * Fetch current USD to INR exchange rate
 */
router.get('/rate', async (req, res) => {
    try {
        const rate = await fetchExchangeRate();
        res.json({
            success: true,
            rate: rate,
            base: 'USD',
            target: 'INR',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching exchange rate:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch exchange rate',
            message: error.message
        });
    }
});

module.exports = router;
