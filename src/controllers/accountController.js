const { supabase } = require('../config/supabase');

async function getConnectedAccounts(req, res) {
    try {
        const authId = req.userId;

        console.log('📧 GET /api/connected-accounts - Request Details:');
        console.log('   Full URL:', `${req.protocol}://${req.get('host')}${req.originalUrl}`);
        console.log('   Method:', req.method);
        console.log('   Query Params:', req.query);
        console.log('   Auth ID from JWT:', authId);

        const { data, error } = await supabase
            .from('connected_accounts')
            .select('id, gmail_address, created_at')
            .eq('auth_id', authId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('❌ Error fetching connected accounts:', error);
            return res.status(400).json({ error: error.message });
        }

        console.log('✅ Found', data.length, 'connected accounts for auth_id:', authId.substring(0, 8));
        if (data.length > 0) {
            console.log('   Accounts:', data.map(a => a.gmail_address).join(', '));
        }

        res.json({
            success: true,
            count: data.length,
            accounts: data
        });

    } catch (error) {
        console.error('❌ Error in getConnectedAccounts:', error);
        res.status(500).json({ error: error.message });
    }
}

async function deleteConnectedAccount(req, res) {
    try {
        const { accountId } = req.params;
        const authId = req.userId;

        console.log('🗑️ DELETE /api/connected-accounts/:accountId - Request Details:');
        console.log('   Full URL:', `${req.protocol}://${req.get('host')}${req.originalUrl}`);
        console.log('   Method:', req.method);
        console.log('   Params:', req.params);
        console.log('   Account ID:', accountId);
        console.log('   Auth ID from JWT:', authId.substring(0, 8));

        const { data: account, error: checkError } = await supabase
            .from('connected_accounts')
            .select('id, gmail_address')
            .eq('id', accountId)
            .eq('auth_id', authId)
            .single();

        if (!account) {
            console.log('❌ Account not found or unauthorized');
            return res.status(404).json({ error: 'Account not found' });
        }

        const { error: deleteError } = await supabase
            .from('connected_accounts')
            .delete()
            .eq('id', accountId);

        if (deleteError) {
            console.error('❌ Error deleting account:', deleteError);
            return res.status(400).json({ error: deleteError.message });
        }

        console.log('✅ Account deleted:', account.gmail_address);
        res.json({ success: true, message: 'Account deleted' });

    } catch (error) {
        console.error('❌ Error in deleteConnectedAccount:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    getConnectedAccounts,
    deleteConnectedAccount
};
