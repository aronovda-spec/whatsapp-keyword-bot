const TelegramBot = require('node-telegram-bot-api');
const { logError, logBotEvent } = require('./logger');

class Notifier {
    constructor() {
        this.bot = null;
        this.chatId = null;
        this.enabled = false;
        this.retryAttempts = 3;
        this.retryDelay = 1000;
        this.init();
    }

    init() {
        try {
            const token = process.env.TELEGRAM_BOT_TOKEN;
            const chatId = process.env.TELEGRAM_CHAT_ID;

            if (!token || !chatId) {
                console.warn('Telegram credentials not found. Notifications disabled.');
                return;
            }

            this.bot = new TelegramBot(token, { polling: false });
            this.chatId = chatId;
            this.enabled = true;

            logBotEvent('telegram_initialized', { chatId });
            console.log('✅ Telegram notifications enabled');
        } catch (error) {
            logError(error, { context: 'telegram_init' });
            console.error('❌ Failed to initialize Telegram bot:', error.message);
        }
    }

    async sendKeywordAlert(keyword, message, sender, group, messageId, phoneNumber = null) {
        if (!this.enabled) {
            console.log('📱 Telegram notifications disabled');
            return false;
        }

        try {
            const alertMessage = this.formatAlertMessage(keyword, message, sender, group, messageId, phoneNumber);
            
            await this.sendWithRetry(alertMessage);
            
            logBotEvent('keyword_alert_sent', {
                keyword,
                sender,
                group,
                messageId,
                phoneNumber
            });

            return true;
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

    async sendWithRetry(message) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                await this.bot.sendMessage(this.chatId, message, {
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

    formatAlertMessage(keyword, message, sender, group, messageId, phoneNumber = null) {
        const timestamp = new Date().toLocaleString();
        const truncatedMessage = message.length > 200 ? message.substring(0, 200) + '...' : message;
        
        return `🚨 <b>Keyword Alert!</b>

🔍 <b>Keyword:</b> ${keyword}
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

            await this.sendWithRetry(message);
        } catch (error) {
            logError(error, { context: 'send_bot_status', status });
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
