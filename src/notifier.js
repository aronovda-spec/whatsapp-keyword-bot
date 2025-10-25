const TelegramBot = require('node-telegram-bot-api');
const { logError, logBotEvent } = require('./logger');
const TelegramAuthorization = require('./telegram-auth');

class Notifier {
    constructor() {
        this.bot = null;
        this.chatIds = []; // Support multiple chat IDs
        this.enabled = false;
        this.retryAttempts = 3;
        this.retryDelay = 1000;
        this.authorization = new TelegramAuthorization(); // Authorization system
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

    async sendKeywordAlert(keyword, message, sender, group, messageId, phoneNumber = null, matchType = 'exact', matchedToken = null) {
        if (!this.enabled) {
            console.log('📱 Telegram notifications disabled');
            return false;
        }

        try {
            const alertMessage = this.formatAlertMessage(keyword, message, sender, group, messageId, phoneNumber, matchType, matchedToken);
            
            // Send to all authorized chat IDs only
            const authorizedChatIds = this.chatIds.filter(chatId => 
                this.authorization.isAuthorized(chatId)
            );
            
            if (authorizedChatIds.length === 0) {
                console.log('⚠️ No authorized users to send alerts to');
                return false;
            }
            
            const results = await Promise.allSettled(
                authorizedChatIds.map(chatId => this.sendWithRetry(alertMessage, chatId))
            );
            
            const successCount = results.filter(result => result.status === 'fulfilled').length;
            const failureCount = results.filter(result => result.status === 'rejected').length;
            
            console.log(`📤 Alert sent to ${successCount}/${this.chatIds.length} users`);
            if (failureCount > 0) {
                console.warn(`⚠️ Failed to send to ${failureCount} users`);
            }
            
            logBotEvent('keyword_alert_sent', {
                keyword,
                sender,
                group,
                messageId,
                phoneNumber,
                successCount,
                failureCount,
                totalUsers: this.chatIds.length
            });

            return successCount > 0;
        } catch (error) {
            logError(error, {
                context: 'send_keyword_alert',
                keyword,
                sender,
                group,
                phoneNumber
            });
            return false;
        }
    }

    async sendPersonalKeywordAlert(keyword, message, sender, group, messageId, phoneNumber = null, targetUserId = null, matchType = 'exact', matchedToken = null) {
        if (!this.enabled) {
            console.log('📱 Telegram notifications disabled');
            return false;
        }

        if (!targetUserId) {
            console.log('⚠️ No target user ID provided for personal keyword alert');
            return false;
        }

        try {
            const alertMessage = this.formatPersonalAlertMessage(keyword, message, sender, group, messageId, phoneNumber, matchType, matchedToken);
            
            // Send only to the specific user
            const success = await this.sendWithRetry(alertMessage, targetUserId);
            
            if (success) {
                logBotEvent('personal_keyword_alert_sent', {
                    keyword,
                    sender,
                    group,
                    messageId,
                    phoneNumber,
                    targetUserId
                });
            }
            
            return success;
        } catch (error) {
            logError(error, {
                context: 'send_personal_keyword_alert',
                keyword,
                sender,
                group,
                phoneNumber,
                targetUserId
            });
            return false;
        }
    }

    formatPersonalAlertMessage(keyword, message, sender, group, messageId, phoneNumber = null, matchType = 'exact', matchedToken = null) {
        const timestamp = new Date().toLocaleString();
        const phoneInfo = phoneNumber ? ` (via ${phoneNumber})` : '';
        
        let matchInfo = '';
        if (matchType === 'fuzzy' && matchedToken) {
            matchInfo = `\n🔍 <b>Fuzzy Match:</b> "${matchedToken}" → "${keyword}"`;
        } else if (matchType === 'exact') {
            matchInfo = `\n✅ <b>Exact Match</b>`;
        }
        
        return `🔑 <b>Personal Keyword Alert</b>

🚨 <b>Keyword:</b> ${this.escapeHtml(keyword)}${matchInfo}
👤 <b>From:</b> ${this.escapeHtml(sender)}
📱 <b>Group:</b> ${this.escapeHtml(group)}${phoneInfo}
🕐 <b>Time:</b> ${timestamp}

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

    formatAlertMessage(keyword, message, sender, group, messageId, phoneNumber = null, matchType = 'exact', matchedToken = null) {
        const timestamp = new Date().toLocaleString();
        const truncatedMessage = message.length > 200 ? message.substring(0, 200) + '...' : message;
        
        let matchInfo = '';
        if (matchType === 'fuzzy' && matchedToken) {
            matchInfo = `\n🔍 <b>Fuzzy Match:</b> "${matchedToken}" → "${keyword}"`;
        } else if (matchType === 'exact') {
            matchInfo = `\n✅ <b>Exact Match</b>`;
        }
        
        return `🚨 <b>Keyword Alert!</b>

🔍 <b>Keyword:</b> ${keyword}${matchInfo}
👤 <b>Sender:</b> ${sender || 'Unknown'}
👥 <b>Group:</b> ${group || 'Unknown'}
📱 <b>Detected by:</b> ${phoneNumber || 'Unknown Phone'}
🕐 <b>Time:</b> ${timestamp}

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
