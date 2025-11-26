const { google } = require('googleapis');
const { supabase } = require('./src/config/supabase');

/**
 * Get a valid access token for a connected account
 * Refreshes the token if it's expired
 */
async function getValidAccessToken(account) {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );

    // Set the current credentials
    oauth2Client.setCredentials({
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expiry_date: account.token_expires_at ? new Date(account.token_expires_at).getTime() : null
    });

    // Check if token is expired or about to expire (within 5 minutes)
    const now = Date.now();
    const expiryDate = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
    const isExpired = expiryDate - now < 5 * 60 * 1000; // 5 minutes buffer

    if (isExpired && account.refresh_token) {
        try {
            // Refresh the access token
            const { credentials } = await oauth2Client.refreshAccessToken();

            // Update the database with new token
            const { error } = await supabase
                .from('connected_accounts')
                .update({
                    access_token: credentials.access_token,
                    token_expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null
                })
                .eq('id', account.id);

            if (error) {
                console.error('Error updating token in database:', error);
            }

            return credentials.access_token;
        } catch (error) {
            console.error('Error refreshing token:', error);
            throw new Error('Failed to refresh access token');
        }
    }

    return account.access_token;
}

module.exports = {
    getValidAccessToken
};
