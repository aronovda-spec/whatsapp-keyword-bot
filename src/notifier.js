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

    async sendKeywordAlert(keyword, message, sender, group, messageId, phoneNumber = null, matchType = 'exact', matchedToken = null, attachment = null, isReminder = false, reminderCount = 0, targetUsers = null) {
        let telegramSuccess = false;
        let emailSuccess = false;

        // Send Telegram notification
        if (this.enabled) {
            try {
                const alertMessage = this.formatAlertMessage(keyword, message, sender, group, messageId, phoneNumber, matchType, matchedToken, attachment, isReminder, reminderCount);
                
                // If targetUsers is provided, use it (for reminders to specific user)
                // Otherwise, send to ALL authorized users (for initial alerts)
                const authorizedUsers = targetUsers || this.authorization.getAuthorizedUsers();
                console.log(`📤 Sending global keyword alert to ${authorizedUsers.length} authorized user(s)`);
                
                if (authorizedUsers.length > 0) {
                    const results = await Promise.allSettled(
                        authorizedUsers.map(userId => this.sendWithRetry(alertMessage, userId))
                    );
                    
                    const successCount = results.filter(result => result.status === 'fulfilled').length;
                    const failureCount = results.filter(result => result.status === 'rejected').length;
                    
                    console.log(`📤 Telegram alert sent to ${successCount}/${authorizedUsers.length} users`);
                    if (failureCount > 0) {
                        console.warn(`⚠️ Failed to send Telegram to ${failureCount} users`);
                    }
                    
                    telegramSuccess = successCount > 0;
                } else {
                    console.warn('⚠️ No authorized users found for global keyword alert');
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
                // Pass authorized users to email channel so it can send to each user's email from database
                // If targetUsers is provided, use it (for reminders to specific user)
                // Otherwise, send to ALL authorized users (for initial alerts)
                const emailUsers = targetUsers || this.authorization.getAuthorizedUsers();
                emailSuccess = await this.emailChannel.sendKeywordAlert(
                    keyword, message, sender, group, messageId, phoneNumber, matchType, matchedToken, attachment, emailUsers
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
            // IMPORTANT: Even for global keyword reminders, send reminder only to the specific user whose timer fired
            // The initial alert already went to all authorized users, but each reminder is per-user
            // This ensures that when a user presses /ok, only their reminders stop, not everyone's
            if (reminder.isGlobal) {
                // For global keywords, use sendKeywordAlert but pass only this specific user
                // This ensures correct formatting ("Global Keyword Alert - Reminder") while only sending to one user
                const authorizedUsers = [reminder.userId]; // Only send to this user
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
                    reminder.reminderCount, // reminder count
                    authorizedUsers // Pass only this user, not all authorized users
                );
            } else {
                // For personal keywords, use sendPersonalKeywordAlert as before
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
        
        // Add reminder indicator
        let reminderInfo = '';
        if (reminderCount > 0) {
            const timeElapsed = this.getReminderTimeElapsed(reminderCount);
            reminderInfo = `\n⏰ <b>Reminder</b> - ${timeElapsed}`;
        }
        
        // Add attachment info if present
        let attachmentInfo = '';
        if (attachment) {
            const escapedAttachmentType = this.escapeHtml(attachment.type);
            attachmentInfo = `\n📎 <b>Attachment:</b> ${escapedAttachmentType}`;
            if (attachment.filename) {
                attachmentInfo += ` - ${this.escapeHtml(attachment.filename)}`;
            }
            if (attachment.size) {
                const sizeKB = (attachment.size / 1024).toFixed(2);
                attachmentInfo += ` (${sizeKB} KB)`;
            }
        }
        
        // Escape all user-provided content to prevent HTML parsing errors
        const escapedKeyword = this.escapeHtml(keyword);
        const escapedSender = this.escapeHtml(sender || 'Unknown');
        const escapedGroup = this.escapeHtml(group || 'Unknown');
        const escapedMatchedToken = matchedToken ? this.escapeHtml(matchedToken) : null;
        
        let escapedMatchInfo = '';
        if (matchType === 'fuzzy' && matchedToken) {
            escapedMatchInfo = `\n🔍 <b>Fuzzy Match:</b> "${escapedMatchedToken}" → "${escapedKeyword}"`;
        } else if (matchType === 'exact') {
            escapedMatchInfo = `\n✅ <b>Exact Match</b>`;
        }

        // Update header to indicate type
        const header = reminderCount === 0 
            ? '🚨 <b>Personal Keyword Alert</b>'
            : '⏰ <b>Personal Keyword Alert - Reminder</b>';
        return `${header}

🚨 <b>Keyword:</b> ${escapedKeyword}${escapedMatchInfo}
👤 <b>From:</b> ${escapedSender}
📱 <b>Group:</b> ${escapedGroup}
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
            ? '⏰ <b>Global Keyword Alert - Reminder</b>'
            : '🚨 <b>Global Keyword Alert!</b>';
        
        // Add reminder info if applicable
        let reminderInfo = '';
        if (reminderCount > 0) {
            const timeElapsed = this.getReminderTimeElapsed(reminderCount);
            reminderInfo = `\n⏰ <b>Reminder</b> - ${timeElapsed}`;
        }
        
        // Add attachment info if present
        let attachmentInfo = '';
        if (attachment) {
            const escapedAttachmentType = this.escapeHtml(attachment.type);
            attachmentInfo = `\n📎 <b>Attachment:</b> ${escapedAttachmentType}`;
            if (attachment.filename) {
                attachmentInfo += ` - ${this.escapeHtml(attachment.filename)}`;
            }
            if (attachment.size) {
                const sizeKB = (attachment.size / 1024).toFixed(2);
                attachmentInfo += ` (${sizeKB} KB)`;
            }
        }
        
        const escapedKeyword = this.escapeHtml(keyword);
        const escapedSender = this.escapeHtml(sender || 'Unknown');
        const escapedGroup = this.escapeHtml(group || 'Unknown');
        const escapedMatchedToken = matchedToken ? this.escapeHtml(matchedToken) : null;
        
        let escapedMatchInfo = '';
        if (matchType === 'fuzzy' && matchedToken) {
            escapedMatchInfo = `\n🔍 <b>Fuzzy Match:</b> "${escapedMatchedToken}" → "${escapedKeyword}"`;
        } else if (matchType === 'exact') {
            escapedMatchInfo = `\n✅ <b>Exact Match</b>`;
        }
        
        return `${header}

🔍 <b>Keyword:</b> ${escapedKeyword}${escapedMatchInfo}
👤 <b>Sender:</b> ${escapedSender}
👥 <b>Group:</b> ${escapedGroup}
🕐 <b>Time:</b> ${timestamp}${attachmentInfo}${reminderInfo}

💬 <b>Message:</b>
${this.escapeHtml(truncatedMessage)}

📱 <b>Message ID:</b> ${this.escapeHtml(messageId || 'N/A')}
${reminderCount > 0 ? '⏰ Reply /ok to acknowledge and stop reminders.' : '💡 Reply /ok to acknowledge and stop reminders.'}`;
    }

    getReminderTimeElapsed(reminderCount) {
        // Map reminderCount to actual time elapsed based on schedule: 0, 1, 2, 5, 15, 60, 90 minutes
        // reminderCount 0 = immediate alert (0 minutes)
        // reminderCount 1 = R1 at 1 minute
        // reminderCount 2 = R2 at 2 minutes
        // reminderCount 3 = R3 at 5 minutes
        // reminderCount 4 = R4 at 15 minutes
        // reminderCount 5 = R5 at 60 minutes
        // reminderCount 6 = R6 at 90 minutes
        const timeMap = {
            1: '1 minute ago',
            2: '2 minutes ago',
            3: '5 minutes ago',
            4: '15 minutes ago',
            5: '1 hour ago',
            6: '1.5 hours ago'
        };
        return timeMap[reminderCount] || `${reminderCount} minutes ago`;
    }

    escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    async sendBotStatus(status, details = '', adminOnly = false) {
        if (!this.enabled) return;

        try {
            const message = `🤖 <b>Bot Status Update</b>

📊 <b>Status:</b> ${status}
🕐 <b>Time:</b> ${new Date().toLocaleString()}

${details ? `📝 <b>Details:</b>\n${details}` : ''}`;

            // Determine recipients: admins only or all configured chat IDs
            let recipients = [];
            if (adminOnly) {
                // Get admin users from authorization system
                const adminUsers = this.authorization.getAdminUsers();
                
                // Error handling: Check if no admins found
                if (!adminUsers || adminUsers.length === 0) {
                    console.error('❌ No admin users found! Cannot send admin-only status update.');
                    console.error('⚠️ Sending alert to all users about missing admin configuration.');
                    
                    // Send alert to all users about no admins found
                    const noAdminMessage = `⚠️ <b>Configuration Issue</b>\n\n❌ No admin users found in the system.\n\n📋 Please check:\n• telegram-auth.json (adminUsers)\n• TELEGRAM_ADMIN_USERS environment variable\n• Supabase database (if enabled)\n\nStatus update could not be sent to admins.`;
                    
                    // Send to all configured chat IDs to alert users
                    if (this.chatIds.length > 0) {
                        const alertResults = await Promise.allSettled(
                            this.chatIds.map(chatId => this.sendWithRetry(noAdminMessage, chatId))
                        );
                        const successCount = alertResults.filter(result => result.status === 'fulfilled').length;
                        console.log(`📤 No admin alert sent to ${successCount}/${this.chatIds.length} users`);
                    } else {
                        console.error('❌ No configured chatIds either! Cannot send alert.');
                    }
                    
                    return; // Don't send the original status update
                } else {
                    recipients = adminUsers;
                    console.log(`📤 Sending status update to ${adminUsers.length} admin(s) only`);
                }
            } else {
            // Send to all configured chat IDs (primary notification method)
                recipients = this.chatIds;
            }

            if (recipients.length === 0) {
                console.warn('⚠️ No recipients found for bot status update');
                console.warn('💡 Check TELEGRAM_CHAT_ID and TELEGRAM_ADDITIONAL_CHAT_IDS environment variables');
                return;
            }

            // Send to all recipients
            const results = await Promise.allSettled(
                recipients.map(chatId => this.sendWithRetry(message, chatId))
            );
            
            const successCount = results.filter(result => result.status === 'fulfilled').length;
            const recipientType = adminOnly ? 'admin(s)' : 'configured users';
            console.log(`📤 Status update sent to ${successCount}/${recipients.length} ${recipientType}`);
        } catch (error) {
            logError(error, { context: 'send_bot_status', status, adminOnly });
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
