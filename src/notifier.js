const TelegramBot = require('node-telegram-bot-api');
const { logError, logBotEvent } = require('./logger');
const TelegramAuthorization = require('./telegram-auth');
const EmailChannel = require('./notifiers/emailChannel');
const ReminderManager = require('./reminderManager');

class Notifier {
    constructor() {
        this.bot = null;
        this.chatIds = []; // Support multiple chat IDs
        this.enabled = false;
        this.retryAttempts = 3;
        this.retryDelay = 1000;
        this.authorization = new TelegramAuthorization(); // Authorization system
        this.emailChannel = new EmailChannel(); // Email notifications
        this.reminderManager = new ReminderManager(); // Reminder system
        this.init();
        
        // Listen for reminder events
        this.reminderManager.on('sendReminder', this.handleReminder.bind(this));
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

    async sendKeywordAlert(keyword, message, sender, group, messageId, phoneNumber = null, matchType = 'exact', matchedToken = null, attachment = null, isReminder = false, reminderCount = 0) {
        let telegramSuccess = false;
        let emailSuccess = false;

        // Send Telegram notification
        if (this.enabled) {
            try {
                const alertMessage = this.formatAlertMessage(keyword, message, sender, group, messageId, phoneNumber, matchType, matchedToken, attachment, isReminder, reminderCount);
                
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
                console.log(`📧 Attempting to send email for global keyword: "${keyword}"`);
                emailSuccess = await this.emailChannel.sendKeywordAlert(
                    keyword, message, sender, group, messageId, phoneNumber, matchType, matchedToken, attachment
                );
                console.log(`📧 Email notification ${emailSuccess ? 'sent successfully' : 'failed'} for keyword: "${keyword}"`);
            } catch (error) {
                console.error(`❌ Email notification error for keyword "${keyword}":`, error.message);
                logError(error, {
                    context: 'send_keyword_alert_email',
                    keyword,
                    sender,
                    group
                });
            }
        } else {
            console.log(`📧 Email channel not enabled (channel: ${this.emailChannel ? 'exists' : 'null'}, enabled: ${this.emailChannel?.enabled})`);
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

    async sendPersonalKeywordAlert(keyword, message, sender, group, messageId, phoneNumber = null, targetUserId = null, matchType = 'exact', matchedToken = null, attachment = null, isReminder = false) {
        let telegramSuccess = false;
        let emailSuccess = false;

        // Send Telegram notification
        if (this.enabled && targetUserId) {
            try {
                const reminder = isReminder ? this.reminderManager.getReminders(targetUserId) : null;
                const reminderCount = reminder ? reminder.reminderCount : 0;
                
                const alertMessage = this.formatPersonalAlertMessage(
                    keyword, message, sender, group, messageId, phoneNumber, matchType, matchedToken, attachment, reminderCount
                );
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
                console.log(`📧 Attempting to send email for personal keyword: "${keyword}" to user ${targetUserId}`);
                emailSuccess = await this.emailChannel.sendPersonalKeywordAlert(
                    keyword, message, sender, group, messageId, phoneNumber, targetUserId, matchType, matchedToken, attachment
                );
                console.log(`📧 Email notification ${emailSuccess ? 'sent successfully' : 'failed'} for personal keyword: "${keyword}" to user ${targetUserId}`);
            } catch (error) {
                console.error(`❌ Email notification error for personal keyword "${keyword}" to user ${targetUserId}:`, error.message);
                logError(error, {
                    context: 'send_personal_keyword_alert_email',
                    keyword,
                    targetUserId
                });
            }
        } else {
            console.log(`📧 Email channel not enabled (channel: ${this.emailChannel ? 'exists' : 'null'}, enabled: ${this.emailChannel?.enabled})`);
        }

        return telegramSuccess || emailSuccess;
    }

    /**
     * Handle reminder event from ReminderManager
     */
    async handleReminder(reminder) {
        console.log(`⏰ Sending reminder ${reminder.reminderCount} for user ${reminder.userId} (global: ${reminder.isGlobal || false})`);
        
        try {
            // Use global alert for global keywords, personal alert otherwise
            if (reminder.isGlobal) {
                // Send to ALL authorized users (global keyword reminder)
                await this.sendKeywordAlert(
                    reminder.keyword,
                    reminder.message,
                    reminder.sender,
                    reminder.group,
                    reminder.messageId,
                    reminder.phoneNumber,
                    'exact',
                    null,
                    reminder.attachment,
                    true, // isReminder
                    reminder.reminderCount // reminder count
                );
            } else {
                // Send to specific user (personal keyword reminder)
                await this.sendPersonalKeywordAlert(
                    reminder.keyword,
                    reminder.message,
                    reminder.sender,
                    reminder.group,
                    reminder.messageId,
                    reminder.phoneNumber,
                    reminder.userId,
                    'exact',
                    null,
                    reminder.attachment,
                    true // Mark as reminder
                );
            }
        } catch (error) {
            logError(error, {
                context: 'handle_reminder',
                userId: reminder.userId,
                reminderCount: reminder.reminderCount
            });
        }
    }

    formatPersonalAlertMessage(keyword, message, sender, group, messageId, phoneNumber = null, matchType = 'exact', matchedToken = null, attachment = null, reminderCount = 0) {
        const timestamp = new Date().toLocaleString();
        
        let matchInfo = '';
        if (matchType === 'fuzzy' && matchedToken) {
            matchInfo = `\n🔍 <b>Fuzzy Match:</b> "${matchedToken}" → "${keyword}"`;
        } else if (matchType === 'exact') {
            matchInfo = `\n✅ <b>Exact Match</b>`;
        }
        
        // Add reminder indicator
        let reminderInfo = '';
        if (reminderCount > 0) {
            const timeElapsed = this.getReminderTimeElapsed(reminderCount);
            reminderInfo = `\n⏰ <b>Reminder</b> - ${timeElapsed}`;
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
        
        const header = reminderCount === 0 
            ? '🚨 <b>Keyword Alert</b>'
            : '⏰ <b>Keyword Alert - Reminder</b>';
        
        return `${header}

🚨 <b>Keyword:</b> ${this.escapeHtml(keyword)}${matchInfo}
👤 <b>From:</b> ${this.escapeHtml(sender)}
📱 <b>Group:</b> ${this.escapeHtml(group)}
🕐 <b>Time:</b> ${timestamp}${reminderInfo}${attachmentInfo}

💬 <b>Message:</b>
"${this.escapeHtml(message.substring(0, 200))}${message.length > 200 ? '...' : ''}"

${reminderCount > 0 ? '⏰ Reply /ok to acknowledge and stop reminders.' : '💡 Reply /ok to acknowledge and stop reminders.'}
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

    formatAlertMessage(keyword, message, sender, group, messageId, phoneNumber = null, matchType = 'exact', matchedToken = null, attachment = null, isReminder = false, reminderCount = 0) {
        const timestamp = new Date().toLocaleString();
        const truncatedMessage = message.length > 200 ? message.substring(0, 200) + '...' : message;
        
        // Set header based on reminder status
        const header = isReminder 
            ? '⏰ <b>Keyword Alert - Reminder</b>'
            : '🚨 <b>Keyword Alert!</b>';
        
        // Add reminder info if applicable
        let reminderInfo = '';
        if (reminderCount > 0) {
            const timeElapsed = this.getReminderTimeElapsed(reminderCount);
            reminderInfo = `\n⏰ <b>Reminder</b> - ${timeElapsed}`;
        }
        
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
        
        return `${header}

🔍 <b>Keyword:</b> ${keyword}${matchInfo}
👤 <b>Sender:</b> ${sender || 'Unknown'}
👥 <b>Group:</b> ${group || 'Unknown'}
🕐 <b>Time:</b> ${timestamp}${attachmentInfo}${reminderInfo}

💬 <b>Message:</b>
${this.escapeHtml(truncatedMessage)}

📱 <b>Message ID:</b> ${messageId || 'N/A'}
${reminderCount > 0 ? '⏰ Reply /ok to acknowledge and stop reminders.' : '💡 Reply /ok to acknowledge and stop reminders.'}`;
    }

    getReminderTimeElapsed(reminderCount) {
        const timeMap = {
            1: '1 minute ago',
            2: '2 minutes ago',
            3: '15 minutes ago',
            4: '1 hour ago'
        };
        return timeMap[reminderCount] || `${reminderCount} minutes ago`;
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
