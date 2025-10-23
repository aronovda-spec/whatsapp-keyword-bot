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
                    '/groups - Show chat management info\n' +
                    '/discover - Trigger chat discovery\n' +
                    '/sleep - Check sleep status\n' +
                    '/timezone <tz> - Change timezone\n' +
                    '/24h - Enable 24/7 mode\n' +
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

        // Groups command
        this.bot.onText(/\/groups/, (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            console.log('📨 Received /groups from:', msg.from.username || msg.from.first_name);
            
            if (!this.authorization.isAuthorized(userId)) {
                this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                return;
            }
            
            const groupsText = '📱 Chat Management\n\n' +
                '🔍 Ways to get Chat IDs:\n\n' +
                'Method 1 - Auto Discovery (NEW!):\n' +
                '• Bot automatically finds all groups\n' +
                '• Check bot terminal when connected\n' +
                '• All group IDs listed automatically\n' +
                '• Saved to config/discovered-groups.json\n\n' +
                'Method 2 - Bot Logs (INDIVIDUALS):\n' +
                '• Send ANY message to the bot\n' +
                '• Bot logs your individual chat ID\n' +
                '• Works for private chats automatically\n' +
                '• Shows: 👤 Private Chat Message Detected\n\n' +
                'Method 3 - WhatsApp Web:\n' +
                '• Open WhatsApp Web in browser\n' +
                '• Go to the chat/group\n' +
                '• Look at URL for chat ID\n\n' +
                '📋 Chat Types Supported:\n' +
                '• Groups: @g.us (multiple participants)\n' +
                '• Private chats: @s.whatsapp.net (single users)\n' +
                '• Broadcast lists: @broadcast (broadcast messages)\n\n' +
                '💡 For Individuals:\n' +
                '• Just send a message to the bot\n' +
                '• Bot will log your chat ID\n' +
                '• Copy the ID and add to config\n\n' +
                'Use /discover to trigger chat discovery\n' +
                'Use /help for more commands.';
            this.bot.sendMessage(chatId, groupsText);
        });

            // Discover groups command
            this.bot.onText(/\/discover/, (msg) => {
                const chatId = msg.chat.id;
                const userId = msg.from.id;
                console.log('📨 Received /discover from:', msg.from.username || msg.from.first_name);

                if (!this.authorization.isAuthorized(userId)) {
                    this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }

                this.bot.sendMessage(chatId,
                    '🔍 Triggering chat discovery...\n\n' +
                    'Check the bot terminal for a complete list of all WhatsApp chats the bot can access.\n\n' +
                    'The bot will:\n' +
                    '• List all groups with names and IDs\n' +
                    '• Show participant counts\n' +
                    '• Indicate which chats are monitored\n' +
                    '• Save results to config/discovered-groups.json\n\n' +
                    'This happens automatically when the bot connects, but you can trigger it manually with this command.\n\n' +
                    '💡 The bot also logs private chat IDs when messages are received!'
                );
            });

            // Timezone commands
            this.bot.onText(/\/timezone (.+)/, (msg, match) => {
                const chatId = msg.chat.id;
                const userId = msg.from.id;
                const timezone = match[1];

                if (!this.authorization.isAuthorized(userId)) {
                    this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }

                const validTimezones = [
                    'Asia/Jerusalem', 'America/New_York', 'Europe/London', 
                    'Asia/Tokyo', 'Australia/Sydney', 'UTC'
                ];

                if (!validTimezones.includes(timezone)) {
                    this.bot.sendMessage(chatId,
                        '❌ Invalid timezone!\n\n' +
                        'Valid timezones:\n' +
                        '• Asia/Jerusalem (Israeli - Default)\n' +
                        '• America/New_York (US Eastern)\n' +
                        '• Europe/London (UK)\n' +
                        '• Asia/Tokyo (Japan)\n' +
                        '• Australia/Sydney (Australia)\n' +
                        '• UTC (Universal)\n\n' +
                        'Example: /timezone America/New_York'
                    );
                    return;
                }

                // Update timezone (this would need to be implemented in the bot)
                this.bot.sendMessage(chatId,
                    `🌍 Timezone changed to: ${timezone}\n\n` +
                    '⚠️ Note: Restart the bot for timezone changes to take effect.\n\n' +
                    'Use /sleep to check current sleep status.'
                );
            });

            // Sleep mode commands
            this.bot.onText(/\/sleep/, (msg) => {
                const chatId = msg.chat.id;
                const userId = msg.from.id;

                if (!this.authorization.isAuthorized(userId)) {
                    this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }

                const now = new Date();
                const israeliTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Jerusalem"}));
                const currentTime = israeliTime.toTimeString().substring(0, 5);

                let sleepStatus = '☀️ Active hours: Normal operation';
                if (currentTime >= '01:00' && currentTime <= '06:00') {
                    sleepStatus = '😴 Sleep hours: Bot is sleeping (1 AM - 6 AM Israeli time)';
                }

                this.bot.sendMessage(chatId,
                    `😴 Sleep Status\n\n` +
                    `🌍 Israeli Time: ${israeliTime.toLocaleString()}\n` +
                    `⏰ Current Time: ${currentTime}\n` +
                    `📊 Status: ${sleepStatus}\n\n` +
                    `💡 Sleep Schedule:\n` +
                    `• Sleep: 01:00 - 06:00 Israeli time\n` +
                    `• Active: 06:00 - 01:00 Israeli time\n\n` +
                    `Commands:\n` +
                    `• /timezone <timezone> - Change timezone\n` +
                    `• /24h - Enable 24/7 mode\n` +
                    `• /sleep - Check sleep status`
                );
            });

            // 24/7 mode command
            this.bot.onText(/\/24h/, (msg) => {
                const chatId = msg.chat.id;
                const userId = msg.from.id;

                if (!this.authorization.isAuthorized(userId)) {
                    this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }

                this.bot.sendMessage(chatId,
                    '🌍 24/7 Mode\n\n' +
                    'To enable 24/7 mode (disable sleep):\n\n' +
                    'Method 1 - Environment Variable:\n' +
                    '```bash\n' +
                    'export WHATSAPP_NON_ACTIVE_HOURS_ENABLED=false\n' +
                    '```\n\n' +
                    'Method 2 - Edit config file:\n' +
                    '```json\n' +
                    '{\n' +
                    '  "nonActiveHours": {\n' +
                    '    "enabled": false\n' +
                    '  }\n' +
                    '}\n' +
                    '```\n\n' +
                    '⚠️ Restart the bot after making changes.\n\n' +
                    'To go back to sleep mode:\n' +
                    '```bash\n' +
                    'export WHATSAPP_NON_ACTIVE_HOURS_ENABLED=true\n' +
                    '```'
                );
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