/**
 * Telegram Bot Command Handler
 * Handles authorization commands and user management
 */

const TelegramBot = require('node-telegram-bot-api');
const TelegramAuthorization = require('./telegram-auth');
const { logBotEvent, logError } = require('./logger');

class TelegramCommandHandler {
    constructor(token, authorization) {
        this.bot = new TelegramBot(token, { polling: true });
        this.authorization = authorization;
        this.setupCommandHandlers();
    }

    setupCommandHandlers() {
        // Start command
        this.bot.onText(/\/start/, (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            if (this.authorization.isAuthorized(userId)) {
                this.bot.sendMessage(chatId, 
                    '✅ You are authorized to receive notifications!\n\n' +
                    'Available commands:\n' +
                    '/status - Check bot status\n' +
                    '/help - Show help\n' +
                    (this.authorization.isAdmin(userId) ? '/admin - Admin commands' : '')
                );
            } else {
                this.bot.sendMessage(chatId, 
                    '🔐 Access Request\n\n' +
                    'You are not authorized to receive notifications.\n' +
                    'Your request has been sent to administrators for approval.\n\n' +
                    'Request ID: ' + userId
                );
                this.authorization.addPendingApproval(userId);
                this.notifyAdmins(`🔔 New access request from user ${userId} (@${msg.from.username || 'unknown'})`);
            }
        });

        // Help command
        this.bot.onText(/\/help/, (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            if (!this.authorization.isAuthorized(userId)) {
                this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                return;
            }

            let helpText = '🤖 WhatsApp Keyword Bot Help\n\n';
            helpText += 'Available commands:\n';
            helpText += '/start - Start the bot\n';
            helpText += '/status - Check bot status\n';
            helpText += '/help - Show this help\n';
            
            if (this.authorization.isAdmin(userId)) {
                helpText += '\nAdmin commands:\n';
                helpText += '/admin - Admin panel\n';
                helpText += '/approve <user_id> - Approve user\n';
                helpText += '/reject <user_id> - Reject user\n';
                helpText += '/users - List authorized users\n';
                helpText += '/pending - List pending requests\n';
            }
            
            this.bot.sendMessage(chatId, helpText);
        });

        // Status command
        this.bot.onText(/\/status/, (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            if (!this.authorization.isAuthorized(userId)) {
                this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                return;
            }

            const report = this.authorization.getAuthorizationReport();
            const statusText = 
                '📊 Bot Status\n\n' +
                `✅ Authorized users: ${report.totalAuthorized}\n` +
                `👑 Admins: ${report.totalAdmins}\n` +
                `⏳ Pending requests: ${report.pendingApprovals}\n` +
                `🕐 Time: ${new Date().toLocaleString()}`;
            
            this.bot.sendMessage(chatId, statusText);
        });

        // Admin commands
        this.bot.onText(/\/admin/, (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            if (!this.authorization.isAdmin(userId)) {
                this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }

            const adminText = 
                '👑 Admin Panel\n\n' +
                'Available commands:\n' +
                '/approve <user_id> - Approve user\n' +
                '/reject <user_id> - Reject user\n' +
                '/users - List authorized users\n' +
                '/pending - List pending requests\n' +
                '/remove <user_id> - Remove user';
            
            this.bot.sendMessage(chatId, adminText);
        });

        // Approve user
        this.bot.onText(/\/approve (.+)/, (msg, match) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const targetUserId = match[1];
            
            if (!this.authorization.isAdmin(userId)) {
                this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }

            if (this.authorization.approveUser(targetUserId, userId)) {
                this.bot.sendMessage(chatId, `✅ User ${targetUserId} approved successfully.`);
                this.bot.sendMessage(targetUserId, '🎉 Your access request has been approved! You can now receive notifications.');
            } else {
                this.bot.sendMessage(chatId, `❌ Failed to approve user ${targetUserId}.`);
            }
        });

        // Reject user
        this.bot.onText(/\/reject (.+)/, (msg, match) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const targetUserId = match[1];
            
            if (!this.authorization.isAdmin(userId)) {
                this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }

            if (this.authorization.rejectUser(targetUserId, userId)) {
                this.bot.sendMessage(chatId, `❌ User ${targetUserId} rejected.`);
                this.bot.sendMessage(targetUserId, '❌ Your access request has been rejected.');
            } else {
                this.bot.sendMessage(chatId, `❌ Failed to reject user ${targetUserId}.`);
            }
        });

        // List users
        this.bot.onText(/\/users/, (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            if (!this.authorization.isAdmin(userId)) {
                this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }

            const users = this.authorization.getAuthorizedUsers();
            const usersText = '👥 Authorized Users:\n\n' + users.join('\n');
            this.bot.sendMessage(chatId, usersText);
        });

        // List pending requests
        this.bot.onText(/\/pending/, (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            if (!this.authorization.isAdmin(userId)) {
                this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }

            const pending = this.authorization.getPendingApprovals();
            const pendingText = '⏳ Pending Requests:\n\n' + (pending.length > 0 ? pending.join('\n') : 'No pending requests');
            this.bot.sendMessage(chatId, pendingText);
        });

        // Remove user
        this.bot.onText(/\/remove (.+)/, (msg, match) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const targetUserId = match[1];
            
            if (!this.authorization.isAdmin(userId)) {
                this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }

            if (this.authorization.removeAuthorizedUser(targetUserId, userId)) {
                this.bot.sendMessage(chatId, `❌ User ${targetUserId} removed successfully.`);
                this.bot.sendMessage(targetUserId, '❌ Your access has been revoked.');
            } else {
                this.bot.sendMessage(chatId, `❌ Failed to remove user ${targetUserId}.`);
            }
        });

        // Handle unknown commands
        this.bot.on('message', (msg) => {
            if (msg.text && msg.text.startsWith('/')) {
                const chatId = msg.chat.id;
                this.bot.sendMessage(chatId, '❓ Unknown command. Use /help for available commands.');
            }
        });
    }

    notifyAdmins(message) {
        const adminUsers = this.authorization.getAdminUsers();
        adminUsers.forEach(adminId => {
            this.bot.sendMessage(adminId, message).catch(err => {
                console.error(`Failed to notify admin ${adminId}:`, err.message);
            });
        });
    }

    stop() {
        this.bot.stopPolling();
    }
}

module.exports = TelegramCommandHandler;
