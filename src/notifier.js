const TelegramBot = require('node-telegram-bot-api');
const { logError, logBotEvent } = require('./logger');
const TelegramAuthorization = require('./telegram-auth');
const EmailChannel = require('./notifiers/emailChannel');

class Notifier {
    constructor() {
        this.bot = null;
        this.chatIds = []; // Support multiple chat IDs
        this.enabled = false;
        this.retryAttempts = 3;
        this.retryDelay = 1000;
        this.authorization = new TelegramAuthorization(); // Authorization system
        this.emailChannel = new EmailChannel(); // Email notifications
        this.init();
    }

    init() {
        try {
            const token = process.env.TELEGRAM_BOT_TOKEN;
            const chatId = process.env.TELEGRAM_CHAT_ID;
            const additionalChatIds = process.env.TELEGRAM_ADDITIONAL_CHAT_IDS;

            if (!token || !chatId) {
                console.warn('Telegram credentials not found. Notifications disabled.');
                return;
            }

            this.bot = new TelegramBot(token, { polling: false });
            
            // Primary chat ID
            this.chatIds.push(chatId);
            
            // Additional chat IDs (comma-separated)
            if (additionalChatIds) {
                const additionalIds = additionalChatIds.split(',').map(id => id.trim());
                this.chatIds.push(...additionalIds);
            }

            this.enabled = true;

            logBotEvent('telegram_initialized', { 
                primaryChatId: chatId,
                totalChatIds: this.chatIds.length,
                allChatIds: this.chatIds
            });
            console.log('✅ Telegram notifications enabled');
            console.log(`📱 Notifications will be sent to ${this.chatIds.length} users`);
        } catch (error) {
            logError(error, { context: 'telegram_init' });
            console.error('❌ Failed to initialize Telegram bot:', error.message);
        }
    }

    async sendKeywordAlert(keyword, message, sender, group, messageId, phoneNumber = null, matchType = 'exact', matchedToken = null, attachment = null) {
        let telegramSuccess = false;
        let emailSuccess = false;

        // Send Telegram notification
        if (this.enabled) {
            try {
                const alertMessage = this.formatAlertMessage(keyword, message, sender, group, messageId, phoneNumber, matchType, matchedToken, attachment);
                
                // Send to all authorized chat IDs only
                const authorizedChatIds = this.chatIds.filter(chatId => 
                    this.authorization.isAuthorized(chatId)
                );
                
                if (authorizedChatIds.length > 0) {
                    const results = await Promise.allSettled(
                        authorizedChatIds.map(chatId => this.sendWithRetry(alertMessage, chatId))
                    );
                    
                    const successCount = results.filter(result => result.status === 'fulfilled').length;
                    const failureCount = results.filter(result => result.status === 'rejected').length;
                    
                    console.log(`📤 Telegram alert sent to ${successCount}/${authorizedChatIds.length} users`);
                    if (failureCount > 0) {
                        console.warn(`⚠️ Failed to send Telegram to ${failureCount} users`);
                    }
                    
                    telegramSuccess = successCount > 0;
                }
            } catch (error) {
                logError(error, {
                    context: 'send_keyword_alert_telegram',
                    keyword,
                    sender,
                    group,
                    phoneNumber
                });
            }
        }

        // Send Email notification
        if (this.emailChannel && this.emailChannel.enabled) {
            try {
                emailSuccess = await this.emailChannel.sendKeywordAlert(
                    keyword, message, sender, group, messageId, phoneNumber, matchType, matchedToken, attachment
                );
            } catch (error) {
                logError(error, {
                    context: 'send_keyword_alert_email',
                    keyword,
                    sender,
                    group
                });
            }
        }

        // Log combined results
        logBotEvent('keyword_alert_sent', {
            keyword,
            sender,
            group,
            messageId,
            phoneNumber,
            telegramSuccess,
            emailSuccess
        });

        return telegramSuccess || emailSuccess;
    }

    async sendPersonalKeywordAlert(keyword, message, sender, group, messageId, phoneNumber = null, targetUserId = null, matchType = 'exact', matchedToken = null, attachment = null) {
        let telegramSuccess = false;
        let emailSuccess = false;

        // Send Telegram notification
        if (this.enabled && targetUserId) {
            try {
                const alertMessage = this.formatPersonalAlertMessage(keyword, message, sender, group, messageId, phoneNumber, matchType, matchedToken, attachment);
                telegramSuccess = await this.sendWithRetry(alertMessage, targetUserId);
            } catch (error) {
                logError(error, {
                    context: 'send_personal_keyword_alert_telegram',
                    keyword,
                    targetUserId
                });
            }
        }

        // Send Email notification
        if (this.emailChannel && this.emailChannel.enabled) {
            try {
                emailSuccess = await this.emailChannel.sendPersonalKeywordAlert(
                    keyword, message, sender, group, messageId, phoneNumber, targetUserId, matchType, matchedToken, attachment
                );
            } catch (error) {
                logError(error, {
                    context: 'send_personal_keyword_alert_email',
                    keyword,
                    targetUserId
                });
            }
        }

        return telegramSuccess || emailSuccess;
    }

    formatPersonalAlertMessage(keyword, message, sender, group, messageId, phoneNumber = null, matchType = 'exact', matchedToken = null, attachment = null) {
        const timestamp = new Date().toLocaleString();
        const phoneInfo = phoneNumber ? ` (via ${phoneNumber})` : '';
        
        let matchInfo = '';
        if (matchType === 'fuzzy' && matchedToken) {
            matchInfo = `\n🔍 <b>Fuzzy Match:</b> "${matchedToken}" → "${keyword}"`;
        } else if (matchType === 'exact') {
            matchInfo = `\n✅ <b>Exact Match</b>`;
        }
        
        // Add attachment info if present
        let attachmentInfo = '';
        if (attachment) {
            attachmentInfo = `\n📎 <b>Attachment:</b> ${attachment.type}`;
            if (attachment.filename) {
                attachmentInfo += ` - ${this.escapeHtml(attachment.filename)}`;
            }
            if (attachment.size) {
                const sizeKB = (attachment.size / 1024).toFixed(2);
                attachmentInfo += ` (${sizeKB} KB)`;
            }
        }
        
        return `🔑 <b>Personal Keyword Alert</b>

🚨 <b>Keyword:</b> ${this.escapeHtml(keyword)}${matchInfo}
👤 <b>From:</b> ${this.escapeHtml(sender)}
📱 <b>Group:</b> ${this.escapeHtml(group)}${phoneInfo}
🕐 <b>Time:</b> ${timestamp}${attachmentInfo}

💬 <b>Message:</b>
"${this.escapeHtml(message.substring(0, 200))}${message.length > 200 ? '...' : ''}"

🔑 <i>This is a personal keyword notification</i>`;
    }

    async sendWithRetry(message, chatId = null) {
        const targetChatId = chatId || this.chatIds[0]; // Use provided chatId or primary
        let lastError;
        
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                await this.bot.sendMessage(targetChatId, message, {
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                });
                return; // Success
            } catch (error) {
                lastError = error;
                
                if (attempt < this.retryAttempts) {
                    console.log(`📱 Telegram send attempt ${attempt} failed, retrying in ${this.retryDelay}ms...`);
                    await this.delay(this.retryDelay);
                }
            }
        }
        
        throw lastError;
    }

    formatAlertMessage(keyword, message, sender, group, messageId, phoneNumber = null, matchType = 'exact', matchedToken = null, attachment = null) {
        const timestamp = new Date().toLocaleString();
        const truncatedMessage = message.length > 200 ? message.substring(0, 200) + '...' : message;
        
        let matchInfo = '';
        if (matchType === 'fuzzy' && matchedToken) {
            matchInfo = `\n🔍 <b>Fuzzy Match:</b> "${matchedToken}" → "${keyword}"`;
        } else if (matchType === 'exact') {
            matchInfo = `\n✅ <b>Exact Match</b>`;
        }
        
        // Add attachment info if present
        let attachmentInfo = '';
        if (attachment) {
            attachmentInfo = `\n📎 <b>Attachment:</b> ${attachment.type}`;
            if (attachment.filename) {
                attachmentInfo += ` - ${this.escapeHtml(attachment.filename)}`;
            }
            if (attachment.size) {
                const sizeKB = (attachment.size / 1024).toFixed(2);
                attachmentInfo += ` (${sizeKB} KB)`;
            }
        }
        
        return `🚨 <b>Keyword Alert!</b>

🔍 <b>Keyword:</b> ${keyword}${matchInfo}
👤 <b>Sender:</b> ${sender || 'Unknown'}
👥 <b>Group:</b> ${group || 'Unknown'}
📱 <b>Detected by:</b> ${phoneNumber || 'Unknown Phone'}
🕐 <b>Time:</b> ${timestamp}${attachmentInfo}

💬 <b>Message:</b>
${this.escapeHtml(truncatedMessage)}

📱 <b>Message ID:</b> ${messageId || 'N/A'}`;
    }

    escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    async sendBotStatus(status, details = '') {
        if (!this.enabled) return;

        try {
            const message = `🤖 <b>Bot Status Update</b>

📊 <b>Status:</b> ${status}
🕐 <b>Time:</b> ${new Date().toLocaleString()}

${details ? `📝 <b>Details:</b>\n${details}` : ''}`;

            // Send to all configured chat IDs (primary notification method)
            const results = await Promise.allSettled(
                this.chatIds.map(chatId => this.sendWithRetry(message, chatId))
            );
            
            const successCount = results.filter(result => result.status === 'fulfilled').length;
            console.log(`📤 Status update sent to ${successCount}/${this.chatIds.length} configured users`);
        } catch (error) {
            logError(error, { context: 'send_bot_status', status });
        }
    }

    async sendCriticalAlert(alertType, details = '') {
        if (!this.enabled) return;

        try {
            const message = `🚨 <b>CRITICAL ALERT - ${alertType}</b>

📊 <b>Status:</b> ${alertType}
🕐 <b>Time:</b> ${new Date().toLocaleString()}

${details ? `📝 <b>Details:</b>\n${details}` : ''}

⚠️ <b>This affects ALL users!</b>`;

            // Send to ALL authorized users (not just configured chat IDs)
            const allAuthorizedUsers = this.authorization.getAuthorizedUsers();
            const allChatIds = [...new Set([...this.chatIds, ...allAuthorizedUsers])]; // Combine and deduplicate

            const results = await Promise.allSettled(
                allChatIds.map(chatId => this.sendWithRetry(message, chatId))
            );
            
            const successCount = results.filter(result => result.status === 'fulfilled').length;
            console.log(`🚨 Critical alert sent to ${successCount}/${allChatIds.length} authorized users`);
            
            logBotEvent('critical_alert_sent', {
                alertType,
                totalUsers: allChatIds.length,
                successCount,
                details: details.substring(0, 100) // Truncate for logging
            });
        } catch (error) {
            logError(error, { context: 'send_critical_alert', alertType });
        }
    }

    async sendTestMessage() {
        if (!this.enabled) {
            console.log('📱 Telegram notifications disabled - cannot send test message');
            return false;
        }

        try {
            const message = `🧪 <b>Test Message</b>

✅ WhatsApp Keyword Bot is working!
🕐 <b>Time:</b> ${new Date().toLocaleString()}

This is a test message to verify Telegram notifications are working correctly.`;

            await this.sendWithRetry(message);
            console.log('✅ Test message sent successfully');
            return true;
        } catch (error) {
            logError(error, { context: 'send_test_message' });
            console.error('❌ Failed to send test message:', error.message);
            return false;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    isEnabled() {
        return this.enabled;
    }

    getChatId() {
        return this.chatId;
    }
}

module.exports = Notifier;
