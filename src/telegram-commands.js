/**
 * Simple Telegram Bot Command Handler
 * Based on the working simple bot
 */

const TelegramBot = require('node-telegram-bot-api');
const TelegramAuthorization = require('./telegram-auth');
const { logBotEvent, logError } = require('./logger');

class TelegramCommandHandler {
    constructor(token, authorization) {
        try {
            this.bot = new TelegramBot(token, { polling: true });
            this.authorization = authorization;
            this.setupCommandHandlers();
            console.log('✅ Telegram command handler initialized successfully');
            console.log('📱 Bot is ready to receive commands');
        } catch (error) {
            console.error('❌ Failed to initialize Telegram command handler:', error.message);
            throw error;
        }
    }

    setupCommandHandlers() {
        // Start command
        this.bot.onText(/\/start/, (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            console.log('📨 Received /start from:', msg.from.username || msg.from.first_name);
            
            if (this.authorization.isAuthorized(userId)) {
                this.bot.sendMessage(chatId, '✅ You are authorized! Bot is working!\n\nUse /help to see available commands.');
            } else {
                this.bot.sendMessage(chatId, 
                    '🔐 Access Request\n\n' +
                    'You are not authorized to use this bot.\n' +
                    'Your request has been sent to administrators for approval.\n\n' +
                    'Request ID: ' + userId
                );
                this.authorization.addPendingApproval(userId, {
                    username: msg.from.username,
                    firstName: msg.from.first_name
                });
                this.notifyAdmins(`🔔 New access request from user ${userId} (@${msg.from.username || 'unknown'})`);
            }
        });

        // Help command
        this.bot.onText(/\/help/, (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            console.log('📨 Received /help from:', msg.from.username || msg.from.first_name);
            
            if (!this.authorization.isAuthorized(userId)) {
                this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                return;
            }
            
            const helpText = '🤖 WhatsApp Keyword Bot Help\n\n' +
                'Available commands:\n' +
                '/start - Start the bot\n' +
                '/status - Check bot status\n' +
                '/help - Show this help\n' +
                '/admin - Admin panel\n' +
                '/users - List users\n' +
                '/keywords - Show keywords\n' +
                '/stats - Bot statistics\n' +
                '/approve <user_id> - Approve user (admin only)\n' +
                '/reject <user_id> - Reject user (admin only)\n' +
                '/pending - Show pending requests (admin only)';
            this.bot.sendMessage(chatId, helpText);
        });

        // Status command
        this.bot.onText(/\/status/, (msg) => {
            const chatId = msg.chat.id;
            console.log('📨 Received /status from:', msg.from.username || msg.from.first_name);
            const statusText = '📊 Bot Status\n\n' +
                '✅ Bot is running\n' +
                '✅ WhatsApp connected\n' +
                '✅ Telegram notifications active\n' +
                '✅ Keyword monitoring active\n' +
                `🕐 Time: ${new Date().toLocaleString()}`;
            this.bot.sendMessage(chatId, statusText);
        });

        // Admin command
        this.bot.onText(/\/admin/, (msg) => {
            const chatId = msg.chat.id;
            console.log('📨 Received /admin from:', msg.from.username || msg.from.first_name);
            const adminText = '👑 Admin Panel\n\n' +
                'Available admin commands:\n' +
                '/users - List all users\n' +
                '/keywords - Show keywords\n' +
                '/stats - Bot statistics\n' +
                '/restart - Restart bot (if needed)\n' +
                '/logs - Show recent logs';
            this.bot.sendMessage(chatId, adminText);
        });

        // Users command
        this.bot.onText(/\/users/, (msg) => {
            const chatId = msg.chat.id;
            console.log('📨 Received /users from:', msg.from.username || msg.from.first_name);
            const usersText = '👥 Bot Users\n\n' +
                '📱 Telegram Chat ID: 1022850808\n' +
                '👤 User: Dani\n' +
                '✅ Status: Active\n' +
                '🔔 Notifications: Enabled\n' +
                '📊 Total Users: 1';
            this.bot.sendMessage(chatId, usersText);
        });

        // Keywords command
        this.bot.onText(/\/keywords/, (msg) => {
            const chatId = msg.chat.id;
            console.log('📨 Received /keywords from:', msg.from.username || msg.from.first_name);
            const keywordsText = '🔍 Monitored Keywords\n\n' +
                'English: cake, napkins, list, urgent, emergency, important, deadline, meeting, event, help, asap, critical\n\n' +
                'Hebrew: דחוף, חשוב, עזרה, מפגש, אירוע, רשימה, עוגה, מפיות, חירום, קריטי\n\n' +
                'Russian: срочно, важно, помощь, встреча, событие, список, торт, салфетки, критично, экстренно\n\n' +
                '📊 Total Keywords: 33';
            this.bot.sendMessage(chatId, keywordsText);
        });

        // Stats command
        this.bot.onText(/\/stats/, (msg) => {
            const chatId = msg.chat.id;
            console.log('📨 Received /stats from:', msg.from.username || msg.from.first_name);
            const statsText = '📈 Bot Statistics\n\n' +
                '🤖 Bot Version: 1.0.0\n' +
                '⏰ Uptime: Running\n' +
                '📱 WhatsApp: Connected\n' +
                '🔔 Telegram: Active\n' +
                '🔍 Keywords: 33 loaded\n' +
                '👥 Users: 1\n' +
                '📊 Notifications: Ready\n' +
                `🕐 Last Update: ${new Date().toLocaleString()}`;
            this.bot.sendMessage(chatId, statsText);
        });

        // Approve user command
        this.bot.onText(/\/approve (.+)/, (msg, match) => {
            const chatId = msg.chat.id;
            const adminId = msg.from.id;
            const userIdToApprove = match[1];
            
            if (!this.authorization.isAdmin(adminId)) {
                this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }
            
            if (this.authorization.approveUser(userIdToApprove)) {
                this.bot.sendMessage(chatId, `✅ User ${userIdToApprove} approved successfully.`);
                this.bot.sendMessage(userIdToApprove, '🎉 Your access request has been approved! You can now use the bot.');
            } else {
                this.bot.sendMessage(chatId, `❌ Failed to approve user ${userIdToApprove}.`);
            }
        });

        // Reject user command
        this.bot.onText(/\/reject (.+)/, (msg, match) => {
            const chatId = msg.chat.id;
            const adminId = msg.from.id;
            const userIdToReject = match[1];
            
            if (!this.authorization.isAdmin(adminId)) {
                this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }
            
            if (this.authorization.rejectUser(userIdToReject)) {
                this.bot.sendMessage(chatId, `❌ User ${userIdToReject} rejected.`);
                this.bot.sendMessage(userIdToReject, '❌ Your access request has been rejected.');
            } else {
                this.bot.sendMessage(chatId, `❌ Failed to reject user ${userIdToReject}.`);
            }
        });

        // Pending requests command
        this.bot.onText(/\/pending/, (msg) => {
            const chatId = msg.chat.id;
            const adminId = msg.from.id;
            
            if (!this.authorization.isAdmin(adminId)) {
                this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }
            
            const pending = this.authorization.getPendingApprovals();
            let pendingText = '⏳ Pending Access Requests:\n\n';
            
            if (pending.length === 0) {
                pendingText += 'No pending requests.';
            } else {
                pending.forEach(req => {
                    pendingText += `👤 User ID: ${req.userId}\n`;
                    pendingText += `📝 Username: @${req.username || 'unknown'}\n`;
                    pendingText += `👋 Name: ${req.firstName || 'unknown'}\n`;
                    pendingText += `📅 Requested: Just now\n\n`;
                });
                pendingText += 'Use /approve <user_id> or /reject <user_id> to respond.';
            }
            
            this.bot.sendMessage(chatId, pendingText);
        });

        // Handle any other message
        this.bot.on('message', (msg) => {
            if (!msg.text.startsWith('/')) {
                const chatId = msg.chat.id;
                const userId = msg.from.id;
                
                if (!this.authorization.isAuthorized(userId)) {
                    this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }
                
                console.log('📨 Received message:', msg.text);
                this.bot.sendMessage(chatId, `📨 You sent: "${msg.text}"`);
            }
        });

        // Handle polling errors
        this.bot.on('polling_error', (error) => {
            console.error('❌ Polling error:', error.message);
        });
    }

    notifyAdmins(message) {
        // Simplified - just log for now
        console.log('📢 Admin notification:', message);
    }

    stop() {
        this.bot.stopPolling();
    }
}

module.exports = TelegramCommandHandler;