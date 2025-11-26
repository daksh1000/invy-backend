const { supabase } = require('../config/supabase');

/**
 * Update orphaned invoices to point to a new account ID
 * This is useful when reconnecting a Gmail account
 */
async function updateOrphanedInvoices(req, res) {
    try {
        const { oldEmail, newAccountId } = req.body;
        const authId = req.userId;

        if (!oldEmail || !newAccountId) {
            return res.status(400).json({
                error: 'oldEmail and newAccountId are required'
            });
        }

        // Find invoices that match the email but have a deleted account ID
        const { data: invoices, error: fetchError } = await supabase
            .from('invoices')
            .select('id, invoice_number, email_from, gmail_account_id')
            .eq('auth_id', authId)
            .ilike('email_from', `%${oldEmail}%`);

        if (fetchError) {
            return res.status(400).json({ error: fetchError.message });
        }

        if (!invoices || invoices.length === 0) {
            return res.json({
                success: true,
                message: 'No invoices found',
                updated: 0
            });
        }

        // Check which accounts still exist
        const { data: existingAccounts } = await supabase
            .from('connected_accounts')
            .select('id')
            .eq('auth_id', authId);

        const existingAccountIds = new Set(existingAccounts?.map(a => a.id) || []);

        // Find orphaned invoices (those with deleted account IDs)
        const orphanedInvoices = invoices.filter(
            inv => !existingAccountIds.has(inv.gmail_account_id)
        );

        if (orphanedInvoices.length === 0) {
            return res.json({
                success: true,
                message: 'No orphaned invoices found',
                updated: 0
            });
        }

        // Update them to the new account ID
        const { error: updateError } = await supabase
            .from('invoices')
            .update({ gmail_account_id: newAccountId })
            .in('id', orphanedInvoices.map(inv => inv.id));

        if (updateError) {
            return res.status(400).json({ error: updateError.message });
        }

        res.json({
            success: true,
            message: `Updated ${orphanedInvoices.length} orphaned invoice(s)`,
            updated: orphanedInvoices.length,
            invoices: orphanedInvoices.map(inv => inv.invoice_number)
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    updateOrphanedInvoices
};
