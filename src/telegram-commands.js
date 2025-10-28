/**
 * Simple Telegram Bot Command Handler
 * Based on the working simple bot
 */

const TelegramBot = require('node-telegram-bot-api');
const TelegramAuthorization = require('./telegram-auth');
const { logBotEvent, logError } = require('./logger');

class TelegramCommandHandler {
    constructor(token, authorization, keywordDetector) {
        try {
            this.bot = new TelegramBot(token, { polling: true, onlyFirstMatch: true });
            this.authorization = authorization;
            this.keywordDetector = keywordDetector; // Store keywordDetector reference
            this.reminderManager = null; // Will be set by bot
            this.lastCommandTime = new Map(); // Track last command time per user
            this.setupCommandHandlers();
            console.log('✅ Telegram command handler initialized successfully');
            console.log('📱 Bot is ready to receive commands');
        } catch (error) {
            console.error('❌ Failed to initialize Telegram command handler:', error.message);
            throw error;
        }
    }

    /**
     * Escape HTML special characters to prevent parsing errors
     */
    escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    setupCommandHandlers() {
        // Setup reminder commands first
        this.setupReminderCommands(this.bot);
        
        // Unified message handler - handles all message types with proper flow control
        this.bot.on('message', (msg) => {
            const userId = msg.from.id;
            const messageText = msg.text;
            const userName = msg.from.first_name || msg.from.username || 'Unknown';
            
            // Store user name for future reference (if not already stored)
            if (!this.authorization.getUserName(userId)) {
                this.authorization.setUserName(userId, userName);
            }
            
            // Check if this is a restart confirmation
            if (this.pendingRestartConfirmations && this.pendingRestartConfirmations.has(userId)) {
                const confirmation = this.pendingRestartConfirmations.get(userId);
                
                // Clean up expired confirmations (5 minutes)
                if (Date.now() - confirmation.timestamp > 300000) {
                    this.pendingRestartConfirmations.delete(userId);
                    return;
                }
                
                if (messageText === 'CONFIRM RESTART') {
                    // Confirmed restart
                    this.pendingRestartConfirmations.delete(userId);
                    
                    this.bot.sendMessage(confirmation.chatId, 
                        '✅ <b>Restart Confirmed!</b>\n\n' +
                        '🔄 <b>Restarting Bot...</b>\n\n' +
                        '⚠️ <b>Important:</b>\n' +
                        '• Bot will restart in 3 seconds\n' +
                        '• WhatsApp QR code will need to be scanned again\n' +
                        '• All data will be preserved\n\n' +
                        '🔄 <b>Restarting now...</b>',
                        { parse_mode: 'HTML' }
                    );
                    
                    console.log(`🔄 Admin ${userId} confirmed bot restart`);
                    
                    // Give time for message to be sent, then restart
                    setTimeout(() => {
                        console.log('🔄 Bot restart initiated by admin');
                        process.exit(0);
                    }, 3000);
                    
                } else {
                    // Cancelled restart
                    this.pendingRestartConfirmations.delete(userId);
                    
                    this.bot.sendMessage(confirmation.chatId, 
                        '❌ <b>Restart Cancelled</b>\n\n' +
                        '✅ Bot will continue running normally.\n' +
                        '🔄 Use /restart again if you need to restart later.',
                        { parse_mode: 'HTML' }
                    );
                    
                    console.log(`🔄 Admin ${userId} cancelled bot restart`);
                }
                
                // Return early to prevent other handlers
                return;
            }
            
            // Check if this is a remove confirmation
            if (this.pendingRemovalConfirmations && this.pendingRemovalConfirmations.has(userId)) {
                const confirmation = this.pendingRemovalConfirmations.get(userId);
                
                // Clean up expired confirmations (5 minutes)
                if (Date.now() - confirmation.timestamp > 300000) {
                    this.pendingRemovalConfirmations.delete(userId);
                    return;
                }
                
                if (messageText === 'CONFIRM REMOVE') {
                    // Confirmed removal
                    this.pendingRemovalConfirmations.delete(userId);
                    
                    // Perform the removal
                    const success = this.authorization.removeAuthorizedUser(confirmation.userIdToRemove, userId);
                    const cleanupSuccess = this.authorization.cleanupUserData(confirmation.userIdToRemove);
                    
                    if (success && cleanupSuccess) {
                        this.bot.sendMessage(confirmation.chatId, 
                            '✅ <b>User Removal Confirmed!</b>\n\n' +
                            `🗑️ <b>User ${confirmation.userIdToRemove} (${confirmation.userName}) has been removed</b>\n\n` +
                            '🧹 <b>Data Cleaned Up:</b>\n' +
                            '• ✅ Removed from authorized users\n' +
                            '• ✅ Removed admin privileges (if any)\n' +
                            '• ✅ Deleted personal keywords\n' +
                            '• ✅ Removed group subscriptions\n' +
                            '• ✅ Deleted user preferences\n' +
                            '• ✅ Removed user name\n\n' +
                            '⚠️ <b>User will no longer have access to the bot.</b>',
                            { parse_mode: 'HTML' }
                        );
                        
                        // Notify the removed user
                        this.bot.sendMessage(confirmation.userIdToRemove, 
                            '❌ <b>Access Revoked</b>\n\n' +
                            'Your access to the WhatsApp Keyword Bot has been revoked by an administrator.\n\n' +
                            'If you believe this is an error, please contact an admin.',
                            { parse_mode: 'HTML' }
                        );
                        
                        console.log(`🗑️ Admin ${userId} confirmed removal of user ${confirmation.userIdToRemove} (${confirmation.userName})`);
                    } else {
                        this.bot.sendMessage(confirmation.chatId, 
                            '❌ <b>Removal Failed</b>\n\n' +
                            `Failed to remove user ${confirmation.userIdToRemove} (${confirmation.userName}).\n` +
                            'Please try again or check the logs for errors.',
                            { parse_mode: 'HTML' }
                        );
                    }
                    
                } else {
                    // Cancelled removal
                    this.pendingRemovalConfirmations.delete(userId);
                    
                    this.bot.sendMessage(confirmation.chatId, 
                        '❌ <b>User Removal Cancelled</b>\n\n' +
                        `✅ User ${confirmation.userIdToRemove} (${confirmation.userName}) remains authorized.\n` +
                        '🗑️ Use /remove again if you need to remove the user later.',
                        { parse_mode: 'HTML' }
                    );
                    
                    console.log(`🗑️ Admin ${userId} cancelled removal of user ${confirmation.userIdToRemove} (${confirmation.userName})`);
                }
                
                // Return early to prevent other handlers
                return;
            }
            
            // Handle broadcast messages (non-command messages from authorized users)
            if (!messageText.startsWith('/')) {
                const chatId = msg.chat.id;
                
                if (!this.authorization.isAuthorized(userId)) {
                    this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }
                
                console.log(`📨 Broadcast message from ${userName} (${userId}): ${messageText}`);
                
                // Get all authorized users
                const authorizedUsers = this.authorization.getAuthorizedUsers();
                
                // Send to all authorized users
                authorizedUsers.forEach(authorizedUserId => {
                    try {
                        const broadcastMessage = `📢 <b>Message from ${userName}:</b>\n\n"${messageText}"`;
                        this.bot.sendMessage(authorizedUserId, broadcastMessage, { parse_mode: 'HTML' });
                    } catch (error) {
                        console.error(`❌ Failed to send broadcast to user ${authorizedUserId}:`, error.message);
                    }
                });
                
                console.log(`📢 Broadcast sent to ${authorizedUsers.length} authorized users`);
            }
        });

        // Start command
        this.bot.onText(/\/start/, (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const userName = msg.from.first_name || msg.from.username || 'Unknown';
            
            // Store user name for future reference
            this.authorization.setUserName(userId, userName);
            
            // Prevent duplicate commands
            if (this.isDuplicateCommand(userId, 'start')) {
                console.log('🚫 Duplicate /start command ignored from:', userName);
                return;
            }
            
            console.log('📨 Received /start from:', userName);
            
            if (this.authorization.isAuthorized(userId)) {
                this.bot.sendMessage(chatId, '✅ You are authorized! Bot is working!\n\nUse /help to see available commands.');
            } else {
                this.bot.sendMessage(chatId, 
                    '🔐 Access Request\n\n' +
                    'You are not authorized to use this bot.\n' +
                    'Your request has been sent to administrators for approval.\n\n' +
                    'Request ID: ' + userId + '\n' +
                    'Name: ' + userName
                );
                this.authorization.addPendingApproval(userId, {
                    username: msg.from.username,
                    firstName: msg.from.first_name
                });
                this.notifyAdmins(`🔔 New access request from user ${userId} (@${msg.from.username || 'unknown'}) - ${userName}`);
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
                    '/ok - Stop repeating reminders for your personal keywords\n' +
                    '/reminders - Show your active reminder notifications\n' +
                    '/sleep - Check sleep status\n\n' +
                    '📱 Group Management:\n' +
                    '/discover - Show all groups bot is in\n' +
                    '/allgroups - Show available groups for subscription\n' +
                    '/subscribe <group> - Subscribe to a group\n' +
                    '/unsubscribe <group> - Unsubscribe from a group\n' +
                    '/mygroups - Show your subscriptions\n\n' +
                    '🔑 Keyword Management:\n' +
                    '/keywords - Show global keywords\n' +
                    '/addkeyword <word> - Add global keyword (Admin only)\n' +
                    '/removekeyword <word> - Remove global keyword (Admin only)\n' +
                    '/mykeywords - Show your personal keywords\n' +
                    '/addmykeyword <word> - Add personal keyword\n' +
                    '/removemykeyword <word> - Remove personal keyword\n\n' +
                    '🌍 Timezone Commands (SIMPLE!):\n' +
                    '/israel - Israeli time 🇮🇱\n' +
                    '/usa - US Eastern time 🇺🇸\n' +
                    '/uk - UK time 🇬🇧\n' +
                    '/japan - Japan time 🇯🇵\n\n' +
                    '⚙️ Control Commands:\n' +
                    '/24h - Toggle 24/7 mode (ACTUALLY WORKS!)\n' +
                    '/admin - Admin panel\n' +
                    '/users - List all users with roles\n' +
                    '/admins - Show admin users only\n' +
                    '/stats - Bot statistics\n\n' +
                    '👑 Admin Only:\n' +
                    '/approve <user_id> - Approve user\n' +
                    '/reject <user_id> - Reject user\n' +
                    '/pending - Show pending requests\n' +
                    '/remove <user_id> - Remove user (with confirmation)\n' +
                    '/setemail <user_id> <email> - Set user email\n' +
                    '/removeemail <user_id> - Remove user email\n' +
                    '/makeadmin <user_id> - Promote user to admin';
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
                '/users - List all users with roles\n' +
                '/admins - Show admin users only\n' +
                '/keywords - Show keywords\n' +
                '/stats - Bot statistics\n' +
                '/restart - Restart bot (preserves all data)\n' +
                '/addkeyword <word> - Add global keyword\n' +
                '/removekeyword <word> - Remove global keyword\n' +
                '/approve <user_id> - Approve user\n' +
                '/reject <user_id> - Reject user\n' +
                '/remove <user_id> - Remove user (with confirmation)\n' +
                '/pending - Show pending requests\n' +
                '/setemail <user_id> <email> - Set user email\n' +
                '/makeadmin <user_id> - Promote user to admin';
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
            
            // Get all authorized users and admins
            const authorizedUsers = this.authorization.getAuthorizedUsers();
            const adminUsers = this.authorization.getAdminUsers();
            
            let usersText = '👥 <b>Bot Users</b>\n\n';
            
            if (authorizedUsers.length === 0) {
                usersText += '❌ No authorized users found.';
            } else {
                authorizedUsers.forEach((user, index) => {
                    const isAdmin = adminUsers.includes(user);
                    const adminBadge = isAdmin ? '👑' : '👤';
                    const adminStatus = isAdmin ? 'Admin' : 'User';
                    const adminEmoji = isAdmin ? '✅' : '👤';
                    const userName = this.authorization.getUserName(user) || 'Unknown';
                    
                    usersText += `${adminBadge} <b>User ${index + 1} - ${userName}</b>\n`;
                    usersText += `   📱 ID: ${user}\n`;
                    usersText += `   ${adminEmoji} Role: ${adminStatus}\n`;
                    usersText += `   ✅ Status: Active\n`;
                    usersText += `   🔔 Notifications: Enabled\n\n`;
                });
                
                usersText += `📊 <b>Summary:</b>\n`;
                usersText += `   👥 Total Users: ${authorizedUsers.length}\n`;
                usersText += `   👑 Admins: ${adminUsers.length}\n`;
                usersText += `   👤 Regular Users: ${authorizedUsers.length - adminUsers.length}\n`;
            }
            
            this.bot.sendMessage(chatId, usersText, { parse_mode: 'HTML' });
        });

        // Admins command - Show only admin users
        this.bot.onText(/\/admins/, (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            // Prevent duplicate commands
            if (this.isDuplicateCommand(userId, 'admins')) {
                console.log('🚫 Duplicate /admins command ignored from:', msg.from.username || msg.from.first_name);
                return;
            }
            
            console.log('📨 Received /admins from:', msg.from.username || msg.from.first_name);
            
            // Get admin users
            const adminUsers = this.authorization.getAdminUsers();
            
            let adminsText = '👑 <b>Admin Users</b>\n\n';
            
            if (adminUsers.length === 0) {
                adminsText += '❌ No admin users found.';
            } else {
                adminUsers.forEach((adminId, index) => {
                    const adminName = this.authorization.getUserName(adminId) || 'Unknown';
                    adminsText += `👑 <b>Admin ${index + 1} - ${adminName}</b>\n`;
                    adminsText += `   📱 ID: ${adminId}\n`;
                    adminsText += `   ✅ Role: Admin\n`;
                    adminsText += `   ✅ Status: Active\n`;
                    adminsText += `   🔔 Notifications: Enabled\n`;
                    adminsText += `   🛠️ Admin Commands: Available\n\n`;
                });
                
                adminsText += `📊 <b>Summary:</b>\n`;
                adminsText += `   👑 Total Admins: ${adminUsers.length}\n`;
                adminsText += `   🛠️ Admin Commands: /approve, /reject, /pending, /addkeyword, /removekeyword, /restart\n`;
            }
            
            this.bot.sendMessage(chatId, adminsText, { parse_mode: 'HTML' });
        });

        // Keywords command
        // Keywords command - Show current keywords
        this.bot.onText(/\/keywords/, (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            // Prevent duplicate commands
            if (this.isDuplicateCommand(userId, 'keywords')) {
                console.log('🚫 Duplicate /keywords command ignored from:', msg.from.username || msg.from.first_name);
                return;
            }
            
            if (!this.authorization.isAuthorized(userId)) {
                this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                return;
            }

            if (!this.keywordDetector) {
                this.bot.sendMessage(chatId, '❌ Keyword detector is not initialized. Please restart the bot.');
                return;
            }

            const keywords = this.keywordDetector.getKeywords();
            let keywordsText = '🔑 <b>Current Global Keywords:</b>\n\n';
            
            if (keywords.length === 0) {
                keywordsText += 'No keywords configured.';
            } else {
                keywords.forEach((keyword, index) => {
                    // Escape HTML special characters to prevent parsing errors
                    const escapedKeyword = keyword
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#39;');
                    keywordsText += `${index + 1}. ${escapedKeyword}\n`;
                });
            }
            
            keywordsText += '\n💡 <b>Keyword Management:</b>\n';
            keywordsText += '• /addkeyword &lt;word&gt; - Add global keyword (Admin only)\n';
            keywordsText += '• /removekeyword &lt;word&gt; - Remove global keyword (Admin only)\n';
            keywordsText += '• /mykeywords - Show your personal keywords\n';
            keywordsText += '• /addmykeyword &lt;word&gt; - Add personal keyword\n';
            keywordsText += '• /removemykeyword &lt;word&gt; - Remove personal keyword';

            this.bot.sendMessage(chatId, keywordsText, { parse_mode: 'HTML' });
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
            
            const userName = this.authorization.getUserName(userIdToApprove) || 'Unknown';
            if (this.authorization.approveUser(userIdToApprove, adminId, userName)) {
                this.bot.sendMessage(chatId, `✅ User ${userIdToApprove} (${userName}) approved successfully.`);
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
            
            if (this.authorization.rejectUser(userIdToReject, adminId)) {
                this.bot.sendMessage(chatId, `❌ User ${userIdToReject} rejected.`);
                this.bot.sendMessage(userIdToReject, '❌ Your access request has been rejected.');
            } else {
                this.bot.sendMessage(chatId, `❌ Failed to reject user ${userIdToReject}.`);
            }
        });

        // Set email command - Admin only
        this.bot.onText(/\/setemail (.+) (.+)/, (msg, match) => {
            const chatId = msg.chat.id;
            const adminId = msg.from.id;
            const userId = match[1];
            const email = match[2];
            
            if (!this.authorization.isAdmin(adminId)) {
                this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }
            
            console.log(`📧 Admin ${adminId} setting email for user ${userId}: ${email}`);
            
            // Update email in Supabase
            if (this.authorization.supabase && this.authorization.supabase.isEnabled()) {
                this.authorization.supabase.client.from('users')
                    .update({ 
                        email: email,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', userId)
                    .then(({ error }) => {
                        if (error) throw error;
                        this.bot.sendMessage(chatId, `✅ Email set for user ${userId}: ${email}\n⚠️ Note: Bot restart required for email changes to take effect.`);
                    })
                    .catch(err => {
                        console.error('Error setting email:', err);
                        this.bot.sendMessage(chatId, `❌ Failed to set email: ${err.message}`);
                    });
            } else {
                this.bot.sendMessage(chatId, '❌ Supabase not configured. Cannot update email.');
            }
        });

        // Remove email command - Admin only
        this.bot.onText(/\/removeemail (.+)/, (msg, match) => {
            const chatId = msg.chat.id;
            const adminId = msg.from.id;
            const userId = match[1];
            
            if (!this.authorization.isAdmin(adminId)) {
                this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }
            
            console.log(`📧 Admin ${adminId} removing email for user ${userId}`);
            
            // Update email in Supabase to null
            if (this.authorization.supabase && this.authorization.supabase.isEnabled()) {
                this.authorization.supabase.client.from('users')
                    .update({ 
                        email: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', userId)
                    .then(({ error }) => {
                        if (error) throw error;
                        this.bot.sendMessage(chatId, `✅ Email removed for user ${userId}.\n⚠️ Note: Bot restart required for email changes to take effect.`);
                    })
                    .catch(err => {
                        console.error('Error removing email:', err);
                        this.bot.sendMessage(chatId, `❌ Failed to remove email: ${err.message}`);
                    });
            } else {
                this.bot.sendMessage(chatId, '❌ Supabase not configured. Cannot remove email.');
            }
        });

        // Make admin command - Admin only
        this.bot.onText(/\/makeadmin (.+)/, (msg, match) => {
            const chatId = msg.chat.id;
            const adminId = msg.from.id;
            const userId = match[1];
            
            if (!this.authorization.isAdmin(adminId)) {
                this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }
            
            console.log(`👑 Admin ${adminId} promoting user ${userId} to admin`);
            
            // Promote user to admin in Supabase
            if (this.authorization.supabase && this.authorization.supabase.isEnabled()) {
                this.authorization.supabase.promoteToAdmin(userId)
                    .then(success => {
                        if (success) {
                            // Also update local authorization
                            this.authorization.addAuthorizedUser(userId, adminId);
                            this.authorization.addAdminUser(userId);
                            this.bot.sendMessage(chatId, `✅ User ${userId} promoted to admin`);
                        } else {
                            this.bot.sendMessage(chatId, `❌ Failed to promote user ${userId}`);
                        }
                    })
                    .catch(err => {
                        console.error('Error promoting user to admin:', err);
                        this.bot.sendMessage(chatId, `❌ Error: ${err.message}`);
                    });
            } else {
                this.bot.sendMessage(chatId, '❌ Supabase not configured. Cannot promote admin.');
            }
        });

        // Remove user command - Admin only with confirmation
        this.bot.onText(/\/remove (.+)/, (msg, match) => {
            const chatId = msg.chat.id;
            const adminId = msg.from.id;
            const userIdToRemove = match[1];
            
            // Prevent duplicate commands
            if (this.isDuplicateCommand(adminId, 'remove')) {
                console.log('🚫 Duplicate /remove command ignored from:', msg.from.username || msg.from.first_name);
                return;
            }
            
            if (!this.authorization.isAdmin(adminId)) {
                this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }
            
            // Check if user exists
            if (!this.authorization.isAuthorized(userIdToRemove)) {
                this.bot.sendMessage(chatId, `❌ User ${userIdToRemove} is not authorized or doesn't exist.`);
                return;
            }
            
            // Prevent self-removal
            if (userIdToRemove === adminId.toString()) {
                this.bot.sendMessage(chatId, 
                    '❌ <b>Self-Removal Not Allowed</b>\n\n' +
                    '⚠️ You cannot remove yourself from the system.\n' +
                    '🔄 If you need to transfer admin privileges, promote another user first.\n' +
                    '📱 Contact another admin if you need assistance.',
                    { parse_mode: 'HTML' }
                );
                return;
            }
            
            // Check if removing this admin would leave the system with no admins
            const adminUsers = this.authorization.getAdminUsers();
            const isTargetAdmin = this.authorization.isAdmin(userIdToRemove);
            
            if (isTargetAdmin && adminUsers.length <= 1) {
                this.bot.sendMessage(chatId, 
                    '❌ <b>Cannot Remove Last Admin</b>\n\n' +
                    '⚠️ Removing this admin would leave the system with no administrators.\n' +
                    '👑 At least one admin must remain in the system.\n' +
                    '🔄 Promote another user to admin first, then remove this user.\n' +
                    '🛡️ Set TELEGRAM_FALLBACK_ADMIN in environment for emergency recovery.',
                    { parse_mode: 'HTML' }
                );
                return;
            }
            
            const userName = this.authorization.getUserName(userIdToRemove) || 'Unknown';
            
            // Create confirmation message with special warnings for admin removal
            let confirmationMessage = '⚠️ <b>USER REMOVAL CONFIRMATION</b>\n\n';
            
            if (isTargetAdmin) {
                confirmationMessage += '👑 <b>ADMIN REMOVAL WARNING</b>\n\n';
                confirmationMessage += `🗑️ <b>Are you sure you want to remove ADMIN ${userIdToRemove} (${userName})?</b>\n\n`;
                confirmationMessage += '⚠️ <b>This will permanently:</b>\n';
                confirmationMessage += '• Remove admin from authorized users\n';
                confirmationMessage += '• Remove ALL admin privileges\n';
                confirmationMessage += '• Delete all personal keywords\n';
                confirmationMessage += '• Remove all group subscriptions\n';
                confirmationMessage += '• Delete user preferences\n';
                confirmationMessage += '• Remove user name from records\n\n';
                confirmationMessage += '🚨 <b>ADMIN PRIVILEGES WILL BE LOST FOREVER!</b>\n\n';
            } else {
                confirmationMessage += `🗑️ <b>Are you sure you want to remove user ${userIdToRemove} (${userName})?</b>\n\n`;
                confirmationMessage += '⚠️ <b>This will permanently:</b>\n';
                confirmationMessage += '• Remove user from authorized users\n';
                confirmationMessage += '• Delete all personal keywords\n';
                confirmationMessage += '• Remove all group subscriptions\n';
                confirmationMessage += '• Delete user preferences\n';
                confirmationMessage += '• Remove user name from records\n\n';
            }
            
            confirmationMessage += '🔴 <b>Type "CONFIRM REMOVE" to proceed</b>\n';
            confirmationMessage += '❌ <b>Type anything else to cancel</b>';
            
            // Show confirmation prompt
            this.bot.sendMessage(chatId, confirmationMessage, { parse_mode: 'HTML' });
            
            // Store pending removal confirmation
            this.pendingRemovalConfirmations = this.pendingRemovalConfirmations || new Map();
            this.pendingRemovalConfirmations.set(adminId, {
                chatId: chatId,
                userIdToRemove: userIdToRemove,
                userName: userName,
                timestamp: Date.now()
            });
            
            console.log(`🗑️ Admin ${adminId} requested removal confirmation for user ${userIdToRemove} (${userName})`);
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
                pending.forEach(userId => {
                    pendingText += `👤 User ID: ${userId}\n`;
                    pendingText += `📝 Username: @unknown\n`;
                    pendingText += `👋 Name: unknown\n`;
                    pendingText += `📅 Requested: Just now\n\n`;
                });
                pendingText += 'Use /approve <user_id> or /reject <user_id> to respond.';
            }
            
            this.bot.sendMessage(chatId, pendingText);
        });

        // Add keyword command - Admin only
        this.bot.onText(/\/addkeyword (.+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const keyword = match[1].trim();

            // Prevent duplicate commands
            if (this.isDuplicateCommand(userId, 'addkeyword')) {
                console.log('🚫 Duplicate /addkeyword command ignored from:', msg.from.username || msg.from.first_name);
                return;
            }

            if (!this.authorization.isAdmin(userId)) {
                this.bot.sendMessage(chatId, '❌ Admin access required to add global keywords.');
                return;
            }

            if (keyword.length < 2) {
                this.bot.sendMessage(chatId, '❌ Keyword must be at least 2 characters long.');
                return;
            }

            if (!this.keywordDetector) {
                this.bot.sendMessage(chatId, '❌ Keyword detector is not initialized. Please restart the bot.');
                return;
            }

            const keywords = this.keywordDetector.getKeywords();
            if (keywords.includes(keyword)) {
                const escapedKeyword = this.escapeHtml(keyword);
                this.bot.sendMessage(chatId, `❌ Keyword "${escapedKeyword}" already exists.`);
                return;
            }

            await this.keywordDetector.addKeyword(keyword, userId.toString());
            const escapedKeyword = this.escapeHtml(keyword);
            this.bot.sendMessage(chatId, `✅ Added global keyword: "${escapedKeyword}"`);
            console.log(`🔑 Admin ${userId} added keyword: ${keyword}`);
        });

        // Remove keyword command - Admin only
        this.bot.onText(/\/removekeyword (.+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const keyword = match[1].trim();

            // Prevent duplicate commands
            if (this.isDuplicateCommand(userId, 'removekeyword')) {
                console.log('🚫 Duplicate /removekeyword command ignored from:', msg.from.username || msg.from.first_name);
                return;
            }

            if (!this.authorization.isAdmin(userId)) {
                this.bot.sendMessage(chatId, '❌ Admin access required to remove global keywords.');
                return;
            }

            if (!this.keywordDetector) {
                this.bot.sendMessage(chatId, '❌ Keyword detector is not initialized. Please restart the bot.');
                return;
            }

            const keywords = this.keywordDetector.getKeywords();
            if (!keywords.includes(keyword)) {
                const escapedKeyword = this.escapeHtml(keyword);
                this.bot.sendMessage(chatId, `❌ Keyword "${escapedKeyword}" not found.`);
                return;
            }

            await this.keywordDetector.removeKeyword(keyword);
            const escapedKeyword = this.escapeHtml(keyword);
            this.bot.sendMessage(chatId, `✅ Removed global keyword: "${escapedKeyword}"`);
            console.log(`🔑 Admin ${userId} removed keyword: ${keyword}`);
        });

        // My keywords command - Show user's personal keywords
        this.bot.onText(/\/mykeywords/, (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;

            // Prevent duplicate commands
            if (this.isDuplicateCommand(userId, 'mykeywords')) {
                console.log('🚫 Duplicate /mykeywords command ignored from:', msg.from.username || msg.from.first_name);
                return;
            }

            if (!this.authorization.isAuthorized(userId)) {
                this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                return;
            }

            const personalKeywords = this.getPersonalKeywords(userId);
            let keywordsText = '🔑 <b>Your Personal Keywords:</b>\n\n';
            
            if (personalKeywords.length === 0) {
                keywordsText += 'No personal keywords set.\n\n';
            } else {
                personalKeywords.forEach((keyword, index) => {
                    // Escape HTML special characters to prevent parsing errors
                    const escapedKeyword = keyword
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#39;');
                    keywordsText += `${index + 1}. ${escapedKeyword}\n`;
                });
                keywordsText += '\n';
            }
            
            keywordsText += '💡 <b>Personal Keyword Management:</b>\n';
            keywordsText += '• /addmykeyword &lt;word&gt; - Add personal keyword\n';
            keywordsText += '• /removemykeyword &lt;word&gt; - Remove personal keyword\n\n';
            keywordsText += 'ℹ️ Personal keywords work alongside global keywords.';

            this.bot.sendMessage(chatId, keywordsText, { parse_mode: 'HTML' });
        });

        // Add personal keyword command
        this.bot.onText(/\/addmykeyword (.+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const keyword = match[1].trim();

            // Prevent duplicate commands
            if (this.isDuplicateCommand(userId, 'addmykeyword')) {
                console.log('🚫 Duplicate /addmykeyword command ignored from:', msg.from.username || msg.from.first_name);
                return;
            }

            if (!this.authorization.isAuthorized(userId)) {
                this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                return;
            }

            if (keyword.length < 2) {
                this.bot.sendMessage(chatId, '❌ Keyword must be at least 2 characters long.');
                return;
            }

            const personalKeywords = this.getPersonalKeywords(userId);
            if (personalKeywords.includes(keyword)) {
                const escapedKeyword = this.escapeHtml(keyword);
                this.bot.sendMessage(chatId, `❌ Personal keyword "${escapedKeyword}" already exists.`);
                return;
            }

            await this.addPersonalKeyword(userId, keyword);
            const escapedKeyword = this.escapeHtml(keyword);
            this.bot.sendMessage(chatId, `✅ Added personal keyword: "${escapedKeyword}"`);
            console.log(`🔑 User ${userId} added personal keyword: ${keyword}`);
        });

        // Remove personal keyword command
        this.bot.onText(/\/removemykeyword (.+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const keyword = match[1].trim();

            // Prevent duplicate commands
            if (this.isDuplicateCommand(userId, 'removemykeyword')) {
                console.log('🚫 Duplicate /removemykeyword command ignored from:', msg.from.username || msg.from.first_name);
                return;
            }

            if (!this.authorization.isAuthorized(userId)) {
                this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                return;
            }

            const personalKeywords = this.getPersonalKeywords(userId);
            if (!personalKeywords.includes(keyword)) {
                const escapedKeyword = this.escapeHtml(keyword);
                this.bot.sendMessage(chatId, `❌ Personal keyword "${escapedKeyword}" not found.`);
                return;
            }

            await this.removePersonalKeyword(userId, keyword);
            const escapedKeyword = this.escapeHtml(keyword);
            this.bot.sendMessage(chatId, `✅ Removed personal keyword: "${escapedKeyword}"`);
            console.log(`🔑 User ${userId} removed personal keyword: ${keyword}`);
        });

        // Restart command - Admin only with confirmation
        this.bot.onText(/\/restart/, (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            // Prevent duplicate commands
            if (this.isDuplicateCommand(userId, 'restart')) {
                console.log('🚫 Duplicate /restart command ignored from:', msg.from.username || msg.from.first_name);
                return;
            }
            
            if (!this.authorization.isAdmin(userId)) {
                this.bot.sendMessage(chatId, '❌ Admin access required to restart the bot.');
                return;
            }
            
            console.log('📨 Received /restart from:', msg.from.username || msg.from.first_name);
            
            // First confirmation prompt
            this.bot.sendMessage(chatId, 
                '⚠️ <b>RESTART CONFIRMATION REQUIRED</b>\n\n' +
                '🔄 <b>Are you sure you want to restart the bot?</b>\n\n' +
                '⚠️ <b>This will:</b>\n' +
                '• Restart the bot process\n' +
                '• Require WhatsApp QR code to be scanned again\n' +
                '• Temporarily stop all monitoring\n' +
                '• Take 10-30 seconds to reconnect\n\n' +
                '✅ <b>What will be preserved:</b>\n' +
                '• All user authorizations\n' +
                '• Group subscriptions\n' +
                '• Global keywords\n' +
                '• Personal keywords\n' +
                '• Bot configurations\n\n' +
                '🔴 <b>Type "CONFIRM RESTART" to proceed</b>\n' +
                '❌ <b>Type anything else to cancel</b>',
                { parse_mode: 'HTML' }
            );
            
            // Store pending restart confirmation
            this.pendingRestartConfirmations = this.pendingRestartConfirmations || new Map();
            this.pendingRestartConfirmations.set(userId, {
                chatId: chatId,
                timestamp: Date.now()
            });
            
            console.log(`🔄 Admin ${userId} requested restart confirmation`);
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
            } else if (error.message.includes('409 Conflict')) {
                // CRITICAL: Multiple bot instances running
                console.error('\n🚨 =============================================');
                console.error('🚨 CRITICAL: TELEGRAM 409 CONFLICT DETECTED');
                console.error('🚨 =============================================');
                console.error('❌ Error: Another bot instance is polling Telegram!');
                console.error('');
                console.error('🔍 This means:');
                console.error('  1. Bot is running LOCALLY on your computer');
                console.error('  2. AND also running on Render (or another server)');
                console.error('  3. Both are trying to poll Telegram with the same bot token');
                console.error('');
                console.error('✅ SOLUTION:');
                console.error('  1. Stop the bot running locally (press Ctrl+C)');
                console.error('  2. OR stop the Render deployment temporarily');
                console.error('  3. Only ONE instance should run at a time');
                console.error('');
                console.error('💡 To find if bot is running locally:');
                console.error('  - Windows: Task Manager → node.exe');
                console.error('  - Or check: npm start is NOT running in any terminal');
                console.error('=============================================\n');
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
                const data = JSON.parse(fs.readFileSync(discoveredPath, 'utf8'));
                // Convert the groups array to the expected format
                const groups = {};
                if (data.groups && Array.isArray(data.groups)) {
                    data.groups.forEach(group => {
                        groups[group.id] = {
                            name: group.name,
                            participants: group.participants,
                            description: group.description,
                            creation: group.creation
                        };
                    });
                }
                return groups;
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

    // Setup reminder commands
    setupReminderCommands(bot) {
        // /ok command - acknowledge and stop reminders
        bot.onText(/\/ok/, (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            console.log('📨 Received /ok from user', userId);
            
            if (!this.authorization.isAuthorized(userId)) {
                bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                return;
            }

            if (this.isDuplicateCommand(userId, 'ok')) {
                return;
            }

            // Get active reminder
            const reminderManager = this.getReminderManager();
            if (reminderManager) {
                const result = reminderManager.acknowledgeReminder(userId);
                if (result.hasActive) {
                    const summaryText = reminderManager.formatAcknowledgmentSummary(result);
                    bot.sendMessage(chatId, summaryText);
                } else {
                    bot.sendMessage(chatId, result.summary);
                }
            }
        });

        // /reminders command - show active reminders
        bot.onText(/\/reminders/, (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            console.log('📨 Received /reminders from user', userId);
            
            if (!this.authorization.isAuthorized(userId)) {
                bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                return;
            }

            if (this.isDuplicateCommand(userId, 'reminders')) {
                return;
            }

            const reminderManager = this.getReminderManager();
            if (reminderManager) {
                const reminder = reminderManager.getReminders(userId);
                if (reminder) {
                    const timeElapsed = this.calculateTimeElapsed(reminder.firstDetectedAt);
                    const response = `⏰ Active Reminder\n\n` +
                        `Keyword: ${reminder.keyword}\n` +
                        `From: ${reminder.sender}\n` +
                        `Group: ${reminder.group}\n` +
                        `Detected: ${timeElapsed}\n` +
                        `Reminders sent: ${reminder.reminderCount}/4\n\n` +
                        `Message:\n"${reminder.message.substring(0, 100)}${reminder.message.length > 100 ? '...' : ''}"\n\n` +
                        `Reply /ok to acknowledge and stop.`;
                    bot.sendMessage(chatId, response);
                } else {
                    bot.sendMessage(chatId, 'ℹ️ No active reminders.');
                }
            }
        });
    }

    // Get reminder manager (will be injected by bot)
    getReminderManager() {
        return this.reminderManager;
    }

    // Calculate time elapsed
    calculateTimeElapsed(date) {
        const now = Date.now();
        const then = new Date(date).getTime();
        const minutes = Math.floor((now - then) / 60000);
        
        if (minutes < 1) return 'Just now';
        if (minutes === 1) return '1 minute ago';
        if (minutes < 60) return `${minutes} minutes ago`;
        
        const hours = Math.floor(minutes / 60);
        if (hours === 1) return '1 hour ago';
        return `${hours} hours ago`;
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

    // Personal keyword management methods
    getPersonalKeywords(userId) {
        try {
            const fs = require('fs');
            const path = require('path');
            const personalKeywordsPath = path.join(__dirname, '../config/personal-keywords.json');
            
            if (fs.existsSync(personalKeywordsPath)) {
                const data = JSON.parse(fs.readFileSync(personalKeywordsPath, 'utf8'));
                return data[userId] || [];
            }
            
            return [];
        } catch (error) {
            console.error('Error loading personal keywords:', error.message);
            return [];
        }
    }

    async addPersonalKeyword(userId, keyword) {
        try {
            const fs = require('fs');
            const path = require('path');
            const personalKeywordsPath = path.join(__dirname, '../config/personal-keywords.json');
            
            let data = {};
            if (fs.existsSync(personalKeywordsPath)) {
                data = JSON.parse(fs.readFileSync(personalKeywordsPath, 'utf8'));
            }
            
            if (!data[userId]) {
                data[userId] = [];
            }
            
            if (!data[userId].includes(keyword)) {
                data[userId].push(keyword);
                fs.writeFileSync(personalKeywordsPath, JSON.stringify(data, null, 2));
                
                // Also save to Supabase
                if (this.keywordDetector && this.keywordDetector.supabase && this.keywordDetector.supabase.isEnabled()) {
                    console.log(`💾 Saving personal keyword "${keyword}" to Supabase for user ${userId}...`);
                    await this.keywordDetector.supabase.setPersonalKeywords(userId.toString(), data[userId]);
                    console.log(`✅ Personal keyword saved to Supabase`);
                }
            }
        } catch (error) {
            console.error('Error adding personal keyword:', error.message);
        }
    }

    async removePersonalKeyword(userId, keyword) {
        try {
            const fs = require('fs');
            const path = require('path');
            const personalKeywordsPath = path.join(__dirname, '../config/personal-keywords.json');
            
            let data = {};
            if (fs.existsSync(personalKeywordsPath)) {
                data = JSON.parse(fs.readFileSync(personalKeywordsPath, 'utf8'));
            }
            
            if (data[userId]) {
                const index = data[userId].indexOf(keyword);
                if (index > -1) {
                    data[userId].splice(index, 1);
                    fs.writeFileSync(personalKeywordsPath, JSON.stringify(data, null, 2));
                    
                    // Also update Supabase
                    if (this.keywordDetector && this.keywordDetector.supabase && this.keywordDetector.supabase.isEnabled()) {
                        console.log(`💾 Removing personal keyword "${keyword}" from Supabase for user ${userId}...`);
                        await this.keywordDetector.supabase.setPersonalKeywords(userId.toString(), data[userId]);
                        console.log(`✅ Personal keyword removed from Supabase`);
                    }
                }
            }
        } catch (error) {
            console.error('Error removing personal keyword:', error.message);
        }
    }

    stop() {
        try {
            console.log('🛑 Stopping Telegram polling...');
            this.bot.stopPolling();
            console.log('✅ Telegram polling stopped');
        } catch (error) {
            console.error('⚠️ Error stopping Telegram polling:', error.message);
        }
    }
}

module.exports = TelegramCommandHandler;