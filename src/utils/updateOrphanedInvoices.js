// Script to update orphaned invoices to new account ID
// Run this when you reconnect a Gmail account to link old invoices

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

async function updateOrphanedInvoices(authId, oldEmail, newAccountId) {
    try {
        console.log(`\n🔄 Updating orphaned invoices for ${oldEmail}...`);

        // Find invoices that match the email but have a deleted account ID
        const { data: invoices, error: fetchError } = await supabase
            .from('invoices')
            .select('id, invoice_number, email_from, gmail_account_id')
            .eq('auth_id', authId)
            .ilike('email_from', `%${oldEmail}%`);

        if (fetchError) {
            console.error('Error fetching invoices:', fetchError);
            return;
        }

        if (!invoices || invoices.length === 0) {
            console.log('No invoices found to update');
            return;
        }

        // Check which accounts still exist
        const { data: existingAccounts } = await supabase
            .from('connected_accounts')
            .select('id')
            .eq('auth_id', authId);

        const existingAccountIds = new Set(existingAccounts?.map(a => a.id) || []);

        // Find orphaned invoices (those with deleted account IDs)
        const orphanedInvoices = invoices.filter(inv => !existingAccountIds.has(inv.gmail_account_id));

        if (orphanedInvoices.length === 0) {
            console.log('No orphaned invoices found');
            return;
        }

        console.log(`Found ${orphanedInvoices.length} orphaned invoice(s)`);

        // Update them to the new account ID
        const { error: updateError } = await supabase
            .from('invoices')
            .update({ gmail_account_id: newAccountId })
            .in('id', orphanedInvoices.map(inv => inv.id));

        if (updateError) {
            console.error('Error updating invoices:', updateError);
            return;
        }

        console.log(`✅ Successfully updated ${orphanedInvoices.length} invoice(s) to new account`);
        orphanedInvoices.forEach(inv => {
            console.log(`  - ${inv.invoice_number}`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Example usage:
// updateOrphanedInvoices('your-auth-id', 'ainaman2512@gmail.com', 'new-account-id');

module.exports = { updateOrphanedInvoices };
