const axios = require('axios');

// Cache for exchange rate
let cachedRate = null;
let cacheTimestamp = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const FALLBACK_RATE = 85; // Fallback USD to INR rate

/**
 * Fetch current USD to INR exchange rate from Frankfurter API
 * @returns {Promise<number>} Exchange rate (INR per 1 USD)
 */
async function fetchExchangeRate() {
    try {
        // Check if we have a valid cached rate
        if (cachedRate && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
            console.log('💱 Using cached exchange rate:', cachedRate);
            return cachedRate;
        }

        console.log('💱 Fetching fresh exchange rate from Frankfurter API...');
        const response = await axios.get('https://api.frankfurter.app/latest?from=USD&to=INR', {
            timeout: 5000 // 5 second timeout
        });

        if (response.data && response.data.rates && response.data.rates.INR) {
            cachedRate = response.data.rates.INR;
            cacheTimestamp = Date.now();
            console.log('💱 Exchange rate updated:', cachedRate, 'INR per USD');
            return cachedRate;
        } else {
            throw new Error('Invalid response format from Frankfurter API');
        }
    } catch (error) {
        console.error('❌ Error fetching exchange rate:', error.message);

        // If we have a cached rate (even if expired), use it
        if (cachedRate) {
            console.log('⚠️ Using expired cached rate:', cachedRate);
            return cachedRate;
        }

        // Otherwise use fallback rate
        console.log('⚠️ Using fallback exchange rate:', FALLBACK_RATE);
        return FALLBACK_RATE;
    }
}

/**
 * Convert amount to INR based on currency
 * @param {number} amount - Amount to convert
 * @param {string} currency - Currency code (USD or INR)
 * @param {number} exchangeRate - Current USD to INR exchange rate
 * @returns {number} Amount in INR
 */
function convertToINR(amount, currency, exchangeRate) {
    if (!amount || isNaN(amount)) return 0;

    const numAmount = parseFloat(amount);

    if (currency === 'INR') {
        return numAmount;
    } else if (currency === 'USD') {
        return numAmount * exchangeRate;
    } else {
        // Default to treating as USD if currency is unknown
        console.warn(`⚠️ Unknown currency: ${currency}, treating as USD`);
        return numAmount * exchangeRate;
    }
}

/**
 * Get currency symbol for a currency code
 * @param {string} currency - Currency code (USD or INR)
 * @returns {string} Currency symbol
 */
function getCurrencySymbol(currency) {
    const symbols = {
        'USD': '$',
        'INR': '₹'
    };
    return symbols[currency] || '$';
}

/**
 * Format amount with currency symbol
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code
 * @returns {string} Formatted amount with symbol
 */
function formatCurrency(amount, currency) {
    const symbol = getCurrencySymbol(currency);
    const formatted = Math.round(amount).toLocaleString('en-IN');
    return `${symbol}${formatted}`;
}

module.exports = {
    fetchExchangeRate,
    convertToINR,
    getCurrencySymbol,
    formatCurrency
};
