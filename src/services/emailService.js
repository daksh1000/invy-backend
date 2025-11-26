const nodemailer = require('nodemailer');
require('dotenv').config();

// Create reusable transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

/**
 * Send email notification when OAuth token refresh fails
 */
async function sendTokenFailureNotification(userEmail, gmailAccount) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: userEmail,
            subject: '⚠️ Action Required: Reconnect Your Gmail Account - Invoice Monitor',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #dc004e;">⚠️ Gmail Account Reconnection Required</h2>
                    
                    <p>Hello,</p>
                    
                    <p>We were unable to access your Gmail account <strong>${gmailAccount}</strong> to monitor for new invoices.</p>
                    
                    <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                        <strong>What happened?</strong><br>
                        The OAuth token for your Gmail account has expired and could not be automatically refreshed.
                    </div>
                    
                    <div style="background-color: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; margin: 20px 0;">
                        <strong>What you need to do:</strong><br>
                        1. Log in to your Invoice Monitor dashboard<br>
                        2. Remove the affected Gmail account: <strong>${gmailAccount}</strong><br>
                        3. Click "Connect Gmail Account" to reconnect it<br>
                        4. Authorize access again through Google OAuth
                    </div>
                    
                    <p>Once reconnected, we'll resume monitoring your emails for invoices automatically.</p>
                    
                    <p style="margin-top: 30px;">
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
                           style="background-color: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                            Go to Dashboard
                        </a>
                    </p>
                    
                    <p style="color: #666; font-size: 12px; margin-top: 30px;">
                        This is an automated notification from Invoice Monitor.<br>
                        If you have any questions, please contact support.
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`📧 Token failure notification sent to ${userEmail} for account ${gmailAccount}`);
        return true;
    } catch (error) {
        console.error('Error sending token failure notification:', error.message);
        return false;
    }
}

/**
 * Send welcome email when user signs up
 */
async function sendWelcomeEmail(userEmail) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: userEmail,
            subject: '🎉 Welcome to Invoice Monitor!',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #667eea;">🎉 Welcome to Invoice Monitor!</h2>
                    
                    <p>Hello,</p>
                    
                    <p>Thank you for signing up! Your account has been created successfully.</p>
                    
                    <div style="background-color: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0;">
                        <strong>Next Steps:</strong><br>
                        1. Connect your Gmail accounts to start monitoring<br>
                        2. We'll automatically scan for invoice PDFs<br>
                        3. View and manage all your invoices in one place
                    </div>
                    
                    <p style="margin-top: 30px;">
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
                           style="background-color: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                            Get Started
                        </a>
                    </p>
                    
                    <p style="color: #666; font-size: 12px; margin-top: 30px;">
                        Need help? Contact our support team anytime.
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`📧 Welcome email sent to ${userEmail}`);
        return true;
    } catch (error) {
        console.error('Error sending welcome email:', error.message);
        return false;
    }
}

module.exports = {
    sendTokenFailureNotification,
    sendWelcomeEmail
};
