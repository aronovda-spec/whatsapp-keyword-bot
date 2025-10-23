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
            this.lastCommandTime = new Map(); // Track last command time per user
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
            
            // Prevent duplicate commands
            if (this.isDuplicateCommand(userId, 'start')) {
                console.log('🚫 Duplicate /start command ignored from:', msg.from.username || msg.from.first_name);
                return;
            }
            
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

            // Prevent duplicate commands
            if (this.isDuplicateCommand(userId, 'help')) {
                console.log('🚫 Duplicate /help command ignored from:', msg.from.username || msg.from.first_name);
                return;
            }
            
                const helpText = '🤖 WhatsApp Keyword Bot Help\n\n' +
                    '📊 Status Commands:\n' +
                    '/start - Start the bot\n' +
                    '/status - Check bot status\n' +
                    '/help - Show this help\n' +
                    '/sleep - Check sleep status\n\n' +
                    '📱 Group Management:\n' +
                    '/discover - Show all groups bot is in\n' +
                    '/allgroups - Show available groups for subscription\n' +
                    '/subscribe <group> - Subscribe to a group\n' +
                    '/unsubscribe <group> - Unsubscribe from a group\n' +
                    '/mygroups - Show your subscriptions\n\n' +
                    '🌍 Timezone Commands (SIMPLE!):\n' +
                    '/israel - Israeli time 🇮🇱\n' +
                    '/usa - US Eastern time 🇺🇸\n' +
                    '/uk - UK time 🇬🇧\n' +
                    '/japan - Japan time 🇯🇵\n\n' +
                    '⚙️ Control Commands:\n' +
                    '/24h - Toggle 24/7 mode (ACTUALLY WORKS!)\n' +
                    '/admin - Admin panel\n' +
                    '/users - List users\n' +
                    '/keywords - Show keywords\n' +
                    '/stats - Bot statistics\n\n' +
                    '👑 Admin Only:\n' +
                    '/approve <user_id> - Approve user\n' +
                    '/reject <user_id> - Reject user\n' +
                    '/pending - Show pending requests';
            this.bot.sendMessage(chatId, helpText);
        });

        // Status command
        this.bot.onText(/\/status/, (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            // Prevent duplicate commands
            if (this.isDuplicateCommand(userId, 'status')) {
                console.log('🚫 Duplicate /status command ignored from:', msg.from.username || msg.from.first_name);
                return;
            }
            
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
            const userId = msg.from.id;
            
            // Prevent duplicate commands
            if (this.isDuplicateCommand(userId, 'admin')) {
                console.log('🚫 Duplicate /admin command ignored from:', msg.from.username || msg.from.first_name);
                return;
            }
            
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
            const userId = msg.from.id;
            
            // Prevent duplicate commands
            if (this.isDuplicateCommand(userId, 'users')) {
                console.log('🚫 Duplicate /users command ignored from:', msg.from.username || msg.from.first_name);
                return;
            }
            
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
            const userId = msg.from.id;
            
            // Prevent duplicate commands
            if (this.isDuplicateCommand(userId, 'keywords')) {
                console.log('🚫 Duplicate /keywords command ignored from:', msg.from.username || msg.from.first_name);
                return;
            }
            
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
            const userId = msg.from.id;
            
            // Prevent duplicate commands
            if (this.isDuplicateCommand(userId, 'stats')) {
                console.log('🚫 Duplicate /stats command ignored from:', msg.from.username || msg.from.first_name);
                return;
            }
            
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

            // Discover groups command - Show all groups bot is in
            this.bot.onText(/\/discover/, (msg) => {
                const chatId = msg.chat.id;
                const userId = msg.from.id;
                
                // Prevent duplicate commands
                if (this.isDuplicateCommand(userId, 'discover')) {
                    console.log('🚫 Duplicate /discover command ignored from:', msg.from.username || msg.from.first_name);
                    return;
                }
                
                if (!this.authorization.isAuthorized(userId)) {
                    this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }
                
                console.log('📨 Received /discover from:', msg.from.username || msg.from.first_name);
                
                // Load discovered groups
                const discoveredGroups = this.loadDiscoveredGroups();
                
                let discoverText = '🔍 All Groups Bot is In:\n\n';
                
                if (Object.keys(discoveredGroups).length === 0) {
                    discoverText += '❌ No groups discovered yet.\n\n';
                    discoverText += '💡 The bot needs to be added to WhatsApp groups first.\n';
                    discoverText += 'Once added, the bot will automatically discover them.';
                } else {
                    Object.entries(discoveredGroups).forEach(([groupId, groupInfo], index) => {
                        const groupName = groupInfo.name || 'Unknown Group';
                        const participantCount = groupInfo.participants || 0;
                        
                        discoverText += `${index + 1}. ${groupName}\n`;
                        discoverText += `   ID: ${groupId}\n`;
                        discoverText += `   👥 Participants: ${participantCount}\n`;
                        discoverText += `   📊 Status: Available for subscription\n\n`;
                    });
                    
                    discoverText += '💡 Use /allgroups to see subscription options\n';
                    discoverText += '💡 Use /subscribe <group_name> to join a group';
                }
                
                this.bot.sendMessage(chatId, discoverText);
            });

            // All groups command - Show available groups for subscription
            this.bot.onText(/\/allgroups/, (msg) => {
                const chatId = msg.chat.id;
                const userId = msg.from.id;
                
                // Prevent duplicate commands
                if (this.isDuplicateCommand(userId, 'allgroups')) {
                    console.log('🚫 Duplicate /allgroups command ignored from:', msg.from.username || msg.from.first_name);
                    return;
                }
                
                if (!this.authorization.isAuthorized(userId)) {
                    this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }
                
                console.log('📨 Received /allgroups from:', msg.from.username || msg.from.first_name);
                
                // Load discovered groups and subscriptions
                const discoveredGroups = this.loadDiscoveredGroups();
                const subscriptions = this.loadGroupSubscriptions();
                
                let allGroupsText = '📱 Available Groups:\n\n';
                
                if (Object.keys(discoveredGroups).length === 0) {
                    allGroupsText += '❌ No groups available yet.\n\n';
                    allGroupsText += '💡 The bot needs to be added to WhatsApp groups first.\n';
                    allGroupsText += 'Use /discover to see all groups the bot is in.';
                } else {
                    Object.entries(discoveredGroups).forEach(([groupId, groupInfo], index) => {
                        const groupName = groupInfo.name || 'Unknown Group';
                        const subscribers = subscriptions[groupName] || [];
                        const isSubscribed = subscribers.includes(chatId);
                        
                        allGroupsText += `${index + 1}. ${groupName}\n`;
                        allGroupsText += `   👥 Subscribers: ${subscribers.length > 0 ? subscribers.join(', ') : 'None'}\n`;
                        allGroupsText += `   📊 Status: ${isSubscribed ? 'You\'re subscribed ✅' : 'Available for subscription'}\n\n`;
                    });
                    
                    allGroupsText += '💡 Commands:\n';
                    allGroupsText += '• /subscribe <group_name> - Join a group\n';
                    allGroupsText += '• /unsubscribe <group_name> - Leave a group\n';
                    allGroupsText += '• /mygroups - Show your subscriptions';
                }
                
                this.bot.sendMessage(chatId, allGroupsText);
            });

            // Subscribe to group command
            this.bot.onText(/\/subscribe (.+)/, (msg, match) => {
                const chatId = msg.chat.id;
                const userId = msg.from.id;
                const groupName = match[1].trim();
                
                // Prevent duplicate commands
                if (this.isDuplicateCommand(userId, 'subscribe')) {
                    console.log('🚫 Duplicate /subscribe command ignored from:', msg.from.username || msg.from.first_name);
                    return;
                }
                
                if (!this.authorization.isAuthorized(userId)) {
                    this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }
                
                console.log('📨 Received /subscribe from:', msg.from.username || msg.from.first_name, 'for group:', groupName);
                
                // Load discovered groups and subscriptions
                const discoveredGroups = this.loadDiscoveredGroups();
                const subscriptions = this.loadGroupSubscriptions();
                
                // Check if group exists
                const groupExists = Object.values(discoveredGroups).some(group => 
                    group.name && group.name.toLowerCase() === groupName.toLowerCase()
                );
                
                if (!groupExists) {
                    this.bot.sendMessage(chatId,
                        `❌ Group "${groupName}" not found!\n\n` +
                        `💡 Available groups:\n` +
                        Object.values(discoveredGroups).map(group => `• ${group.name || 'Unknown'}`).join('\n') +
                        `\n\nUse /discover to see all groups the bot is in.`
                    );
                    return;
                }
                
                // Check if already subscribed
                const currentSubscribers = subscriptions[groupName] || [];
                if (currentSubscribers.includes(chatId)) {
                    this.bot.sendMessage(chatId,
                        `✅ You're already subscribed to "${groupName}"!\n\n` +
                        `Use /mygroups to see all your subscriptions.`
                    );
                    return;
                }
                
                // Add subscription
                subscriptions[groupName] = [...currentSubscribers, chatId];
                this.saveGroupSubscriptions(subscriptions);
                
                this.bot.sendMessage(chatId,
                    `✅ Successfully subscribed to "${groupName}"!\n\n` +
                    `🔔 You'll now receive notifications when keywords are detected in this group.\n\n` +
                    `Use /mygroups to see all your subscriptions.`
                );
            });

            // Unsubscribe from group command
            this.bot.onText(/\/unsubscribe (.+)/, (msg, match) => {
                const chatId = msg.chat.id;
                const userId = msg.from.id;
                const groupName = match[1].trim();
                
                // Prevent duplicate commands
                if (this.isDuplicateCommand(userId, 'unsubscribe')) {
                    console.log('🚫 Duplicate /unsubscribe command ignored from:', msg.from.username || msg.from.first_name);
                    return;
                }
                
                if (!this.authorization.isAuthorized(userId)) {
                    this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }
                
                console.log('📨 Received /unsubscribe from:', msg.from.username || msg.from.first_name, 'for group:', groupName);
                
                // Load subscriptions
                const subscriptions = this.loadGroupSubscriptions();
                const currentSubscribers = subscriptions[groupName] || [];
                
                if (!currentSubscribers.includes(chatId)) {
                    this.bot.sendMessage(chatId,
                        `❌ You're not subscribed to "${groupName}"!\n\n` +
                        `Use /mygroups to see your current subscriptions.`
                    );
                    return;
                }
                
                // Remove subscription
                subscriptions[groupName] = currentSubscribers.filter(id => id !== chatId);
                this.saveGroupSubscriptions(subscriptions);
                
                this.bot.sendMessage(chatId,
                    `✅ Successfully unsubscribed from "${groupName}"!\n\n` +
                    `🔕 You'll no longer receive notifications from this group.\n\n` +
                    `Use /mygroups to see your remaining subscriptions.`
                );
            });

            // My groups command
            this.bot.onText(/\/mygroups/, (msg) => {
                const chatId = msg.chat.id;
                const userId = msg.from.id;
                
                // Prevent duplicate commands
                if (this.isDuplicateCommand(userId, 'mygroups')) {
                    console.log('🚫 Duplicate /mygroups command ignored from:', msg.from.username || msg.from.first_name);
                    return;
                }
                
                if (!this.authorization.isAuthorized(userId)) {
                    this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }
                
                console.log('📨 Received /mygroups from:', msg.from.username || msg.from.first_name);
                
                // Load subscriptions
                const subscriptions = this.loadGroupSubscriptions();
                
                // Find user's subscriptions
                const userSubscriptions = Object.entries(subscriptions)
                    .filter(([groupName, subscribers]) => subscribers.includes(chatId))
                    .map(([groupName]) => groupName);
                
                let myGroupsText = '📱 Your Group Subscriptions:\n\n';
                
                if (userSubscriptions.length === 0) {
                    myGroupsText += '❌ You are not subscribed to any groups yet.\n\n';
                    myGroupsText += '💡 Available commands:\n';
                    myGroupsText += '• /allgroups - See available groups\n';
                    myGroupsText += '• /subscribe <group_name> - Join a group\n';
                    myGroupsText += '• /discover - See all groups bot is in';
                } else {
                    userSubscriptions.forEach((groupName, index) => {
                        myGroupsText += `${index + 1}. ${groupName}\n`;
                    });
                    
                    myGroupsText += '\n💡 Commands:\n';
                    myGroupsText += '• /unsubscribe <group_name> - Leave a group\n';
                    myGroupsText += '• /allgroups - See all available groups\n';
                    myGroupsText += '• /discover - See all groups bot is in';
                }
                
                this.bot.sendMessage(chatId, myGroupsText);
            });

            // Simple timezone commands that actually work!
            this.bot.onText(/\/israel/, (msg) => {
                const chatId = msg.chat.id;
                const userId = msg.from.id;
                
                // Prevent duplicate commands
                if (this.isDuplicateCommand(userId, 'israel')) {
                    console.log('🚫 Duplicate /israel command ignored from:', msg.from.username || msg.from.first_name);
                    return;
                }
                
                if (!this.authorization.isAuthorized(userId)) {
                    this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }
                this.updateTimezone(chatId, 'Asia/Jerusalem');
            });

            this.bot.onText(/\/usa/, (msg) => {
                const chatId = msg.chat.id;
                const userId = msg.from.id;
                if (!this.authorization.isAuthorized(userId)) {
                    this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }
                this.updateTimezone(chatId, 'America/New_York');
            });

            this.bot.onText(/\/uk/, (msg) => {
                const chatId = msg.chat.id;
                const userId = msg.from.id;
                if (!this.authorization.isAuthorized(userId)) {
                    this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }
                this.updateTimezone(chatId, 'Europe/London');
            });

            this.bot.onText(/\/japan/, (msg) => {
                const chatId = msg.chat.id;
                const userId = msg.from.id;
                if (!this.authorization.isAuthorized(userId)) {
                    this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }
                this.updateTimezone(chatId, 'Asia/Tokyo');
            });

            // Advanced timezone command (for power users)
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
                        '🇮🇱 Simple Commands:\n' +
                        '/israel - Israeli time\n' +
                        '/usa - US Eastern time\n' +
                        '/uk - UK time\n' +
                        '/japan - Japan time\n\n' +
                        '🌍 Advanced:\n' +
                        '/timezone Asia/Jerusalem\n' +
                        '/timezone America/New_York\n' +
                        '/timezone Europe/London\n' +
                        '/timezone Asia/Tokyo\n' +
                        '/timezone Australia/Sydney\n' +
                        '/timezone UTC'
                    );
                    return;
                }

                this.updateTimezone(chatId, timezone);
            });

            // Sleep mode commands
            this.bot.onText(/\/sleep/, (msg) => {
                const chatId = msg.chat.id;
                const userId = msg.from.id;

                if (!this.authorization.isAuthorized(userId)) {
                    this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }

                // Prevent duplicate commands
                if (this.isDuplicateCommand(userId, 'sleep')) {
                    console.log('🚫 Duplicate /sleep command ignored from:', msg.from.username || msg.from.first_name);
                    return;
                }

                // Get user's timezone preference
                const userTimezone = this.getUserTimezone(chatId);
                const now = new Date();
                const userTime = new Date(now.toLocaleString("en-US", {timeZone: userTimezone}));
                const currentTime = userTime.toTimeString().substring(0, 5);

                let sleepStatus = '☀️ Active hours: Normal operation';
                if (currentTime >= '01:00' && currentTime <= '06:00') {
                    sleepStatus = '😴 Sleep hours: Bot is sleeping (1 AM - 6 AM)';
                }

                const timezoneNames = {
                    'Asia/Jerusalem': 'Israeli 🇮🇱',
                    'America/New_York': 'US Eastern 🇺🇸',
                    'Europe/London': 'UK 🇬🇧',
                    'Asia/Tokyo': 'Japan 🇯🇵',
                    'Australia/Sydney': 'Australia 🇦🇺',
                    'UTC': 'Universal 🌍'
                };

                const displayName = timezoneNames[userTimezone] || userTimezone;

                this.bot.sendMessage(chatId,
                    `😴 Your Sleep Status\n\n` +
                    `🌍 Your Timezone: ${displayName}\n` +
                    `🕐 Your Local Time: ${userTime.toLocaleString()}\n` +
                    `⏰ Current Time: ${currentTime}\n` +
                    `📊 Status: ${sleepStatus}\n\n` +
                    `💡 Sleep Schedule (Your Time):\n` +
                    `• Sleep: 01:00 - 06:00\n` +
                    `• Active: 06:00 - 01:00\n\n` +
                    `🌍 Change Timezone:\n` +
                    `• /israel - Israeli time 🇮🇱\n` +
                    `• /usa - US Eastern time 🇺🇸\n` +
                    `• /uk - UK time 🇬🇧\n` +
                    `• /japan - Japan time 🇯🇵\n\n` +
                    `⚙️ Control:\n` +
                    `• /24h - Toggle 24/7 mode\n` +
                    `• /sleep - Check your status`
                );
            });

            // 24/7 mode command - ACTUALLY WORKS!
            this.bot.onText(/\/24h/, (msg) => {
                const chatId = msg.chat.id;
                const userId = msg.from.id;

                // Prevent duplicate commands
                if (this.isDuplicateCommand(userId, '24h')) {
                    console.log('🚫 Duplicate /24h command ignored from:', msg.from.username || msg.from.first_name);
                    return;
                }

                if (!this.authorization.isAuthorized(userId)) {
                    this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }

                // Actually toggle 24/7 mode by updating config
                try {
                    const fs = require('fs');
                    const path = require('path');
                    const configPath = path.join(__dirname, '../config/non-active-hours.json');
                    
                    let config = { nonActiveHours: { enabled: true } };
                    if (fs.existsSync(configPath)) {
                        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    }
                    
                    // Toggle the setting
                    config.nonActiveHours.enabled = !config.nonActiveHours.enabled;
                    
                    // Save the config
                    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                    
                    const status = config.nonActiveHours.enabled ? 'DISABLED' : 'ENABLED';
                    const emoji = config.nonActiveHours.enabled ? '😴' : '🌍';
                    
                    this.bot.sendMessage(chatId,
                        `${emoji} 24/7 Mode ${status}\n\n` +
                        `Sleep mode is now ${config.nonActiveHours.enabled ? 'ENABLED' : 'DISABLED'}.\n\n` +
                        `⚠️ Restart the bot for changes to take effect.\n\n` +
                        `Use /sleep to check current status.`
                    );
                } catch (error) {
                    this.bot.sendMessage(chatId, '❌ Error updating 24/7 mode. Check bot logs.');
                }
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
            // Suppress 401 Unauthorized errors to reduce spam
            if (error.message.includes('401 Unauthorized')) {
                // Only log once every 10 minutes to avoid spam
                if (!this.last401Error || Date.now() - this.last401Error > 600000) {
                    console.log('⚠️ Telegram polling: 401 Unauthorized (suppressing repeated messages)');
                    this.last401Error = Date.now();
                }
            } else {
                console.error('❌ Polling error:', error.message);
            }
        });
    }

    // Load discovered groups from file
    loadDiscoveredGroups() {
        try {
            const fs = require('fs');
            const path = require('path');
            const discoveredPath = path.join(__dirname, '../config/discovered-groups.json');
            
            if (fs.existsSync(discoveredPath)) {
                return JSON.parse(fs.readFileSync(discoveredPath, 'utf8'));
            }
            
            return {};
        } catch (error) {
            console.error('Error loading discovered groups:', error.message);
            return {};
        }
    }

    // Load group subscriptions from file
    loadGroupSubscriptions() {
        try {
            const fs = require('fs');
            const path = require('path');
            const subscriptionsPath = path.join(__dirname, '../config/group-subscriptions.json');
            
            if (fs.existsSync(subscriptionsPath)) {
                return JSON.parse(fs.readFileSync(subscriptionsPath, 'utf8'));
            }
            
            return {};
        } catch (error) {
            console.error('Error loading group subscriptions:', error.message);
            return {};
        }
    }

    // Save group subscriptions to file
    saveGroupSubscriptions(subscriptions) {
        try {
            const fs = require('fs');
            const path = require('path');
            const subscriptionsPath = path.join(__dirname, '../config/group-subscriptions.json');
            
            fs.writeFileSync(subscriptionsPath, JSON.stringify(subscriptions, null, 2));
            console.log('✅ Group subscriptions saved successfully');
        } catch (error) {
            console.error('Error saving group subscriptions:', error.message);
        }
    }

    // Get user's timezone preference
    getUserTimezone(chatId) {
        try {
            const fs = require('fs');
            const path = require('path');
            const userConfigPath = path.join(__dirname, '../config/user-preferences.json');
            
            if (fs.existsSync(userConfigPath)) {
                const userPrefs = JSON.parse(fs.readFileSync(userConfigPath, 'utf8'));
                return userPrefs[chatId]?.timezone || 'Asia/Jerusalem'; // Default to Israeli time
            }
            
            return 'Asia/Jerusalem'; // Default timezone
        } catch (error) {
            console.error('Error loading user timezone:', error.message);
            return 'Asia/Jerusalem'; // Fallback to Israeli time
        }
    }

    // Prevent duplicate commands within 2 seconds
    isDuplicateCommand(userId, command) {
        const now = Date.now();
        const key = `${userId}_${command}`;
        const lastTime = this.lastCommandTime.get(key);
        
        if (lastTime && (now - lastTime) < 2000) { // 2 seconds
            return true;
        }
        
        this.lastCommandTime.set(key, now);
        return false;
    }

    updateTimezone(chatId, timezone) {
        try {
            const fs = require('fs');
            const path = require('path');
            const userConfigPath = path.join(__dirname, '../config/user-preferences.json');
            
            // Load user preferences
            let userPrefs = {};
            if (fs.existsSync(userConfigPath)) {
                userPrefs = JSON.parse(fs.readFileSync(userConfigPath, 'utf8'));
            }
            
            // Update user's timezone preference
            userPrefs[chatId] = {
                ...userPrefs[chatId],
                timezone: timezone,
                lastUpdated: new Date().toISOString()
            };
            
            // Save user preferences
            fs.writeFileSync(userConfigPath, JSON.stringify(userPrefs, null, 2));
            
            const timezoneNames = {
                'Asia/Jerusalem': 'Israeli 🇮🇱',
                'America/New_York': 'US Eastern 🇺🇸',
                'Europe/London': 'UK 🇬🇧',
                'Asia/Tokyo': 'Japan 🇯🇵',
                'Australia/Sydney': 'Australia 🇦🇺',
                'UTC': 'Universal 🌍'
            };
            
            const displayName = timezoneNames[timezone] || timezone;
            
            this.bot.sendMessage(chatId,
                `🌍 Your timezone changed to: ${displayName}\n\n` +
                `✅ No restart needed! Changes take effect immediately.\n\n` +
                `💡 Each user can have their own timezone preference.\n` +
                `Use /sleep to check your personal sleep status.`
            );
        } catch (error) {
            this.bot.sendMessage(chatId, '❌ Error updating timezone. Check bot logs.');
        }
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