const { supabase } = require('../config/supabase');

/**
 * Generate story data for a given period
 */
async function generateStory(req, res) {
    try {
        const { period } = req.params; // this_month, last_month, this_year
        const authId = req.userId;

        console.log(`📖 Generating story for period: ${period}, user: ${authId.substring(0, 8)}`);

        // Get date ranges
        const { currentStart, currentEnd, previousStart, previousEnd } = getDateRanges(period);

        // Fetch current period invoices
        const { data: currentInvoices } = await supabase
            .from('invoices')
            .select('*')
            .eq('auth_id', authId)
            .gte('created_at', currentStart)
            .lte('created_at', currentEnd);

        // Fetch previous period invoices for comparison
        const { data: previousInvoices } = await supabase
            .from('invoices')
            .select('*')
            .eq('auth_id', authId)
            .gte('created_at', previousStart)
            .lte('created_at', previousEnd);

        // Generate story cards
        const storyCards = [];

        // Card 1: Summary
        const summaryCard = generateSummaryCard(currentInvoices, previousInvoices, period);
        storyCards.push(summaryCard);

        // Card 2: Top Expense
        if (currentInvoices.length > 0) {
            const topExpenseCard = generateTopExpenseCard(currentInvoices);
            storyCards.push(topExpenseCard);
        }

        // Card 3: Top Vendor
        if (currentInvoices.length > 0) {
            const topVendorCard = generateTopVendorCard(currentInvoices);
            storyCards.push(topVendorCard);
        }

        // Card 4: Payment Status
        const paymentCard = generatePaymentStatusCard(currentInvoices);
        storyCards.push(paymentCard);

        // Card 5: Comparison
        if (previousInvoices.length > 0) {
            const comparisonCard = generateComparisonCard(currentInvoices, previousInvoices, period);
            storyCards.push(comparisonCard);
        }

        res.json({
            period,
            cards: storyCards,
            generatedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error generating story:', error);
        res.status(500).json({ error: 'Failed to generate story' });
    }
}

/**
 * Get date ranges for current and previous periods
 */
function getDateRanges(period) {
    const now = new Date();
    let currentStart, currentEnd, previousStart, previousEnd;

    switch (period) {
        case 'this_month':
            currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
            currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            break;

        case 'last_month':
            currentStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            currentEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            previousStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
            previousEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59);
            break;

        case 'this_year':
            currentStart = new Date(now.getFullYear(), 0, 1);
            currentEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            previousStart = new Date(now.getFullYear() - 1, 0, 1);
            previousEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
            break;

        default:
            currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
            currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }

    return {
        currentStart: currentStart.toISOString(),
        currentEnd: currentEnd.toISOString(),
        previousStart: previousStart.toISOString(),
        previousEnd: previousEnd.toISOString()
    };
}

/**
 * Generate summary card
 */
function generateSummaryCard(currentInvoices, previousInvoices, period) {
    const currentTotal = currentInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
    const previousTotal = previousInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);

    const change = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;
    const changeDirection = change > 0 ? 'up' : change < 0 ? 'down' : 'same';

    const periodLabel = period === 'this_month' ? new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) :
        period === 'last_month' ? new Date(new Date().setMonth(new Date().getMonth() - 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) :
            new Date().getFullYear().toString();

    return {
        type: 'summary',
        title: periodLabel,
        emoji: '💰',
        data: {
            total: currentTotal.toFixed(2),
            count: currentInvoices.length,
            change: Math.abs(change).toFixed(1),
            changeDirection,
            previousPeriod: period === 'this_month' ? 'last month' : period === 'this_year' ? 'last year' : 'previous period'
        }
    };
}

/**
 * Generate top expense card
 */
function generateTopExpenseCard(invoices) {
    const topInvoice = invoices.reduce((max, inv) =>
        parseFloat(inv.total_amount || 0) > parseFloat(max.total_amount || 0) ? inv : max
        , invoices[0]);

    return {
        type: 'top_expense',
        title: 'Biggest Expense',
        emoji: '🏆',
        data: {
            company: topInvoice.company_name || 'Unknown',
            amount: parseFloat(topInvoice.total_amount || 0).toFixed(2),
            invoiceNumber: topInvoice.invoice_number,
            date: new Date(topInvoice.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        }
    };
}

/**
 * Generate top vendor card
 */
function generateTopVendorCard(invoices) {
    // Group by company and sum amounts
    const vendorTotals = {};
    invoices.forEach(inv => {
        const company = inv.company_name || 'Unknown';
        if (!vendorTotals[company]) {
            vendorTotals[company] = { total: 0, count: 0 };
        }
        vendorTotals[company].total += parseFloat(inv.total_amount || 0);
        vendorTotals[company].count += 1;
    });

    // Find top vendor
    const topVendor = Object.entries(vendorTotals)
        .sort(([, a], [, b]) => b.total - a.total)[0];

    if (!topVendor) {
        return null;
    }

    return {
        type: 'top_vendor',
        title: 'Top Vendor',
        emoji: '🏢',
        data: {
            company: topVendor[0],
            total: topVendor[1].total.toFixed(2),
            count: topVendor[1].count
        }
    };
}

/**
 * Generate payment status card
 */
function generatePaymentStatusCard(invoices) {
    const paidCount = invoices.filter(inv => inv.status === 'paid').length;
    const unpaidCount = invoices.filter(inv => inv.status === 'unpaid').length;
    const allPaid = unpaidCount === 0 && paidCount > 0;

    return {
        type: 'payment_status',
        title: allPaid ? 'All Paid!' : 'Payment Status',
        emoji: allPaid ? '✅' : '📊',
        data: {
            allPaid,
            paidCount,
            unpaidCount,
            totalCount: invoices.length
        }
    };
}

/**
 * Generate comparison card
 */
function generateComparisonCard(currentInvoices, previousInvoices, period) {
    const currentTotal = currentInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
    const previousTotal = previousInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);

    const change = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

    return {
        type: 'comparison',
        title: 'Trend',
        emoji: change > 0 ? '📈' : change < 0 ? '📉' : '➡️',
        data: {
            current: currentTotal.toFixed(2),
            previous: previousTotal.toFixed(2),
            change: change.toFixed(1),
            changeDirection: change > 0 ? 'up' : change < 0 ? 'down' : 'same',
            period: period === 'this_month' ? 'Month-over-Month' : 'Year-over-Year'
        }
    };
}

module.exports = {
    generateStory
};
