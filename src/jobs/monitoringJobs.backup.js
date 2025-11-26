const cron = require('node-cron');
const axios = require('axios');
const { supabase } = require('../config/supabase');
const { getValidAccessToken } = require('../../tokenHelper');
const { markEmailAsProcessed, isEmailProcessed } = require('../utils/historyManager');
const { uploadPdfToDrive } = require('../services/driveService');

function startMonitoringJobs() {
    console.log('🚀 Background monitoring jobs started');

    // Run immediately on startup
    checkAllUsersEmails();

    // Run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        console.log('\n⏰ [BACKGROUND JOB] Checking all user accounts for new invoices...');
        await checkAllUsersEmails();
    });
}

async function checkAllUsersEmails() {
    try {
        console.log('🔍 Fetching all customers...');
        const { data: customers, error: customersError } = await supabase
            .from('customers')
            .select('id, auth_id, email');

        if (customersError || !customers) {
            console.error('Error fetching customers:', customersError);
            return;
        }

        console.log(`📧 Found ${customers.length} customer(s) to check:`, customers.map(c => c.email));

        for (let customer of customers) {
            await checkCustomerEmails(customer.auth_id);
        }
    } catch (error) {
        console.error('Error in checkAllUsersEmails:', error.message);
    }
}

async function checkCustomerEmails(authId) {
    try {
        const { data: allAccounts, error: accountsError } = await supabase
            .from('connected_accounts')
            .select('*')
            .eq('auth_id', authId);

        if (accountsError || !allAccounts || allAccounts.length === 0) {
            return;
        }

        const shortAuthId = authId.substring(0, 8);
        console.log(`🔍 Checking ${allAccounts.length} account(s) for auth_id ${shortAuthId}:`, allAccounts.map(a => a.gmail_address));

        for (let account of allAccounts) {
            await checkEmailsForAccount(account, authId);
        }
    } catch (error) {
        console.error('Error checking customer emails:', error.message);
    }
}

async function checkEmailsForAccount(account, authId) {
    try {
        // Get fresh access token (refresh if expired)
        const accessToken = await getValidAccessToken(account);

        if (!accessToken) {
            console.error(`❌ No valid token for ${account.gmail_address}`);
            return;
        }

        const accountEmail = account.gmail_address;
        const accountId = account.id;

        // Calculate timestamp for 5 minutes ago (in seconds)
        const fiveMinutesAgo = Math.floor((Date.now() - 5 * 60 * 1000) / 1000);

        const params = new URLSearchParams({
            maxResults: 10,
            q: `has:attachment filename:pdf in:inbox after:${fiveMinutesAgo}`
        });

        const listResponse = await axios.get(
            `https://www.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        const messages = listResponse.data.messages || [];

        // Filter out emails that are already in our persistent history
        const newEmails = messages.filter(msg => !isEmailProcessed(msg.id));

        if (newEmails.length > 0) {
            console.log(`\n📨 [${accountEmail}] Found ${newEmails.length} new PDF email(s)`);

            for (let message of newEmails) {
                const success = await processEmailMessage(message, accessToken, accountEmail, accountId, authId);
                if (success) {
                    markEmailAsProcessed(message.id);
                }
            }
        }

    } catch (error) {
        console.error(`Error checking ${account.gmail_address}:`, error.message);
    }
}

async function processEmailMessage(message, accessToken, accountEmail, accountId, authId) {
    try {
        const messageResponse = await axios.get(
            `https://www.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        const email = messageResponse.data;
        const headers = email.payload.headers;

        const subject = headers.find(h => h.name === 'Subject')?.value || '(No subject)';
        const from = headers.find(h => h.name === 'From')?.value || '(No sender)';
        const date = headers.find(h => h.name === 'Date')?.value || '';

        let attachments = [];
        if (email.payload.parts) {
            attachments = email.payload.parts.filter(
                part => part.filename && part.filename.endsWith('.pdf')
            );
        }

        if (attachments.length === 0) {
            return true; // Mark as processed
        }

        let allAttachmentsProcessed = true;

        for (let attachment of attachments) {
            try {
                const attachmentResponse = await axios.get(
                    `https://www.googleapis.com/gmail/v1/users/me/messages/${message.id}/attachments/${attachment.body.attachmentId}`,
                    {
                        headers: {
                            Authorization: `Bearer ${accessToken}`
                        }
                    }
                );

                const attachmentData = attachmentResponse.data.data;

                // Upload to Google Drive
                const driveFile = await uploadPdfToDrive(accessToken, accountEmail, attachment.filename, attachmentData);

                let driveLink = null;
                if (driveFile) {
                    driveLink = driveFile.webViewLink;
                    console.log(`✅ Uploaded to Drive: ${attachment.filename}`);
                }

                // Send to n8n webhook
                const webhookUrl = process.env.WEBHOOK_URL;
                if (!webhookUrl) {
                    console.error('❌ WEBHOOK_URL is not defined in .env');
                    return false;
                }

                const webhookResponse = await axios.post(
                    webhookUrl,
                    {
                        email_from: from,
                        email_subject: subject,
                        email_date: date,
                        email_id: message.id,
                        attachment_name: attachment.filename,
                        attachment_size: attachment.size,
                        attachment_mime_type: attachment.mimeType,
                        attachment_data: attachmentData,
                        user_email: accountEmail,
                        drive_link: driveLink,
                        timestamp: new Date().toISOString()
                    }
                );

                if (webhookResponse.data && webhookResponse.data.output === 'yes') {
                    const result = webhookResponse.data;

                    // Check if invoice already exists
                    const { data: existingInvoice } = await supabase
                        .from('invoices')
                        .select('id')
                        .eq('auth_id', authId)
                        .eq('invoice_number', result.invoice_number)
                        .limit(1);

                    if (existingInvoice && existingInvoice.length > 0) {
                        // Update existing
                        await supabase
                            .from('invoices')
                            .update({
                                status: result.status,
                                total_amount: result.total_invoice_amount,
                                link: driveLink || result.link,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', existingInvoice[0].id);

                        console.log(`📝 Invoice updated: ${result.invoice_number}`);
                    } else {
                        // Insert new
                        await supabase
                            .from('invoices')
                            .insert([{
                                auth_id: authId,
                                gmail_address: accountEmail,
                                invoice_number: result.invoice_number,
                                company_name: result.company_name,
                                status: result.status,
                                total_amount: result.total_invoice_amount,
                                link: driveLink || result.link,
                                email_from: result.email_from,
                                email_subject: result.email_subject
                            }]);

                        console.log(`✅ Invoice saved: ${result.invoice_number}`);
                    }
                }
            } catch (error) {
                console.error(`Error processing attachment ${attachment.filename}:`, error.message);
                allAttachmentsProcessed = false;
            }
        }

        return allAttachmentsProcessed;

    } catch (error) {
        console.error('Error processing email:', error.message);
        return false;
    }
}

module.exports = { startMonitoringJobs };
