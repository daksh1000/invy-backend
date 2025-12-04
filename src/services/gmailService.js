const axios = require('axios');
const { supabase } = require('../config/supabase');
const { uploadPdfToDrive, deleteFileFromDrive } = require('./driveService');

async function processEmailsForAccount(account, authId) {
    const accountToken = account.access_token;
    const accountEmail = account.gmail_address;
    const accountId = account.id;

    try {
        const params = new URLSearchParams({
            maxResults: 10,
            q: 'has:attachment filename:pdf in:inbox'
        });

        const listResponse = await axios.get(
            `https://www.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
            {
                headers: {
                    Authorization: `Bearer ${accountToken}`
                }
            }
        );

        const messages = listResponse.data.messages || [];

        return { messages, accountEmail, accountId, accountToken };
    } catch (error) {
        console.error(`Error checking ${accountEmail}:`, error.message);
        return null;
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

        for (let attachment of attachments) {
            await processAttachment(message.id, attachment, accessToken, from, subject, date, accountEmail, accountId, authId);
        }
    } catch (error) {
        console.error('Error processing email:', error.message);
    }
}

async function processAttachment(messageId, attachment, accessToken, from, subject, date, accountEmail, accountId, authId) {
    try {
        const attachmentResponse = await axios.get(
            `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachment.body.attachmentId}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        const attachmentData = attachmentResponse.data.data;

        const driveFile = await uploadPdfToDrive(attachment.filename, attachmentData);
        const driveFileId = driveFile?.fileId;
        const driveFileLink = driveFile?.webViewLink;

        const webhookUrl = process.env.WEBHOOK_URL;
        if (!webhookUrl) {
            console.error('WEBHOOK_URL is not defined');
            return;
        }

        const webhookResponse = await axios.post(
            webhookUrl,
            {
                email_from: from,
                email_subject: subject,
                email_date: date,
                email_id: messageId,
                attachment_name: attachment.filename,
                attachment_size: attachment.size,
                attachment_mime_type: attachment.mimeType,
                attachment_data: attachmentData,
                drive_file_id: driveFileId,
                drive_file_link: driveFileLink,
                user_email: accountEmail,
                timestamp: new Date().toISOString()
            }
        );

        console.log(`✅ Sent to webhook: ${attachment.filename}`);

        if (webhookResponse.data && webhookResponse.data.output === 'yes') {
            const result = webhookResponse.data;
            await saveInvoiceToDatabase(result, authId, accountEmail);
        } else if (webhookResponse.data && webhookResponse.data.output === 'no') {
            console.log('❌ Not an invoice - Deleting from Drive');
            await deleteFileFromDrive(driveFileId);
        }
    } catch (error) {
        console.error('Error processing attachment:', error.message);
    }
}

async function saveInvoiceToDatabase(result, authId, accountEmail) {
    try {
        // Debug logging
        console.log('💾 Saving invoice to database:');
        console.log('   Invoice Number:', result.invoice_number);
        console.log('   Currency from webhook:', result.currency);
        console.log('   Full result object:', JSON.stringify(result, null, 2));

        const { data: existingInvoice } = await supabase
            .from('invoices')
            .select('id')
            .eq('auth_id', authId)
            .eq('invoice_number', result.invoice_number)
            .limit(1);

        if (existingInvoice && existingInvoice.length > 0) {
            const updateData = {
                status: result.status,
                total_amount: result.total_invoice_amount,
                link: result.link,
                category: result.category,
                currency: result.currency || 'USD',
                updated_at: new Date().toISOString()
            };

            console.log('   Updating with currency:', updateData.currency);

            await supabase
                .from('invoices')
                .update(updateData)
                .eq('id', existingInvoice[0].id);

            console.log(`📝 Invoice updated: ${result.invoice_number}`);
        } else {
            const insertData = {
                auth_id: authId,
                gmail_address: accountEmail,
                invoice_number: result.invoice_number,
                company_name: result.company_name,
                status: result.status,
                total_amount: result.total_invoice_amount,
                link: result.link,
                email_from: result.email_from,
                email_subject: result.email_subject,
                category: result.category,
                currency: result.currency || 'USD'
            };

            console.log('   Inserting with currency:', insertData.currency);

            await supabase
                .from('invoices')
                .insert([insertData]);

            console.log(`✅ Invoice saved: ${result.invoice_number}`);
        }
    } catch (error) {
        console.error('Error saving invoice:', error.message);
    }
}

module.exports = {
    processEmailsForAccount,
    processEmailMessage,
    saveInvoiceToDatabase
};
