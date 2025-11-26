const { supabase } = require('../config/supabase');

async function getInvoices(req, res) {
    try {
        const { status } = req.query;
        const authId = req.userId;

        console.log('📊 GET /api/invoices - Request Details:');
        console.log('   Full URL:', `${req.protocol}://${req.get('host')}${req.originalUrl}`);
        console.log('   Method:', req.method);
        console.log('   Query Params:', req.query);
        console.log('   Auth ID from JWT:', authId);
        console.log('   Status filter:', status || 'none');

        let query = supabase
            .from('invoices')
            .select('*')
            .eq('auth_id', authId);

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Error fetching invoices:', error);
            return res.status(400).json({ error: error.message });
        }

        console.log('✅ Found', data.length, 'invoices for auth_id:', authId.substring(0, 8));
        if (data.length > 0) {
            console.log('   Sample invoice:', {
                id: data[0].id,
                invoice_number: data[0].invoice_number,
                gmail_address: data[0].gmail_address,
                auth_id: data[0].auth_id.substring(0, 8)
            });
        }

        res.json({
            success: true,
            count: data.length,
            invoices: data
        });

    } catch (error) {
        console.error('❌ Error in getInvoices:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    getInvoices
};
