const OpenAI = require('openai');
const { supabase } = require('../config/supabase');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Define tools (functions) that the AI can call
const tools = [
    {
        type: 'function',
        function: {
            name: 'searchInvoices',
            description: 'Search for invoices based on various filters like company name, amount range, date range, or status',
            parameters: {
                type: 'object',
                properties: {
                    company: {
                        type: 'string',
                        description: 'Company or vendor name to search for (partial match)'
                    },
                    minAmount: {
                        type: 'number',
                        description: 'Minimum invoice amount'
                    },
                    maxAmount: {
                        type: 'number',
                        description: 'Maximum invoice amount'
                    },
                    status: {
                        type: 'string',
                        enum: ['paid', 'unpaid', 'pending'],
                        description: 'Invoice payment status'
                    },
                    dateFrom: {
                        type: 'string',
                        description: 'Start date in YYYY-MM-DD format'
                    },
                    dateTo: {
                        type: 'string',
                        description: 'End date in YYYY-MM-DD format'
                    }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'getInvoiceStats',
            description: 'Get statistics about invoices for a specific time period (total amount, count, average)',
            parameters: {
                type: 'object',
                properties: {
                    period: {
                        type: 'string',
                        enum: ['this_month', 'last_month', 'this_year', 'last_year', 'all_time'],
                        description: 'Time period for statistics'
                    },
                    status: {
                        type: 'string',
                        enum: ['paid', 'unpaid', 'pending', 'all'],
                        description: 'Filter by payment status'
                    }
                },
                required: ['period']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'getTopCompanies',
            description: 'Get top companies by total spending',
            parameters: {
                type: 'object',
                properties: {
                    limit: {
                        type: 'number',
                        description: 'Number of top companies to return (default 5)',
                        default: 5
                    },
                    period: {
                        type: 'string',
                        enum: ['this_month', 'last_month', 'this_year', 'all_time'],
                        description: 'Time period to analyze'
                    }
                }
            }
        }
    }
];

/**
 * Execute function calls from OpenAI
 */
async function executeFunction(functionName, args, authId) {
    console.log(`🔧 Executing function: ${functionName}`, args);

    switch (functionName) {
        case 'searchInvoices':
            return await searchInvoices(args, authId);
        case 'getInvoiceStats':
            return await getInvoiceStats(args, authId);
        case 'getTopCompanies':
            return await getTopCompanies(args, authId);
        default:
            return { error: 'Unknown function' };
    }
}

/**
 * Search invoices with filters
 */
async function searchInvoices(filters, authId) {
    let query = supabase
        .from('invoices')
        .select('*')
        .eq('auth_id', authId);

    if (filters.company) {
        query = query.ilike('company_name', `%${filters.company}%`);
    }
    if (filters.minAmount) {
        query = query.gte('total_amount', filters.minAmount);
    }
    if (filters.maxAmount) {
        query = query.lte('total_amount', filters.maxAmount);
    }
    if (filters.status) {
        query = query.eq('status', filters.status);
    }
    if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
    }
    if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo);
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(20);

    if (error) {
        return { error: error.message };
    }

    return {
        count: data.length,
        invoices: data.map(inv => ({
            invoice_number: inv.invoice_number,
            company: inv.company_name,
            amount: inv.total_amount,
            status: inv.status,
            date: inv.created_at
        }))
    };
}

/**
 * Get invoice statistics for a period
 */
async function getInvoiceStats(params, authId) {
    const { period, status = 'all' } = params;

    let query = supabase
        .from('invoices')
        .select('total_amount, status, created_at')
        .eq('auth_id', authId);

    // Apply date filters based on period
    const now = new Date();
    let startDate;

    switch (period) {
        case 'this_month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'last_month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            query = query.gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());
            break;
        case 'this_year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        case 'last_year':
            startDate = new Date(now.getFullYear() - 1, 0, 1);
            const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);
            query = query.gte('created_at', startDate.toISOString()).lte('created_at', endOfLastYear.toISOString());
            break;
    }

    if (period !== 'last_month' && period !== 'last_year' && startDate) {
        query = query.gte('created_at', startDate.toISOString());
    }

    if (status !== 'all') {
        query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
        return { error: error.message };
    }

    const total = data.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
    const count = data.length;
    const average = count > 0 ? total / count : 0;

    return {
        period,
        total: total.toFixed(2),
        count,
        average: average.toFixed(2),
        status: status === 'all' ? 'all statuses' : status
    };
}

/**
 * Get top companies by spending
 */
async function getTopCompanies(params, authId) {
    const { limit = 5, period } = params;

    let query = supabase
        .from('invoices')
        .select('company_name, total_amount, created_at')
        .eq('auth_id', authId);

    // Apply date filter if period specified
    if (period) {
        const now = new Date();
        let startDate;

        switch (period) {
            case 'this_month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'last_month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                query = query.gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());
                break;
            case 'this_year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
        }

        if (period !== 'last_month' && startDate) {
            query = query.gte('created_at', startDate.toISOString());
        }
    }

    const { data, error } = await query;

    if (error) {
        return { error: error.message };
    }

    // Group by company and sum amounts
    const companyTotals = {};
    data.forEach(inv => {
        const company = inv.company_name || 'Unknown';
        if (!companyTotals[company]) {
            companyTotals[company] = 0;
        }
        companyTotals[company] += parseFloat(inv.total_amount || 0);
    });

    // Sort and get top N
    const topCompanies = Object.entries(companyTotals)
        .map(([company, total]) => ({ company, total: total.toFixed(2) }))
        .sort((a, b) => parseFloat(b.total) - parseFloat(a.total))
        .slice(0, limit);

    return {
        topCompanies,
        period: period || 'all_time'
    };
}

/**
 * Handle chat message
 */
async function handleChatMessage(req, res) {
    try {
        const { message, history = [] } = req.body;
        const authId = req.userId;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        console.log(`💬 Chat request from user ${authId.substring(0, 8)}: "${message}"`);

        // Build messages array for OpenAI
        const messages = [
            {
                role: 'system',
                content: `You are a helpful financial assistant for an invoice management system. You help users understand their invoices and spending patterns. Be concise and friendly. When presenting numbers, format them clearly with currency symbols. If you need to search for invoices or get statistics, use the available functions.`
            },
            ...history,
            {
                role: 'user',
                content: message
            }
        ];

        // Call OpenAI with function calling
        let response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: messages,
            tools: tools,
            tool_choice: 'auto'
        });

        let assistantMessage = response.choices[0].message;

        // Handle function calls
        while (assistantMessage.tool_calls) {
            // Add assistant message to history
            messages.push(assistantMessage);

            // Execute each function call
            for (const toolCall of assistantMessage.tool_calls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);

                const functionResult = await executeFunction(functionName, functionArgs, authId);

                // Add function result to messages
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(functionResult)
                });
            }

            // Get final response from OpenAI
            response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: messages,
                tools: tools,
                tool_choice: 'auto'
            });

            assistantMessage = response.choices[0].message;
        }

        console.log(`✅ AI Response: "${assistantMessage.content}"`);

        res.json({
            message: assistantMessage.content,
            usage: response.usage
        });

    } catch (error) {
        console.error('Error in chat:', error);
        res.status(500).json({ error: 'Failed to process chat message' });
    }
}

module.exports = {
    handleChatMessage
};
