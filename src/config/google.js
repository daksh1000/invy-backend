const credentials = require('../../credentials.json');

const CLIENT_ID = credentials.web.client_id;
const CLIENT_SECRET = credentials.web.client_secret;
const REDIRECT_URI = 'http://localhost:3001/auth/callback';

module.exports = {
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
};
