const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, '../../data/processed_history.json');
const DATA_DIR = path.join(__dirname, '../../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load history from file
function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading history:', error.message);
    }
    return { processedEmailIds: [] };
}

// Save history to file
function saveHistory(history) {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    } catch (error) {
        console.error('Error saving history:', error.message);
    }
}

// Add email ID to history
function markEmailAsProcessed(emailId) {
    const history = loadHistory();
    if (!history.processedEmailIds.includes(emailId)) {
        history.processedEmailIds.push(emailId);
        // Optional: Limit size of history to prevent infinite growth (e.g., keep last 1000)
        if (history.processedEmailIds.length > 2000) {
            history.processedEmailIds = history.processedEmailIds.slice(-2000);
        }
        saveHistory(history);
    }
}

// Check if email is processed
function isEmailProcessed(emailId) {
    const history = loadHistory();
    return history.processedEmailIds.includes(emailId);
}

module.exports = {
    markEmailAsProcessed,
    isEmailProcessed
};
