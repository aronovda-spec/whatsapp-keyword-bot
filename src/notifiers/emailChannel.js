const nodemailer = require('nodemailer');
const { logError, logBotEvent } = require('../logger');

class EmailChannel {
    constructor() {
        this.enabled = false;
        this.transporter = null;
        this.recipients = [];
        this.retryAttempts = 3;
        this.retryDelay = 1000;
        this.init();
    }

    init() {
        try {
            const enabled = process.env.EMAIL_ENABLED === 'true';
            if (!enabled) {
                console.log('📧 Email notifications: Disabled');
                return;
            }

            const host = process.env.EMAIL_SMTP_HOST;
            const port = parseInt(process.env.EMAIL_SMTP_PORT) || 587;
            const user = process.env.EMAIL_SMTP_USER;
            const pass = process.env.EMAIL_SMTP_PASS;
            const recipients = process.env.EMAIL_TO;

            if (!host || !user || !pass || !recipients) {
                console.log('📧 Email credentials not found. Email notifications disabled.');
                return;
            }

            // Create transporter
            this.transporter = nodemailer.createTransport({
                host: host,
                port: port,
                secure: port === 465, // true for 465, false for other ports
                auth: {
                    user: user,
                    pass: pass
                }
            });

            // Parse recipients (comma-separated)
            this.recipients = recipients.split(',').map(email => email.trim());

            this.enabled = true;

            logBotEvent('email_initialized', {
                host,
                recipients: this.recipients.length
            });

            console.log('✅ Email notifications enabled');
            console.log(`📧 Email will be sent to ${this.recipients.length} recipients`);
        } catch (error) {
            logError(error, { context: 'email_init' });
            console.error('❌ Failed to initialize email:', error.message);
        }
    }

    async sendKeywordAlert(keyword, message, sender, group, messageId, phoneNumber = null, matchType = 'exact', matchedToken = null, attachment = null) {
        if (!this.enabled) {
            return false;
        }

        try {
            const emailContent = this.formatEmail(keyword, message, sender, group, messageId, phoneNumber, matchType, matchedToken, attachment);
            
            // Send to all recipients
            const results = await Promise.allSettled(
                this.recipients.map(recipient => this.sendWithRetry(emailContent, recipient))
            );

            const successCount = results.filter(result => result.status === 'fulfilled').length;
            const failureCount = results.filter(result => result.status === 'rejected').length;

            console.log(`📧 Email sent to ${successCount}/${this.recipients.length} recipients`);
            if (failureCount > 0) {
                console.warn(`⚠️ Failed to send email to ${failureCount} recipients`);
            }

            logBotEvent('email_alert_sent', {
                keyword,
                sender,
                group,
                messageId,
                successCount,
                failureCount
            });

            return successCount > 0;
        } catch (error) {
            logError(error, {
                context: 'send_email_alert',
                keyword,
                sender,
                group
            });
            return false;
        }
    }

    async sendPersonalKeywordAlert(keyword, message, sender, group, messageId, phoneNumber = null, targetUserId = null, matchType = 'exact', matchedToken = null, attachment = null) {
        if (!this.enabled) {
            return false;
        }

        // For email, we can send to all recipients or filter
        // For simplicity, send to all recipients
        return await this.sendKeywordAlert(keyword, message, sender, group, messageId, phoneNumber, matchType, matchedToken, attachment);
    }

    formatEmail(keyword, message, sender, group, messageId, phoneNumber = null, matchType = 'exact', matchedToken = null, attachment = null) {
        const timestamp = new Date().toLocaleString();
        const truncatedMessage = message.length > 500 ? message.substring(0, 500) + '...' : message;

        let matchInfo = '';
        if (matchType === 'fuzzy' && matchedToken) {
            matchInfo = `\nFuzzy Match: "${matchedToken}" → "${keyword}"`;
        } else if (matchType === 'exact') {
            matchInfo = '\nExact Match';
        }

        let attachmentInfo = '';
        if (attachment) {
            attachmentInfo = `\nAttachment: ${attachment.type}`;
            if (attachment.filename) {
                attachmentInfo += ` - ${attachment.filename}`;
            }
            if (attachment.size) {
                const sizeKB = (attachment.size / 1024).toFixed(2);
                attachmentInfo += ` (${sizeKB} KB)`;
            }
        }

        const subject = `🚨 Keyword Alert: ${keyword}`;
        
        const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .alert { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 10px 0; }
        .info { background-color: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px; margin: 10px 0; }
        .message { background-color: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
        strong { color: #2196F3; }
        .keyword { background-color: #ffeb3b; padding: 2px 6px; border-radius: 3px; font-weight: bold; }
        .attachment { background-color: #f0f0f0; padding: 10px; margin: 10px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <h2 style="color: #d32f2f;">🚨 Keyword Alert</h2>
    
    <div class="info">
        <p><strong>Keyword:</strong> <span class="keyword">${keyword}</span>${matchInfo}</p>
        <p><strong>Sender:</strong> ${sender || 'Unknown'}</p>
        <p><strong>Group:</strong> ${group || 'Unknown'}</p>
        <p><strong>Detected by:</strong> ${phoneNumber || 'Unknown Phone'}</p>
        <p><strong>Time:</strong> ${timestamp}${attachmentInfo ? `<br/>${attachmentInfo}` : ''}</p>
    </div>

    <div class="message">
        <strong>Message:</strong><br/>
        ${this.escapeHtml(truncatedMessage)}
    </div>

    <div class="alert">
        <strong>Message ID:</strong> ${messageId || 'N/A'}
    </div>

    <p style="color: #666; font-size: 12px; margin-top: 20px;">
        This is an automated alert from WhatsApp Keyword Bot.<br/>
        Keywords are detected using fuzzy matching for multi-language support (Hebrew, English, Russian).
    </p>
</body>
</html>
        `;

        return {
            subject,
            html: htmlBody,
            text: this.formatPlainText(keyword, message, sender, group, messageId, phoneNumber, matchType, matchedToken, attachment)
        };
    }

    formatPlainText(keyword, message, sender, group, messageId, phoneNumber, matchType, matchedToken, attachment) {
        const timestamp = new Date().toLocaleString();
        
        let matchInfo = '';
        if (matchType === 'fuzzy' && matchedToken) {
            matchInfo = `\nFuzzy Match: "${matchedToken}" → "${keyword}"`;
        }

        let attachmentInfo = '';
        if (attachment) {
            attachmentInfo = `\nAttachment: ${attachment.type} - ${attachment.filename || 'no filename'}`;
        }

        return `🚨 Keyword Alert: ${keyword}${matchInfo}

Sender: ${sender || 'Unknown'}
Group: ${group || 'Unknown'}
Time: ${timestamp}${attachmentInfo}

Message:
${message}

Message ID: ${messageId || 'N/A'}`;
    }

    async sendWithRetry(emailContent, recipient) {
        let lastError;

        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                await this.transporter.sendMail({
                    from: process.env.EMAIL_SMTP_USER,
                    to: recipient,
                    subject: emailContent.subject,
                    html: emailContent.html,
                    text: emailContent.text
                });
                return; // Success
            } catch (error) {
                lastError = error;

                if (attempt < this.retryAttempts) {
                    console.log(`📧 Email send attempt ${attempt} failed, retrying in ${this.retryDelay}ms...`);
                    await this.delay(this.retryDelay);
                }
            }
        }

        throw lastError;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
            .replace(/\n/g, '<br/>');
    }
}

module.exports = EmailChannel;

