const axios = require('axios');
const { supabase } = require('../config/supabase');
const { uploadPdfToDrive } = require('../services/driveService');
const { saveInvoiceToDatabase } = require('../services/gmailService');
const { getValidAccessToken } = require('../../tokenHelper');

async function handleFileUpload(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const userId = req.userId;
        const file = req.file;
        const base64Data = file.buffer.toString('base64');

        // 1. Always fetch user email from customers table (Signup Account)
        const { data: customer } = await supabase
            .from('customers')
            .select('email')
            .eq('auth_id', userId)
            .single();

        // Use customer email or fallback if somehow not found (shouldn't happen for valid users)
        let userEmail = customer ? customer.email : 'manual_upload@invy.app';

        // 2. Try to find a connected account ONLY for Drive upload (optional)
        let driveFileId = null;
        let driveFileLink = null;

        const { data: accounts } = await supabase
            .from('connected_accounts')
            .select('*')
            .eq('auth_id', userId)
            .limit(1);

        if (accounts && accounts.length > 0) {
            const account = accounts[0];
            try {
                const accessToken = await getValidAccessToken(account);
                if (accessToken) {
                    // Upload to the connected account's Drive, but associate with signup email
                    const driveFile = await uploadPdfToDrive(accessToken, userEmail, file.originalname, base64Data);
                    if (driveFile) {
                        driveFileId = driveFile.fileId;
                        driveFileLink = driveFile.webViewLink;
                    }
                }
            } catch (driveError) {
                console.warn('Failed to upload to Drive:', driveError.message);
                // Continue without Drive upload
            }
        }

        // 3. Send to Webhook
        const webhookUrl = process.env.WEBHOOK_URL;
        if (!webhookUrl) {
            console.error('WEBHOOK_URL is not defined');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        const webhookResponse = await axios.post(
            webhookUrl,
            {
                email_from: 'Manual Upload',
                email_subject: `Manual Upload: ${file.originalname}`,
                email_date: new Date().toISOString(),
                email_id: `manual_${Date.now()}`,
                attachment_name: file.originalname,
                attachment_size: file.size,
                attachment_mime_type: file.mimetype,
                attachment_data: base64Data,
                drive_file_id: driveFileId,
                drive_file_link: driveFileLink,
                user_email: userEmail,
                timestamp: new Date().toISOString()
            }
        );

        // 4. Process Webhook Response
        if (webhookResponse.data && webhookResponse.data.output === 'yes') {
            const result = webhookResponse.data;
            await saveInvoiceToDatabase(result, userId, userEmail);
            return res.status(200).json({ message: 'Invoice processed successfully', invoice: result });
        } else {
            return res.status(400).json({ error: 'File was not recognized as an invoice' });
        }

    } catch (error) {
        console.error('Error handling file upload:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    handleFileUpload
};
