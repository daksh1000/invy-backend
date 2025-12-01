const { supabase } = require('../config/supabase');

async function getInvoices(req, res) {
    try {
        const { status, gmail_address, category } = req.query;
        const authId = req.userId;

        console.log('📊 GET /api/invoices - Request Details:');
        console.log('   Full URL:', `${req.protocol}://${req.get('host')}${req.originalUrl}`);
        console.log('   Method:', req.method);
        console.log('   Query Params:', req.query);
        console.log('   Auth ID from JWT:', authId);
        console.log('   Status filter:', status || 'none');
        console.log('   Gmail filter:', gmail_address || 'none');
        console.log('   Category filter:', category || 'none');

        let query = supabase
            .from('invoices')
            .select('*')
            .eq('auth_id', authId);

        if (status) {
            query = query.eq('status', status);
        }

        if (category) {
            query = query.eq('category', category);
        }

        if (gmail_address) {
            if (gmail_address === 'manual') {
                // Fetch user email to filter for manual uploads
                const { data: customer } = await supabase
                    .from('customers')
                    .select('email')
                    .eq('auth_id', authId)
                    .single();

                if (customer) {
                    query = query.eq('gmail_address', customer.email);
                } else {
                    // Fallback if customer not found (shouldn't happen)
                    query = query.eq('gmail_address', 'manual_upload@invy.app');
                }
            } else {
                query = query.eq('gmail_address', gmail_address);
            }
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

async function updateInvoice(req, res) {
    try {
        const { id } = req.params;
        const authId = req.userId;
        const updates = req.body;

        console.log('✏️ PUT /api/invoices/:id - Update Request:');
        console.log('   Invoice ID:', id);
        console.log('   Auth ID:', authId);
        console.log('   Updates:', updates);

        // First, verify the invoice belongs to this user
        const { data: existingInvoice, error: fetchError } = await supabase
            .from('invoices')
            .select('*')
            .eq('id', id)
            .eq('auth_id', authId)
            .single();

        if (fetchError || !existingInvoice) {
            console.error('❌ Invoice not found or unauthorized');
            return res.status(404).json({ error: 'Invoice not found or unauthorized' });
        }

        // Map frontend fields to database columns and filter allowed fields
        const allowedUpdates = {};

        if (updates.invoice_number !== undefined) allowedUpdates.invoice_number = updates.invoice_number;
        if (updates.total_amount !== undefined) allowedUpdates.total_amount = updates.total_amount;
        if (updates.status !== undefined) allowedUpdates.status = updates.status;
        if (updates.category !== undefined) allowedUpdates.category = updates.category;
        // due_date and description are not currently supported by the database schema
        // if (updates.due_date !== undefined) allowedUpdates.due_date = updates.due_date;
        // if (updates.description !== undefined) allowedUpdates.description = updates.description;

        // Map customer_name to company_name
        if (updates.customer_name !== undefined) {
            allowedUpdates.company_name = updates.customer_name;
        } else if (updates.company_name !== undefined) {
            allowedUpdates.company_name = updates.company_name;
        }

        // Validate required fields
        if (allowedUpdates.invoice_number !== undefined && allowedUpdates.invoice_number.trim() === '') {
            return res.status(400).json({ error: 'Invoice number cannot be empty' });
        }
        if (allowedUpdates.total_amount !== undefined && (isNaN(allowedUpdates.total_amount) || allowedUpdates.total_amount < 0)) {
            return res.status(400).json({ error: 'Total amount must be a positive number' });
        }

        // Update the invoice
        const { data, error } = await supabase
            .from('invoices')
            .update(allowedUpdates)
            .eq('id', id)
            .eq('auth_id', authId)
            .select()
            .single();

        if (error) {
            console.error('❌ Error updating invoice:', error);
            return res.status(400).json({ error: error.message });
        }

        console.log('✅ Invoice updated successfully:', data.id);
        res.json({
            success: true,
            message: 'Invoice updated successfully',
            invoice: data
        });

    } catch (error) {
        console.error('❌ Error in updateInvoice:', error);
        res.status(500).json({ error: error.message });
    }
}

async function deleteInvoice(req, res) {
    try {
        const { id } = req.params;
        const authId = req.userId;

        console.log('🗑️ DELETE /api/invoices/:id - Delete Request:');
        console.log('   Invoice ID:', id);
        console.log('   Auth ID:', authId);

        // First, verify the invoice belongs to this user
        const { data: existingInvoice, error: fetchError } = await supabase
            .from('invoices')
            .select('*')
            .eq('id', id)
            .eq('auth_id', authId)
            .single();

        if (fetchError || !existingInvoice) {
            console.error('❌ Invoice not found or unauthorized');
            return res.status(404).json({ error: 'Invoice not found or unauthorized' });
        }

        // Delete the invoice
        const { error } = await supabase
            .from('invoices')
            .delete()
            .eq('id', id)
            .eq('auth_id', authId);

        if (error) {
            console.error('❌ Error deleting invoice:', error);
            return res.status(400).json({ error: error.message });
        }

        console.log('✅ Invoice deleted successfully:', id);
        res.json({
            success: true,
            message: 'Invoice deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error in deleteInvoice:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    getInvoices,
    updateInvoice,
    deleteInvoice
};
