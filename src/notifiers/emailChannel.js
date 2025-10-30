const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { logError, logBotEvent } = require('../logger');
const SupabaseManager = require('../supabase');

class EmailChannel {
    constructor() {
        this.enabled = false;
        this.transporter = null;
        this.recipients = [];
        this.userEmailMap = new Map(); // userId -> email
        this.retryAttempts = 3;
        this.retryDelay = 1000;
        this.supabase = new SupabaseManager(); // Lazy load Supabase
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

            // Create transporter with connection timeout options
            this.transporter = nodemailer.createTransport({
                host: host,
                port: port,
                secure: port === 465, // true for 465, false for other ports
                auth: {
                    user: user,
                    pass: pass
                },
                connectionTimeout: 10000, // 10 seconds to establish connection
                greetingTimeout: 10000, // 10 seconds for greeting
                socketTimeout: 10000, // 10 seconds for socket operations
                pool: true, // Use connection pooling
                maxConnections: 5,
                maxMessages: 100
            });

            // Diagnostic: verify SMTP connectivity/auth
            this.transporter.verify((err, success) => {
                if (err) {
                    console.error('📧 SMTP verify failed:', err.message);
                } else {
                    console.log('📧 SMTP verify: OK');
                }
            });

            // Parse recipients (comma-separated)
            this.recipients = recipients.split(',').map(email => email.trim());

            // Load per-user email mapping (optional)
            this.loadUserEmailMap();

            this.enabled = true;

            logBotEvent('email_initialized', {
                host,
                recipients: this.recipients.length,
                perUserEmails: this.userEmailMap.size
            });

            console.log('✅ Email notifications enabled');
            console.log(`📧 Email will be sent to ${this.recipients.length} global recipients`);
            console.log(`📧 Global recipients: ${this.recipients.join(', ')}`);
            if (this.userEmailMap.size > 0) {
                console.log(`📧 Per-user email mapping: ${this.userEmailMap.size} users`);
            }
        } catch (error) {
            logError(error, { context: 'email_init' });
            console.error('❌ Failed to initialize email:', error.message);
        }
    }

    loadUserEmailMap() {
        try {
            const configPath = path.join(__dirname, '../../config/user-emails.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                this.userEmailMap = new Map(Object.entries(config));
                console.log(`📧 Loaded ${this.userEmailMap.size} per-user email mappings`);
            } else {
                console.log('📧 No per-user email mapping found - using global EMAIL_TO');
            }
        } catch (error) {
            console.warn('⚠️ Could not load per-user email mapping:', error.message);
        }
    }

    // Reload user email mapping from config file (for manual refresh)
    reloadUserEmailMap() {
        console.log('📧 Reloading user email mappings...');
        this.loadUserEmailMap();
        console.log('✅ User email mappings reloaded');
    }

    async getEmailForUser(userId) {
        if (!userId) return null;
        const userIdStr = userId.toString();
        
        // Check local map first (fast)
        let userEmails = this.userEmailMap.get(userIdStr);
        
        // If not found in local map, query Supabase (runtime sync)
        if (!userEmails && this.supabase && this.supabase.isEnabled()) {
            try {
                const email = await this.supabase.getUserEmail(userIdStr);
                if (email) {
                    // Cache in local map for next time
                    this.userEmailMap.set(userIdStr, email);
                    userEmails = email;
                    console.log(`📧 Loaded email from Supabase for user ${userIdStr}`);
                } else {
                    // User has no email in Supabase
                    this.userEmailMap.set(userIdStr, null); // Cache negative result
                }
            } catch (error) {
                console.error(`❌ Error querying Supabase for user ${userIdStr} email:`, error.message);
            }
        }
        
        // Support both single email (string) and multiple emails (array)
        if (Array.isArray(userEmails)) {
            return userEmails; // Return array for multiple emails
        }
        return userEmails ? [userEmails] : null; // Convert single email to array
    }

    async sendKeywordAlert(keyword, message, sender, group, messageId, phoneNumber = null, matchType = 'exact', matchedToken = null, attachment = null) {
        if (!this.enabled) {
            console.log('📧 Email channel disabled, skipping email notification');
            return false;
        }

        console.log(`📧 Preparing to send email for global keyword: "${keyword}" to ${this.recipients.length} recipients`);

        try {
            const emailContent = this.formatEmail(keyword, message, sender, group, messageId, phoneNumber, matchType, matchedToken, attachment);
            
            // Send to all recipients
            const results = await Promise.allSettled(
                this.recipients.map(recipient => this.sendWithRetry(emailContent, recipient))
            );

            const successCount = results.filter(result => result.status === 'fulfilled').length;
            const failureCount = results.filter(result => result.status === 'rejected').length;

            console.log(`📧 Email sent to ${successCount}/${this.recipients.length} recipients for keyword: "${keyword}"`);
            if (failureCount > 0) {
                console.warn(`⚠️ Failed to send email to ${failureCount} recipients for keyword: "${keyword}"`);
                
                // Log detailed failure reasons
                results.forEach((result, index) => {
                    if (result.status === 'rejected') {
                        console.error(`❌ Email to ${this.recipients[index]} failed:`, result.reason?.message || result.reason);
                    }
                });
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

        // If per-user email mapping exists, use it
        const userEmails = await this.getEmailForUser(targetUserId);
        
        if (userEmails && userEmails.length > 0) {
            // Send to all user's emails
            const results = await Promise.allSettled(
                userEmails.map(email => 
                    this.sendToSpecificRecipient(keyword, message, sender, group, messageId, phoneNumber, matchType, matchedToken, attachment, email)
                )
            );
            
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            console.log(`📧 Personal keyword alert sent to ${successCount}/${userEmails.length} emails for user ${targetUserId}`);
            
            return successCount > 0;
        } else {
            // Fallback to all recipients if no per-user mapping
            return await this.sendKeywordAlert(keyword, message, sender, group, messageId, phoneNumber, matchType, matchedToken, attachment);
        }
    }

    async sendToSpecificRecipient(keyword, message, sender, group, messageId, phoneNumber, matchType, matchedToken, attachment, recipientEmail) {
        try {
            const emailContent = this.formatEmail(keyword, message, sender, group, messageId, phoneNumber, matchType, matchedToken, attachment);
            
            await this.sendWithRetry(emailContent, recipientEmail);
            
            console.log(`📧 Email sent to ${recipientEmail}`);
            
            logBotEvent('personal_email_sent', {
                keyword,
                recipient: recipientEmail
            });
            
            return true;
        } catch (error) {
            logError(error, {
                context: 'send_personal_email',
                keyword,
                recipient: recipientEmail
            });
            return false;
        }
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
                console.log(`📧 Attempting to send email (attempt ${attempt}/${this.retryAttempts}) to ${recipient}`);
                await this.transporter.sendMail({
                    from: process.env.EMAIL_SMTP_USER,
                    to: recipient,
                    subject: emailContent.subject,
                    html: emailContent.html,
                    text: emailContent.text
                });
                console.log(`✅ Email sent successfully to ${recipient}`);
                return; // Success
            } catch (error) {
                lastError = error;
                console.error(`❌ Email send attempt ${attempt} to ${recipient} failed:`, error.message);

                if (attempt < this.retryAttempts) {
                    console.log(`📧 Retrying in ${this.retryDelay}ms...`);
                    await this.delay(this.retryDelay);
                }
            }
        }

        console.error(`❌ All ${this.retryAttempts} attempts failed for ${recipient}`);
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

