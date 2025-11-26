const axios = require('axios');

async function ensureFolderStructure(accessToken, email) {
    try {
        const year = new Date().getFullYear().toString();

        let userFolderId = await findOrCreateFolder(accessToken, email, 'root');
        let yearFolderId = await findOrCreateFolder(accessToken, year, userFolderId);
        let invoicesFolderId = await findOrCreateFolder(accessToken, 'invoices', yearFolderId);

        console.log('✅ Folder structure ready');
        console.log(`   📁 ${email}/${year}/invoices/`);

        return invoicesFolderId;
    } catch (error) {
        console.error('Error creating folder structure:', error.message);
        return null;
    }
}

async function findOrCreateFolder(accessToken, folderName, parentId) {
    try {
        const searchResponse = await axios.get(
            `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        );

        if (searchResponse.data.files.length > 0) {
            return searchResponse.data.files[0].id;
        } else {
            const createResponse = await axios.post(
                'https://www.googleapis.com/drive/v3/files',
                {
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [parentId]
                },
                {
                    headers: { Authorization: `Bearer ${accessToken}` }
                }
            );

            console.log(`   Created folder: ${folderName}`);
            return createResponse.data.id;
        }
    } catch (error) {
        console.error('Error with folder:', error.message);
        throw error;
    }
}

async function uploadPdfToDrive(accessToken, email, fileName, pdfBase64Data) {
    try {
        // Ensure folder exists for this user
        const invoicesFolderId = await ensureFolderStructure(accessToken, email);

        if (!invoicesFolderId) {
            throw new Error('Could not determine invoices folder ID');
        }

        const pdfBuffer = Buffer.from(pdfBase64Data, 'base64');
        const FormData = require('form-data');
        const form = new FormData();

        form.append('metadata', JSON.stringify({
            name: fileName,
            mimeType: 'application/pdf',
            parents: [invoicesFolderId]
        }), { contentType: 'application/json' });

        form.append('file', pdfBuffer, {
            filename: fileName,
            contentType: 'application/pdf'
        });

        const response = await axios.post(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
            form,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    ...form.getHeaders()
                }
            }
        );

        console.log(`✅ PDF uploaded to Drive: ${fileName}`);
        return {
            fileId: response.data.id,
            webViewLink: response.data.webViewLink
        };
    } catch (error) {
        console.error('Error uploading to Drive:', error.message);
        console.error('Status:', error.response?.status);
        console.error('Error Details:', error.response?.data);
        return null;
    }
}

async function deleteFileFromDrive(accessToken, driveFileId) {
    try {
        await axios.delete(
            `https://www.googleapis.com/drive/v3/files/${driveFileId}`,
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        );

        console.log(`🗑️  Deleted file from Drive: ${driveFileId}`);
        return true;
    } catch (error) {
        console.error('Error deleting file:', error.message);
        return false;
    }
}

module.exports = {
    ensureFolderStructure,
    findOrCreateFolder,
    uploadPdfToDrive,
    deleteFileFromDrive
};
