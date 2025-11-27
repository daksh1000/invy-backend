const { supabase } = require('../config/supabase');

/**
 * Export invoices to CSV format
 */
async function exportInvoicesToCSV(req, res) {
    try {
        const { invoiceIds } = req.body;
        const authId = req.userId;

        if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
            return res.status(400).json({ error: 'No invoices selected for export' });
        }

        console.log(`📤 Exporting ${invoiceIds.length} invoices for user ${authId.substring(0, 8)}`);

        // Fetch invoices that belong to this user
        const { data: invoices, error } = await supabase
            .from('invoices')
            .select('*')
            .eq('auth_id', authId)
            .in('id', invoiceIds)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching invoices:', error);
            return res.status(400).json({ error: error.message });
        }

        if (invoices.length === 0) {
            return res.status(404).json({ error: 'No invoices found' });
        }

        // Generate CSV
        const csv = generateCSV(invoices);

        // Set headers for file download
        const filename = `invoices_export_${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        console.log(`✅ Exported ${invoices.length} invoices to ${filename}`);
        res.send(csv);

    } catch (error) {
        console.error('Error exporting invoices:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Generate CSV content from invoices
 */
function generateCSV(invoices) {
    // CSV Headers (accounting-friendly format)
    const headers = [
        'Date',
        'Invoice Number',
        'Company Name',
        'Description',
        'Amount',
        'Status',
        'Account',
        'Email From',
        'Link'
    ];

    // Convert invoices to CSV rows
    const rows = invoices.map(invoice => {
        const date = invoice.created_at ? new Date(invoice.created_at).toLocaleDateString() : '';
        const invoiceNumber = escapeCSV(invoice.invoice_number || '');
        const companyName = escapeCSV(invoice.company_name || '');
        const description = escapeCSV(invoice.email_subject || 'Invoice');
        const amount = invoice.total_amount || '0';
        const status = escapeCSV(invoice.status || '');
        const account = escapeCSV(invoice.gmail_address || '');
        const emailFrom = escapeCSV(invoice.email_from || '');
        const link = escapeCSV(invoice.link || '');

        return [date, invoiceNumber, companyName, description, amount, status, account, emailFrom, link];
    });

    // Combine headers and rows
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    return csvContent;
}

/**
 * Escape CSV values (handle commas, quotes, newlines)
 */
function escapeCSV(value) {
    if (value === null || value === undefined) {
        return '';
    }

    const stringValue = String(value);

    // If value contains comma, quote, or newline, wrap in quotes and escape existing quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
}

module.exports = {
    exportInvoicesToCSV
};
