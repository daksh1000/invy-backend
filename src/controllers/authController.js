// Auth Controller for Invy Application
// Handles registration, email login, Google OAuth, and linking additional Gmail accounts.

const axios = require('axios');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = require('../config/google');
const { generateToken } = require('../utils/jwtHelper');
const { ensureFolderStructure } = require('../services/driveService');

// ---------------------------------------------------------------------------
// Register a new user (creates Supabase auth user and a customer record)
// ---------------------------------------------------------------------------
async function register(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }
    try {
        // Create auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });
        if (authError) {
            return res.status(400).json({ error: authError.message });
        }
        const userId = authData.user.id;
        console.log('✅ Auth user created:', userId);

        // Insert customer record linked by auth_id
        const { error: customerError } = await supabase
            .from('customers')
            .insert([{ auth_id: userId, email, name: email }]);
        if (customerError) {
            return res.status(400).json({ error: customerError.message });
        }
        console.log('✅ Customer record created');

        const token = generateToken(userId);
        res.json({ success: true, message: 'Registration successful! Please login.', userId, token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// ---------------------------------------------------------------------------
// Email/password login
// ---------------------------------------------------------------------------
async function loginEmail(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }
    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        const userId = data.user.id;
        console.log('✅ User logged in:', userId);

        // Fetch connected accounts using auth_id (no longer using customer_id)
        const { data: accounts, error: accountsError } = await supabase
            .from('connected_accounts')
            .select('*')
            .eq('auth_id', userId);
        if (accountsError) {
            console.error('Error fetching accounts:', accountsError.message);
        }
        console.log(`✅ Found ${accounts?.length || 0} connected accounts`);

        const token = generateToken(userId);
        res.json({ success: true, message: 'Login successful!', userId, token, accounts: accounts?.length || 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// ---------------------------------------------------------------------------
// Google OAuth (initial login)
// ---------------------------------------------------------------------------
async function loginGoogle(req, res) {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive',
        access_type: 'offline',
        prompt: 'consent',
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.redirect(authUrl);
}

// ---------------------------------------------------------------------------
// Link an additional Gmail account (OAuth flow)
// ---------------------------------------------------------------------------
async function connectAdditionalGmail(req, res) {
    const userId = req.userId; // auth_id from requireAuth middleware
    const state = JSON.stringify({ authId: userId });
    const encodedState = Buffer.from(state).toString('base64');
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: `${REDIRECT_URI}-additional`,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive',
        access_type: 'offline',
        prompt: 'consent',
        state: encodedState,
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.redirect(authUrl);
}

// ---------------------------------------------------------------------------
// Google OAuth callback (primary account)
// ---------------------------------------------------------------------------
async function googleCallback(req, res) {
    const code = req.query.code;
    try {
        const response = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
        });
        const accessToken = response.data.access_token;
        const refreshToken = response.data.refresh_token;
        const expiresIn = response.data.expires_in;
        
        console.log('✅ Access Token obtained!');
        
        const userInfo = await axios.get('https://www.googleapis.com/gmail/v1/users/me/profile', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const userEmail = userInfo.data.emailAddress;
        console.log('📧 User Gmail:', userEmail);
        
        await ensureFolderStructure(accessToken, userEmail);
        
        res.send(`
            <h1>✅ Success!</h1>
            <p>Connected as: ${userEmail}</p>
            <p>📬 Folder structure created on Drive</p>
            <p>🔔 Background monitoring is now active</p>
            <script>
                setTimeout(() => {
                    window.close();
                }, 3000);
            </script>
        `);
    } catch (err) {
        console.error('Error in Google OAuth callback:', err.message);
        res.send(`<h1>❌ Error</h1><p>${err.message}</p>`);
    }
}

// ---------------------------------------------------------------------------
// Google OAuth callback for additional accounts
// ---------------------------------------------------------------------------
async function googleCallbackAdditional(req, res) {
    const code = req.query.code;
    const stateParam = req.query.state;

    try {
        // Decode state to get authId
        const state = JSON.parse(Buffer.from(stateParam, 'base64').toString());
        const authId = state.authId;

        // Exchange code for tokens
        const response = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: `${REDIRECT_URI}-additional`,
        });

        const accessToken = response.data.access_token;
        const refreshToken = response.data.refresh_token;
        const expiresIn = response.data.expires_in;

        console.log('✅ Additional account tokens obtained!');

        // Get Gmail address
        const userInfo = await axios.get('https://www.googleapis.com/gmail/v1/users/me/profile', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const userEmail = userInfo.data.emailAddress;

        console.log('📧 Additional Gmail:', userEmail);

        // Check if account already exists
        const { data: existingAccount } = await supabase
            .from('connected_accounts')
            .select('id')
            .eq('auth_id', authId)
            .eq('gmail_address', userEmail)
            .single();

        if (existingAccount) {
            return res.send(`
                <h1>⚠️ Account Already Connected</h1>
                <p>${userEmail} is already linked to your account.</p>
                <script>
                    setTimeout(() => {
                        window.close();
                    }, 3000);
                </script>
            `);
        }

        // Save to connected_accounts
        const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
        
        const { error: insertError } = await supabase
            .from('connected_accounts')
            .insert([{
                auth_id: authId,
                gmail_address: userEmail,
                access_token: accessToken,
                refresh_token: refreshToken,
                token_expires_at: tokenExpiresAt,
            }]);

        if (insertError) {
            throw new Error(insertError.message);
        }

        console.log('✅ Additional account saved to database');

        // Create folder structure
        await ensureFolderStructure(accessToken, userEmail);

        res.send(`
            <h1>✅ Additional Account Connected!</h1>
            <p>Successfully linked: ${userEmail}</p>
            <p>📬 Folder structure created on Drive</p>
            <p>🔔 Background monitoring is now active</p>
            <script>
                setTimeout(() => {
                    window.close();
                }, 3000);
            </script>
        `);
    } catch (err) {
        console.error('Error in additional account callback:', err.message);
        res.send(`<h1>❌ Error</h1><p>${err.message}</p>`);
    }
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------
async function logout(req, res) {
    try {
        // You can add token invalidation logic here if needed
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

module.exports = {
    register,
    loginEmail,
    loginGoogle,
    connectAdditionalGmail,
    googleCallback,
    googleCallbackAdditional,
    logout,
};
