/**
 * Simple Telegram Bot Command Handler
 * Based on the working simple bot
 */

const TelegramBot = require('node-telegram-bot-api');
const TelegramAuthorization = require('./telegram-auth');
const { logBotEvent, logError } = require('./logger');
const fs = require('fs');
const path = require('path');

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
                
                // Check for RESTART confirmation (case-insensitive)
                if (messageText && messageText.trim().toUpperCase() === 'RESTART') {
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
                    // Cancelled restart (anything other than "RESTART")
                    this.pendingRestartConfirmations.delete(userId);
                    
                    this.bot.sendMessage(confirmation.chatId, 
                        '❌ <b>Restart Cancelled</b>\n\n' +
                        '✅ Bot will continue running normally.\n' +
                        '🔄 Use /restart again if you need to restart later.',
                        { parse_mode: 'HTML' }
                    );
                    
                    console.log(`🔄 Admin ${userId} cancelled bot restart`);
                }
                
                // IMPORTANT: Return early to prevent message from being processed as broadcast or other commands
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
                        const escapedUserName = this.escapeHtml(confirmation.userName);
                        this.bot.sendMessage(confirmation.chatId, 
                            '✅ <b>User Removal Confirmed!</b>\n\n' +
                            `🗑️ <b>User ${confirmation.userIdToRemove} (${escapedUserName}) has been removed</b>\n\n` +
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
                        const escapedUserName = this.escapeHtml(confirmation.userName);
                        this.bot.sendMessage(confirmation.chatId, 
                            '❌ <b>Removal Failed</b>\n\n' +
                            `Failed to remove user ${confirmation.userIdToRemove} (${escapedUserName}).\n` +
                            'Please try again or check the logs for errors.',
                            { parse_mode: 'HTML' }
                        );
                    }
                    
                } else {
                    // Cancelled removal
                    this.pendingRemovalConfirmations.delete(userId);
                    
                    const escapedUserName = this.escapeHtml(confirmation.userName);
                    this.bot.sendMessage(confirmation.chatId, 
                        '❌ <b>User Removal Cancelled</b>\n\n' +
                        `✅ User ${confirmation.userIdToRemove} (${escapedUserName}) remains authorized.\n` +
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
                        const escapedUserName = this.escapeHtml(userName);
                        const escapedMessageText = this.escapeHtml(messageText);
                        const broadcastMessage = `📢 <b>Message from ${escapedUserName}:</b>\n\n"${escapedMessageText}"`;
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
                // Differentiate between admin and regular user
                if (this.authorization.isAdmin(userId)) {
                    this.bot.sendMessage(chatId, 
                        '👑 <b>Welcome back, Admin!</b>\n\n' +
                        '✅ You are authorized and have admin privileges.\n\n' +
                        '📋 <b>Quick Commands:</b>\n' +
                        '• <code>/help</code> - See all available commands\n' +
                        '• <code>/admin</code> - See admin-only commands\n' +
                        '• <code>/status</code> - Check bot status\n' +
                        '• <code>/stats</code> - View statistics\n\n' +
                        '🤖 Bot is working and monitoring for keywords!',
                        { parse_mode: 'HTML' }
                    );
            } else {
                this.bot.sendMessage(chatId, 
                        '👑 <b>Welcome back!</b>\n\n' +
                        '✅ You are authorized and have user privileges.\n\n' +
                        '📋 <b>Quick Commands:</b>\n' +
                        '• <code>/help</code> - See all available commands\n' +
                        '• <code>/status</code> - Check bot status\n' +
                        '• <code>/stats</code> - View statistics\n\n' +
                        '🤖 Bot is working and monitoring for keywords!',
                        { parse_mode: 'HTML' }
                    );
                }
            } else {
                this.bot.sendMessage(chatId, 
                    '🔐 <b>Access Request</b>\n\n' +
                    'You are not authorized to use this bot.\n' +
                    'Your request has been sent to administrators for approval.\n\n' +
                    'Request ID: ' + userId + '\n' +
                    'Name: ' + userName
                );
                this.authorization.addPendingApproval(userId, {
                    username: msg.from.username,
                    firstName: msg.from.first_name
                });
                // Send async notification to admins (don't await - fire and forget)
                this.notifyAdmins(`🔔 New access request from user ${userId} (@${msg.from.username || 'unknown'}) - ${userName}`).catch(error => {
                    console.error('❌ Error sending admin notification:', error.message);
                });
            }
        });

        // Help command
        this.bot.onText(/\/help/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            console.log('📨 Received /help from:', msg.from.username || msg.from.first_name);
            
            if (!this.authorization.isAuthorized(userId)) {
                await this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
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
                    '/groups - Show monitored groups\n' +
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
                    '🌍 Timezone Commands:\n' +
                    '/israel - Israeli time 🇮🇱\n' +
                    '/usa - US Eastern time 🇺🇸\n' +
                    '/uk - UK time 🇬🇧\n' +
                    '/japan - Japan time 🇯🇵\n' +
                    '/timezone <tz> - Set custom timezone (e.g., Asia/Jerusalem)\n\n' +
                    '⚙️ Control Commands:\n' +
                    '/24h - Toggle 24/7 mode\n' +
                    '/admin - Admin panel\n' +
                    '/stats - Bot statistics\n\n' +
                    '👑 Admin Only:\n' +
                    '/users - List all users with roles\n' +
                    '/admins - Show admin users only\n' +
                    '/antiban - Show anti-ban status\n' +
                    '/approve <user_id> - Approve user\n' +
                    '/reject <user_id> - Reject user\n' +
                    '/pending - Show pending requests\n' +
                    '/remove <user_id> - Remove user (with confirmation)\n' +
                    '/setemail <user_id> <email> - Add user email (supports multiple)\n' +
                    '/removeemail <user_id> <email> - Remove specific user email\n' +
                    '/makeadmin <user_id> - Promote user to admin\n' +
                    '/restart - Restart bot (preserves all data)\n' +
                    '/resetall - Reset all reminders (clears active reminders)\n\n' +
                    '💬 Broadcast:\n' +
                    'Send any message (not a command) to broadcast to all authorized users';
            await this.bot.sendMessage(chatId, helpText);
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
            
            // Authorization check
            if (!this.authorization.isAuthorized(userId)) {
                this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
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

        // Admin command - Must use exact match to avoid matching /admins
        this.bot.onText(/^\/admin$/, (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            // Prevent duplicate commands
            if (this.isDuplicateCommand(userId, 'admin')) {
                console.log('🚫 Duplicate /admin command ignored from:', msg.from.username || msg.from.first_name);
                return;
            }
            
            // Authorization check - Admin only
            if (!this.authorization.isAdmin(userId)) {
                this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }
            
            console.log('📨 Received /admin from:', msg.from.username || msg.from.first_name);
            const adminText = '👑 Admin Panel - Help Menu\n\n' +
                '<b>Available admin-only commands:</b>\n\n' +
                '<b>User Management:</b>\n' +
                '/users - List all users with roles\n' +
                '/admins - Show admin users only\n' +
                '/approve &lt;user_id&gt; - Approve user\n' +
                '/reject &lt;user_id&gt; - Reject user\n' +
                '/remove &lt;user_id&gt; - Remove user (with confirmation)\n' +
                '/pending - Show pending requests\n' +
                '/makeadmin &lt;user_id&gt; - Promote user to admin\n' +
                '/setemail &lt;user_id&gt; &lt;email&gt; - Add user email\n' +
                '/removeemail &lt;user_id&gt; &lt;email&gt; - Remove user email\n\n' +
                '<b>Keyword Management:</b>\n' +
                '/addkeyword &lt;word&gt; - Add global keyword\n' +
                '/removekeyword &lt;word&gt; - Remove global keyword\n\n' +
                '<b>Bot Control:</b>\n' +
                '/restart - Restart bot (preserves all data)\n' +
                '/resetall - Reset all reminders\n' +
                '/antiban - Show anti-ban status\n\n' +
                '<b>Note:</b> For information commands available to all users, see /help';
            this.bot.sendMessage(chatId, adminText, { parse_mode: 'HTML' });
        });

        // Users command
        this.bot.onText(/\/users/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            // Prevent duplicate commands
            if (this.isDuplicateCommand(userId, 'users')) {
                console.log('🚫 Duplicate /users command ignored from:', msg.from.username || msg.from.first_name);
                return;
            }
            
            // Authorization check - Admin only (sensitive info)
            if (!this.authorization.isAdmin(userId)) {
                await this.bot.sendMessage(chatId, '❌ Admin access required.');
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
                // Fetch emails for all users
                for (const user of authorizedUsers) {
                    const isAdmin = adminUsers.includes(user);
                    const adminBadge = isAdmin ? '👑' : '👤';
                    const adminStatus = isAdmin ? 'Admin' : 'User';
                    const adminEmoji = isAdmin ? '✅' : '👤';
                    const userName = this.authorization.getUserName(user) || 'Unknown';
                    
                    // Get user emails from Supabase (same table for all users - admins and regular users)
                    let userEmails = [];
                    if (this.keywordDetector && this.keywordDetector.supabase && this.keywordDetector.supabase.isEnabled()) {
                        try {
                            const emails = await this.keywordDetector.supabase.getUserEmails(user);
                            if (emails && emails.length > 0) {
                                userEmails = emails;
                            } else {
                                // Fallback to legacy single email
                                const legacyEmail = await this.keywordDetector.supabase.getUserEmail(user);
                                if (legacyEmail) {
                                    userEmails = [legacyEmail];
                                }
                            }
                        } catch (error) {
                            console.error(`Error fetching emails for user ${user}:`, error.message);
                        }
                    }
                    
                    const index = authorizedUsers.indexOf(user) + 1;
                    const escapedUserName = this.escapeHtml(userName);
                    usersText += `${adminBadge} <b>User ${index} - ${escapedUserName}</b>\n`;
                    usersText += `   📱 ID: ${user}\n`;
                    usersText += `   ${adminEmoji} Role: ${adminStatus}\n`;
                    usersText += `   ✅ Status: Active\n`;
                    usersText += `   🔔 Notifications: Enabled\n`;
                    if (userEmails.length > 0) {
                        const escapedEmails = userEmails.map(email => this.escapeHtml(email)).join(', ');
                        usersText += `   📧 Email(s): ${escapedEmails}\n`;
                    } else {
                        usersText += `   📧 Email(s): Not configured\n`;
                    }
                    usersText += `\n`;
                }
                
                usersText += `📊 <b>Summary:</b>\n`;
                usersText += `   👥 Total Users: ${authorizedUsers.length}\n`;
                usersText += `   👑 Admins: ${adminUsers.length}\n`;
                usersText += `   👤 Regular Users: ${authorizedUsers.length - adminUsers.length}\n`;
            }
            
            await this.bot.sendMessage(chatId, usersText, { parse_mode: 'HTML' });
        });

        // Admins command - Show only admin users (use exact match for clarity)
        this.bot.onText(/^\/admins$/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            // Prevent duplicate commands
            if (this.isDuplicateCommand(userId, 'admins')) {
                console.log('🚫 Duplicate /admins command ignored from:', msg.from.username || msg.from.first_name);
                return;
            }
            
            // Authorization check - Admin only (sensitive info)
            if (!this.authorization.isAdmin(userId)) {
                await this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }
            
            console.log('📨 Received /admins from:', msg.from.username || msg.from.first_name);
            
            // Get admin users
            const adminUsers = this.authorization.getAdminUsers();
            
            let adminsText = '👑 <b>Admin Users</b>\n\n';
            
            if (adminUsers.length === 0) {
                adminsText += '❌ No admin users found.';
            } else {
                // Fetch emails for all admins
                for (let index = 0; index < adminUsers.length; index++) {
                    const adminId = adminUsers[index];
                    const adminName = this.authorization.getUserName(adminId) || 'Unknown';
                    
                    // Get admin emails from Supabase (same user_emails table - admins are users too)
                    // Note: There's no separate "admin email" - admins have emails in user_emails table like all users
                    let adminEmails = [];
                    if (this.keywordDetector && this.keywordDetector.supabase && this.keywordDetector.supabase.isEnabled()) {
                        try {
                            const emails = await this.keywordDetector.supabase.getUserEmails(adminId);
                            if (emails && emails.length > 0) {
                                adminEmails = emails;
                            } else {
                                // Fallback to legacy single email
                                const legacyEmail = await this.keywordDetector.supabase.getUserEmail(adminId);
                                if (legacyEmail) {
                                    adminEmails = [legacyEmail];
                                }
                            }
                        } catch (error) {
                            console.error(`Error fetching emails for admin ${adminId}:`, error.message);
                        }
                    }
                    
                    const escapedAdminName = this.escapeHtml(adminName);
                    adminsText += `👑 <b>Admin ${index + 1} - ${escapedAdminName}</b>\n`;
                    adminsText += `   📱 ID: ${adminId}\n`;
                    adminsText += `   ✅ Role: Admin\n`;
                    adminsText += `   ✅ Status: Active\n`;
                    adminsText += `   🔔 Notifications: Enabled\n`;
                    adminsText += `   🛠️ Admin Commands: Available\n`;
                    if (adminEmails.length > 0) {
                        const escapedEmails = adminEmails.map(email => this.escapeHtml(email)).join(', ');
                        adminsText += `   📧 Email(s): ${escapedEmails}\n`;
                    } else {
                        adminsText += `   📧 Email(s): Not configured\n`;
                    }
                    adminsText += `\n`;
                }
                
                adminsText += `📊 <b>Summary:</b>\n`;
                adminsText += `   👑 Total Admins: ${adminUsers.length}\n`;
                adminsText += `   💡 To see admin commands, use /admin\n`;
            }
            
            await this.bot.sendMessage(chatId, adminsText, { parse_mode: 'HTML' });
        });

        // Keywords command
        // Keywords command - Show current keywords
        this.bot.onText(/\/keywords/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            // Prevent duplicate commands
            if (this.isDuplicateCommand(userId, 'keywords')) {
                console.log('🚫 Duplicate /keywords command ignored from:', msg.from.username || msg.from.first_name);
                return;
            }
            
            if (!this.authorization.isAuthorized(userId)) {
                await this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                return;
            }

            if (!this.keywordDetector) {
                await this.bot.sendMessage(chatId, '❌ Keyword detector is not initialized. Please restart the bot.');
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

            await this.bot.sendMessage(chatId, keywordsText, { parse_mode: 'HTML' });
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
            
            // Authorization check
            if (!this.authorization.isAuthorized(userId)) {
                this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                return;
            }
            
            console.log('📨 Received /stats from:', msg.from.username || msg.from.first_name);
            
            // Get actual statistics
            const adminUsers = this.authorization.getAdminUsers();
            const authorizedUsers = this.authorization.getAuthorizedUsers();
            const keywords = this.keywordDetector ? this.keywordDetector.getKeywords() : [];
            
            // Read version from package.json
            let version = '1.0.0';
            try {
                const packagePath = path.join(__dirname, '..', 'package.json');
                const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
                version = packageJson.version || '1.0.0';
            } catch (error) {
                console.warn('⚠️ Could not read package.json for version, using default');
            }
            
            const statsText = '📈 Bot Statistics\n\n' +
                `🤖 Bot Version: ${version}\n` +
                '⏰ Uptime: Running\n' +
                '📱 WhatsApp: Connected\n' +
                '🔔 Telegram: Active\n' +
                `🔍 Keywords: ${keywords.length} loaded\n` +
                `👑 Admins: ${adminUsers.length}\n` +
                `👥 Users: ${authorizedUsers.length}\n` +
                '📊 Notifications: Ready\n' +
                `🕐 Last Update: ${new Date().toLocaleString()}`;
            this.bot.sendMessage(chatId, statsText);
        });

        // Groups command
        this.bot.onText(/\/groups/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            console.log('📨 Received /groups from:', msg.from.username || msg.from.first_name);
            
            if (!this.authorization.isAuthorized(userId)) {
                await this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
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
            this.bot.onText(/\/allgroups/, async (msg) => {
                const chatId = msg.chat.id;
                const userId = msg.from.id;
                
                // Prevent duplicate commands
                if (this.isDuplicateCommand(userId, 'allgroups')) {
                    console.log('🚫 Duplicate /allgroups command ignored from:', msg.from.username || msg.from.first_name);
                    return;
                }
                
                if (!this.authorization.isAuthorized(userId)) {
                    await this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }
                
                console.log('📨 Received /allgroups from:', msg.from.username || msg.from.first_name);
                
                // Load discovered groups and subscriptions
                const discoveredGroups = this.loadDiscoveredGroups();
                const subscriptions = await this.loadGroupSubscriptions();
                
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
                
                await this.bot.sendMessage(chatId, allGroupsText);
            });

            // Subscribe to group command
            this.bot.onText(/\/subscribe (.+)/, async (msg, match) => {
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
                const subscriptions = await this.loadGroupSubscriptions();
                
                // Check if group exists
                const groupExists = Object.values(discoveredGroups).some(group => 
                    group.name && group.name.toLowerCase() === groupName.toLowerCase()
                );
                
                if (!groupExists) {
                    await this.bot.sendMessage(chatId,
                        `❌ Group "${groupName}" not found!\n\n` +
                        `💡 Available groups:\n` +
                        Object.values(discoveredGroups).map(group => `• ${group.name || 'Unknown'}`).join('\n') +
                        `\n\nUse /discover to see all groups the bot is in.`
                    );
                    return;
                }
                
                // Check if already subscribed
                const currentSubscribers = subscriptions[groupName] || [];
                const userIdStr = userId.toString();
                if (currentSubscribers.includes(userIdStr) || currentSubscribers.includes(chatId.toString())) {
                    await this.bot.sendMessage(chatId,
                        `✅ You're already subscribed to "${groupName}"!\n\n` +
                        `Use /mygroups to see all your subscriptions.`
                    );
                    return;
                }
                
                // Add subscription to Supabase first, then update file
                if (this.keywordDetector && this.keywordDetector.supabase && this.keywordDetector.supabase.isEnabled()) {
                    try {
                        const supabaseSuccess = await this.keywordDetector.supabase.addGroupSubscription(userIdStr, groupName);
                        if (supabaseSuccess) {
                            console.log(`💾 Added group subscription to Supabase: user ${userId} → ${groupName}`);
                        }
                    } catch (error) {
                        console.error('Error adding subscription to Supabase:', error.message);
                    }
                }
                
                // Also save to file (backup and backward compatibility)
                subscriptions[groupName] = [...currentSubscribers, userIdStr];
                await this.saveGroupSubscriptions(subscriptions);
                
                await this.bot.sendMessage(chatId,
                    `✅ Successfully subscribed to "${groupName}"!\n\n` +
                    `🔔 You'll now receive notifications when keywords are detected in this group.\n\n` +
                    `Use /mygroups to see all your subscriptions.`
                );
            });

            // Unsubscribe from group command
            this.bot.onText(/\/unsubscribe (.+)/, async (msg, match) => {
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
                const subscriptions = await this.loadGroupSubscriptions();
                const currentSubscribers = subscriptions[groupName] || [];
                const userIdStr = userId.toString();
                
                // Check if subscribed (check both userId and chatId for backward compatibility)
                const isSubscribed = currentSubscribers.includes(userIdStr) || currentSubscribers.includes(chatId.toString());
                
                if (!isSubscribed) {
                    await this.bot.sendMessage(chatId,
                        `❌ You're not subscribed to "${groupName}"!\n\n` +
                        `Use /mygroups to see your current subscriptions.`
                    );
                    return;
                }
                
                // Remove subscription from Supabase first
                if (this.keywordDetector && this.keywordDetector.supabase && this.keywordDetector.supabase.isEnabled()) {
                    try {
                        const supabaseSuccess = await this.keywordDetector.supabase.removeGroupSubscription(userIdStr, groupName);
                        if (supabaseSuccess) {
                            console.log(`💾 Removed group subscription from Supabase: user ${userId} → ${groupName}`);
                        }
                    } catch (error) {
                        console.error('Error removing subscription from Supabase:', error.message);
                    }
                }
                
                // Also remove from file (backup and backward compatibility)
                subscriptions[groupName] = currentSubscribers.filter(id => id !== userIdStr && id !== chatId.toString());
                await this.saveGroupSubscriptions(subscriptions);
                
                await this.bot.sendMessage(chatId,
                    `✅ Successfully unsubscribed from "${groupName}"!\n\n` +
                    `🔕 You'll no longer receive notifications from this group.\n\n` +
                    `Use /mygroups to see your remaining subscriptions.`
                );
            });

            // My groups command
            this.bot.onText(/\/mygroups/, async (msg) => {
                const chatId = msg.chat.id;
                const userId = msg.from.id;
                
                // Prevent duplicate commands
                if (this.isDuplicateCommand(userId, 'mygroups')) {
                    console.log('🚫 Duplicate /mygroups command ignored from:', msg.from.username || msg.from.first_name);
                    return;
                }
                
                if (!this.authorization.isAuthorized(userId)) {
                    await this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }
                
                console.log('📨 Received /mygroups from:', msg.from.username || msg.from.first_name);
                
                // Load subscriptions from Supabase first
                const subscriptions = await this.loadGroupSubscriptions();
                
                // Find user's subscriptions (check both userId and chatId for backward compatibility)
                const userIdStr = userId.toString();
                const userSubscriptions = Object.entries(subscriptions)
                    .filter(([groupName, subscribers]) => subscribers.includes(userIdStr) || subscribers.includes(chatId.toString()))
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
                
                await this.bot.sendMessage(chatId, myGroupsText);
            });

            // Simple timezone commands that actually work!
            this.bot.onText(/\/israel/, async (msg) => {
                const chatId = msg.chat.id;
                const userId = msg.from.id;
                
                // Prevent duplicate commands
                if (this.isDuplicateCommand(userId, 'israel')) {
                    console.log('🚫 Duplicate /israel command ignored from:', msg.from.username || msg.from.first_name);
                    return;
                }
                
                if (!this.authorization.isAuthorized(userId)) {
                    await this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }
                await this.updateTimezone(chatId, 'Asia/Jerusalem');
            });

            this.bot.onText(/\/usa/, async (msg) => {
                const chatId = msg.chat.id;
                const userId = msg.from.id;
                if (!this.authorization.isAuthorized(userId)) {
                    await this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }
                await this.updateTimezone(chatId, 'America/New_York');
            });

            this.bot.onText(/\/uk/, async (msg) => {
                const chatId = msg.chat.id;
                const userId = msg.from.id;
                if (!this.authorization.isAuthorized(userId)) {
                    await this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }
                await this.updateTimezone(chatId, 'Europe/London');
            });

            this.bot.onText(/\/japan/, async (msg) => {
                const chatId = msg.chat.id;
                const userId = msg.from.id;
                if (!this.authorization.isAuthorized(userId)) {
                    await this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }
                await this.updateTimezone(chatId, 'Asia/Tokyo');
            });

            // Advanced timezone command (for power users)
            this.bot.onText(/\/timezone (.+)/, async (msg, match) => {
                const chatId = msg.chat.id;
                const userId = msg.from.id;
                const timezone = match[1];

                if (!this.authorization.isAuthorized(userId)) {
                    await this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }

                const validTimezones = [
                    'Asia/Jerusalem', 'America/New_York', 'Europe/London', 
                    'Asia/Tokyo', 'Australia/Sydney', 'UTC'
                ];

                if (!validTimezones.includes(timezone)) {
                    await this.bot.sendMessage(chatId,
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

                await this.updateTimezone(chatId, timezone);
            });

            // Sleep mode commands
            this.bot.onText(/\/sleep/, async (msg) => {
                const chatId = msg.chat.id;
                const userId = msg.from.id;

                if (!this.authorization.isAuthorized(userId)) {
                    await this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }

                // Prevent duplicate commands
                if (this.isDuplicateCommand(userId, 'sleep')) {
                    console.log('🚫 Duplicate /sleep command ignored from:', msg.from.username || msg.from.first_name);
                    return;
                }

                // Get user's timezone preference
                const userTimezone = await this.getUserTimezone(chatId);
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

                await this.bot.sendMessage(chatId,
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

        // Set email command - Admin only (adds email; supports multiple)
        this.bot.onText(/\/setemail (.+) (.+)/, (msg, match) => {
            const chatId = msg.chat.id;
            const adminId = msg.from.id;
            const userId = match[1];
            const email = match[2];
            
            if (!this.authorization.isAdmin(adminId)) {
                this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }
            
            console.log(`📧 Admin ${adminId} adding email for user ${userId}: ${email}`);
            
            // Add email in Supabase (user_emails table)
            if (this.keywordDetector && this.keywordDetector.supabase && this.keywordDetector.supabase.isEnabled()) {
                this.keywordDetector.supabase.addUserEmail(userId, email)
                    .then(success => {
                        if (success) {
                            this.bot.sendMessage(chatId, `✅ Email added for user ${userId}: ${email}`);
                        } else {
                            this.bot.sendMessage(chatId, `❌ Failed to add email for user ${userId}`);
                        }
                    })
                    .catch(err => {
                        console.error('Error adding email:', err);
                        this.bot.sendMessage(chatId, `❌ Failed to add email: ${err.message}`);
                    });
            } else {
                this.bot.sendMessage(chatId, '❌ Supabase not configured. Cannot update email.');
            }
        });

        // Remove email command - Admin only (removes specific address)
        this.bot.onText(/\/removeemail (.+) (.+)/, (msg, match) => {
            const chatId = msg.chat.id;
            const adminId = msg.from.id;
            const userId = match[1];
            const email = match[2];
            
            if (!this.authorization.isAdmin(adminId)) {
                this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }
            
            console.log(`📧 Admin ${adminId} removing email for user ${userId}: ${email}`);
            
            if (this.keywordDetector && this.keywordDetector.supabase && this.keywordDetector.supabase.isEnabled()) {
                this.keywordDetector.supabase.removeUserEmail(userId, email)
                    .then(success => {
                        if (success) {
                            this.bot.sendMessage(chatId, `✅ Email removed for user ${userId}: ${email}`);
                        } else {
                            this.bot.sendMessage(chatId, `❌ Failed to remove email for user ${userId}`);
                        }
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
            const escapedUserName = this.escapeHtml(userName);
            
            // Create confirmation message with special warnings for admin removal
            let confirmationMessage = '⚠️ <b>USER REMOVAL CONFIRMATION</b>\n\n';
            
            if (isTargetAdmin) {
                confirmationMessage += '👑 <b>ADMIN REMOVAL WARNING</b>\n\n';
                confirmationMessage += `🗑️ <b>Are you sure you want to remove ADMIN ${userIdToRemove} (${escapedUserName})?</b>\n\n`;
                confirmationMessage += '⚠️ <b>This will permanently:</b>\n';
                confirmationMessage += '• Remove admin from authorized users\n';
                confirmationMessage += '• Remove ALL admin privileges\n';
                confirmationMessage += '• Delete all personal keywords\n';
                confirmationMessage += '• Remove all group subscriptions\n';
                confirmationMessage += '• Delete user preferences\n';
                confirmationMessage += '• Remove user name from records\n\n';
                confirmationMessage += '🚨 <b>ADMIN PRIVILEGES WILL BE LOST FOREVER!</b>\n\n';
            } else {
                confirmationMessage += `🗑️ <b>Are you sure you want to remove user ${userIdToRemove} (${escapedUserName})?</b>\n\n`;
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
                pending.forEach(pendingInfo => {
                    const userId = pendingInfo.userId;
                    const username = pendingInfo.username || 'unknown';
                    const firstName = pendingInfo.firstName || 'Unknown';
                    const timestamp = pendingInfo.timestamp || Date.now();
                    const timeAgo = this.formatTimeAgo(timestamp);
                    
                    pendingText += `👤 User ID: ${userId}\n`;
                    pendingText += `📝 Username: @${username}\n`;
                    pendingText += `👋 Name: ${firstName}\n`;
                    pendingText += `📅 Requested: ${timeAgo}\n\n`;
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
                await this.bot.sendMessage(chatId, '❌ Admin access required to add global keywords.');
                return;
            }

            if (keyword.length < 2) {
                await this.bot.sendMessage(chatId, '❌ Keyword must be at least 2 characters long.');
                return;
            }

            if (!this.keywordDetector) {
                await this.bot.sendMessage(chatId, '❌ Keyword detector is not initialized. Please restart the bot.');
                return;
            }

            const keywords = this.keywordDetector.getKeywords();
            if (keywords.includes(keyword)) {
                const escapedKeyword = this.escapeHtml(keyword);
                await this.bot.sendMessage(chatId, `❌ Keyword "${escapedKeyword}" already exists.`);
                return;
            }

            await this.keywordDetector.addKeyword(keyword, userId.toString());
            const escapedKeyword = this.escapeHtml(keyword);
            await this.bot.sendMessage(chatId, `✅ Added global keyword: "${escapedKeyword}"`);
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
                await this.bot.sendMessage(chatId, '❌ Admin access required to remove global keywords.');
                return;
            }

            if (!this.keywordDetector) {
                await this.bot.sendMessage(chatId, '❌ Keyword detector is not initialized. Please restart the bot.');
                return;
            }

            const keywords = this.keywordDetector.getKeywords();
            if (!keywords.includes(keyword)) {
                const escapedKeyword = this.escapeHtml(keyword);
                await this.bot.sendMessage(chatId, `❌ Keyword "${escapedKeyword}" not found.`);
                return;
            }

            await this.keywordDetector.removeKeyword(keyword);
            const escapedKeyword = this.escapeHtml(keyword);
            await this.bot.sendMessage(chatId, `✅ Removed global keyword: "${escapedKeyword}"`);
            console.log(`🔑 Admin ${userId} removed keyword: ${keyword}`);
        });

        // My keywords command - Show user's personal keywords
        this.bot.onText(/\/mykeywords/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;

            // Prevent duplicate commands
            if (this.isDuplicateCommand(userId, 'mykeywords')) {
                console.log('🚫 Duplicate /mykeywords command ignored from:', msg.from.username || msg.from.first_name);
                return;
            }

            if (!this.authorization.isAuthorized(userId)) {
                await this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                return;
            }

            // Use keywordDetector's method which checks Supabase first
            const personalKeywords = await this.getPersonalKeywordsFromSupabase(userId);
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

            await this.bot.sendMessage(chatId, keywordsText, { parse_mode: 'HTML' });
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
                await this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                return;
            }

            if (keyword.length < 2) {
                await this.bot.sendMessage(chatId, '❌ Keyword must be at least 2 characters long.');
                return;
            }

            // Use keywordDetector's method which checks Supabase first
            const personalKeywords = await this.getPersonalKeywordsFromSupabase(userId);
            if (personalKeywords.includes(keyword)) {
                const escapedKeyword = this.escapeHtml(keyword);
                await this.bot.sendMessage(chatId, `❌ Personal keyword "${escapedKeyword}" already exists.`);
                return;
            }

            await this.addPersonalKeyword(userId, keyword);
            const escapedKeyword = this.escapeHtml(keyword);
            await this.bot.sendMessage(chatId, `✅ Added personal keyword: "${escapedKeyword}"`);
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
                await this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                return;
            }

            // Use keywordDetector's method which checks Supabase first
            const personalKeywords = await this.getPersonalKeywordsFromSupabase(userId);
            if (!personalKeywords.includes(keyword)) {
                const escapedKeyword = this.escapeHtml(keyword);
                await this.bot.sendMessage(chatId, `❌ Personal keyword "${escapedKeyword}" not found.`);
                return;
            }

            await this.removePersonalKeyword(userId, keyword);
            const escapedKeyword = this.escapeHtml(keyword);
            await this.bot.sendMessage(chatId, `✅ Removed personal keyword: "${escapedKeyword}"`);
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
            
            // Alert confirmation prompt
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
                '🔴 <b>Type "RESTART" to confirm and proceed</b>\n' +
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

        // /reminders command - show active reminders
        this.bot.onText(/\/reminders/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            console.log(`📨 Received /reminders from user ${userId} (chatId: ${chatId})`);
            
            try {
                if (!this.authorization.isAuthorized(userId)) {
                    await this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                    return;
                }

                if (this.isDuplicateCommand(userId, 'reminders')) {
                    console.log(`⚠️ Duplicate /reminders command from user ${userId} - ignoring`);
                    return;
                }

                const reminderManager = this.getReminderManager();
                if (!reminderManager) {
                    console.error(`❌ ReminderManager is null for user ${userId}`);
                    await this.bot.sendMessage(chatId, '❌ Reminder system is not available. Please contact an administrator.');
                    return;
                }

                try {
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
                        await this.bot.sendMessage(chatId, response);
                        console.log(`✅ Successfully sent reminder info to user ${userId}`);
                    } else {
                        await this.bot.sendMessage(chatId, 'ℹ️ No active reminders.');
                    }
                } catch (error) {
                    console.error(`❌ Error getting reminders for user ${userId}:`, error.message);
                    console.error('Stack trace:', error.stack);
                    await this.bot.sendMessage(chatId, '❌ Error retrieving reminder information. Check bot logs.');
                }
            } catch (error) {
                console.error(`❌ Unexpected error in /reminders command handler for user ${userId}:`, error.message);
                console.error('Stack trace:', error.stack);
                try {
                    await this.bot.sendMessage(chatId, '❌ An unexpected error occurred. Please try again or contact an administrator.');
                } catch (sendError) {
                    console.error(`❌ Failed to send error message to user ${userId}:`, sendError.message);
                }
            }
        });

        // Admin: reset all reminders
        this.bot.onText(/\/resetall/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;

            if (!this.authorization.isAdmin(userId)) {
                await this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }

            try {
                const reminderManager = this.getReminderManager();
                if (!reminderManager) {
                    await this.bot.sendMessage(chatId, '❌ Reminder system is not available.');
                    return;
                }
                await reminderManager.resetAllReminders();
                await this.bot.sendMessage(chatId, '🗑️ All reminders have been reset and storage cleared.');
            } catch (error) {
                console.error(`❌ Error in /resetall command:`, error);
                await this.bot.sendMessage(chatId, '❌ Failed to reset reminders. Check logs.');
            }
        });

        // Admin: anti-ban status
        this.bot.onText(/\/antiban/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;

            if (!this.authorization.isAdmin(userId)) {
                await this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }

            try {
                const WhatsAppAntiBan = require('./anti-ban');
                const antiBan = new WhatsAppAntiBan();
                const checklist = antiBan.getSafetyChecklist();
                const nonActive = antiBan.isNonActiveHours();

                let text = '🛡️ <b>Anti-Ban Status</b>\n\n';
                text += '📋 <b>Safety Checklist</b>\n';
                text += `• Dedicated phone: ${checklist.phoneNumber.dedicated ? '✅' : '❌'}\n`;
                text += `• Virtual number: ${checklist.phoneNumber.virtual ? '✅' : '❌'}\n`;
                text += `• Not personal: ${checklist.phoneNumber.notPersonal ? '✅' : '❌'}\n`;
                text += `• Verified: ${checklist.phoneNumber.verified ? '✅' : '❌'}\n\n`;
                text += `• No spam: ${checklist.behavior.noSpam ? '✅' : '❌'}\n`;
                text += `• Human-like delays: ${checklist.behavior.humanLikeDelays ? '✅' : '❌'}\n`;
                text += `• Rate limited: ${checklist.behavior.rateLimited ? '✅' : '❌'}\n`;
                text += `• No automated replies: ${checklist.behavior.noAutomatedReplies ? '✅' : '❌'}\n\n`;
                text += `• Read-only monitoring: ${checklist.monitoring.readOnly ? '✅' : '❌'}\n`;
                text += `• No message sending: ${checklist.monitoring.noMessageSending ? '✅' : '❌'}\n\n`;
                text += '⏱️ <b>Non-Active Hours</b>\n';
                if (nonActive.isActive) {
                    text += '• Status: Active hours\n';
                } else {
                    const escapedScheduleName = this.escapeHtml(nonActive.schedule.name);
                    const escapedBehavior = this.escapeHtml(nonActive.behavior.toUpperCase());
                    text += `• Status: Sleeping (${escapedScheduleName})\n`;
                    text += `• Behavior: ${escapedBehavior}\n`;
                }

                await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
            } catch (error) {
                await this.bot.sendMessage(chatId, '❌ Failed to load anti-ban status.');
            }
        });

        // ============================================
        // ERROR HANDLERS FOR MALFORMED COMMANDS
        // ============================================

        // Handle commands with missing required parameters
        // /addkeyword without parameter
        this.bot.onText(/^\/addkeyword$/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            if (!this.authorization.isAdmin(userId)) {
                await this.bot.sendMessage(chatId, '❌ Admin access required to add global keywords.');
                return;
            }
            await this.bot.sendMessage(chatId, '❌ <b>Error: Missing parameter</b>\n\n' +
                'Usage: <code>/addkeyword &lt;word&gt;</code>\n\n' +
                'Example: <code>/addkeyword urgent</code>', { parse_mode: 'HTML' });
        });

        // /removekeyword without parameter
        this.bot.onText(/^\/removekeyword$/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            if (!this.authorization.isAdmin(userId)) {
                await this.bot.sendMessage(chatId, '❌ Admin access required to remove global keywords.');
                return;
            }
            await this.bot.sendMessage(chatId, '❌ <b>Error: Missing parameter</b>\n\n' +
                'Usage: <code>/removekeyword &lt;word&gt;</code>\n\n' +
                'Example: <code>/removekeyword urgent</code>', { parse_mode: 'HTML' });
        });

        // /addmykeyword without parameter
        this.bot.onText(/^\/addmykeyword$/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            if (!this.authorization.isAuthorized(userId)) {
                await this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                return;
            }
            await this.bot.sendMessage(chatId, '❌ <b>Error: Missing parameter</b>\n\n' +
                'Usage: <code>/addmykeyword &lt;word&gt;</code>\n\n' +
                'Example: <code>/addmykeyword test</code>', { parse_mode: 'HTML' });
        });

        // /removemykeyword without parameter
        this.bot.onText(/^\/removemykeyword$/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            if (!this.authorization.isAuthorized(userId)) {
                await this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                return;
            }
            await this.bot.sendMessage(chatId, '❌ <b>Error: Missing parameter</b>\n\n' +
                'Usage: <code>/removemykeyword &lt;word&gt;</code>\n\n' +
                'Example: <code>/removemykeyword test</code>', { parse_mode: 'HTML' });
        });

        // /approve without parameter
        this.bot.onText(/^\/approve$/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            if (!this.authorization.isAdmin(userId)) {
                await this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }
            await this.bot.sendMessage(chatId, '❌ <b>Error: Missing parameter</b>\n\n' +
                'Usage: <code>/approve &lt;user_id&gt;</code>\n\n' +
                'Use <code>/pending</code> to see pending requests.', { parse_mode: 'HTML' });
        });

        // /reject without parameter
        this.bot.onText(/^\/reject$/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            if (!this.authorization.isAdmin(userId)) {
                await this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }
            await this.bot.sendMessage(chatId, '❌ <b>Error: Missing parameter</b>\n\n' +
                'Usage: <code>/reject &lt;user_id&gt;</code>\n\n' +
                'Use <code>/pending</code> to see pending requests.', { parse_mode: 'HTML' });
        });

        // /remove without parameter
        this.bot.onText(/^\/remove$/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            if (!this.authorization.isAdmin(userId)) {
                await this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }
            await this.bot.sendMessage(chatId, '❌ <b>Error: Missing parameter</b>\n\n' +
                'Usage: <code>/remove &lt;user_id&gt;</code>\n\n' +
                'Example: <code>/remove 123456789</code>', { parse_mode: 'HTML' });
        });

        // /makeadmin without parameter
        this.bot.onText(/^\/makeadmin$/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            if (!this.authorization.isAdmin(userId)) {
                await this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }
            await this.bot.sendMessage(chatId, '❌ <b>Error: Missing parameter</b>\n\n' +
                'Usage: <code>/makeadmin &lt;user_id&gt;</code>\n\n' +
                'Example: <code>/makeadmin 123456789</code>', { parse_mode: 'HTML' });
        });

        // /setemail without parameter
        this.bot.onText(/^\/setemail$/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            if (!this.authorization.isAdmin(userId)) {
                await this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }
            await this.bot.sendMessage(chatId, '❌ <b>Error: Missing parameters</b>\n\n' +
                'Usage: <code>/setemail &lt;user_id&gt; &lt;email&gt;</code>\n\n' +
                'Example: <code>/setemail 123456789 user@example.com</code>', { parse_mode: 'HTML' });
        });

        // /removeemail without parameter
        this.bot.onText(/^\/removeemail$/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            if (!this.authorization.isAdmin(userId)) {
                await this.bot.sendMessage(chatId, '❌ Admin access required.');
                return;
            }
            await this.bot.sendMessage(chatId, '❌ <b>Error: Missing parameters</b>\n\n' +
                'Usage: <code>/removeemail &lt;user_id&gt; &lt;email&gt;</code>\n\n' +
                'Example: <code>/removeemail 123456789 user@example.com</code>', { parse_mode: 'HTML' });
        });

        // /subscribe without parameter
        this.bot.onText(/^\/subscribe$/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            if (!this.authorization.isAuthorized(userId)) {
                await this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                return;
            }
            await this.bot.sendMessage(chatId, '❌ <b>Error: Missing parameter</b>\n\n' +
                'Usage: <code>/subscribe &lt;group_name&gt;</code>\n\n' +
                'Use <code>/allgroups</code> to see available groups.', { parse_mode: 'HTML' });
        });

        // /unsubscribe without parameter
        this.bot.onText(/^\/unsubscribe$/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            if (!this.authorization.isAuthorized(userId)) {
                await this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                return;
            }
            await this.bot.sendMessage(chatId, '❌ <b>Error: Missing parameter</b>\n\n' +
                'Usage: <code>/unsubscribe &lt;group_name&gt;</code>\n\n' +
                'Use <code>/mygroups</code> to see your subscribed groups.', { parse_mode: 'HTML' });
        });

        // /timezone without parameter
        this.bot.onText(/^\/timezone$/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            if (!this.authorization.isAuthorized(userId)) {
                await this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                return;
            }
            await this.bot.sendMessage(chatId, '❌ <b>Error: Missing parameter</b>\n\n' +
                'Usage: <code>/timezone &lt;tz&gt;</code>\n\n' +
                'Example: <code>/timezone America/New_York</code>\n\n' +
                'Or use shortcuts: /israel, /usa, /uk, /japan', { parse_mode: 'HTML' });
        });

        // Catch-all handler for unrecognized commands (typos, unknown commands)
        // This MUST be last to catch anything that doesn't match above patterns
        this.bot.onText(/^\/(.+)$/, async (msg, match) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const command = match[1].trim();
            
            // Skip if this is a restart confirmation check (already handled above)
            if (this.pendingRestartConfirmations && this.pendingRestartConfirmations.has(userId)) {
                return;
            }
            
            // Skip if this is a removal confirmation check (already handled above)
            if (this.pendingRemovalConfirmations && this.pendingRemovalConfirmations.has(userId)) {
                return;
            }
            
            // Check if user is authorized (for better error message)
            if (!this.authorization.isAuthorized(userId)) {
                await this.bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                return;
            }
            
            const escapedCommand = this.escapeHtml(command);
            
            // Provide helpful suggestions for common typos
            const suggestions = [];
            if (command.toLowerCase().includes('removemykeword') || command.toLowerCase().includes('removemykewyrd')) {
                suggestions.push('💡 Did you mean <code>/removemykeyword</code>?');
            } else if (command.toLowerCase().includes('addmykeword') || command.toLowerCase().includes('addmykewyrd')) {
                suggestions.push('💡 Did you mean <code>/addmykeyword</code>?');
            } else if (command.toLowerCase().includes('addkeword') || command.toLowerCase().includes('addkewyrd')) {
                suggestions.push('💡 Did you mean <code>/addkeyword</code>?');
            } else if (command.toLowerCase().includes('removekeword') || command.toLowerCase().includes('removekewyrd')) {
                suggestions.push('💡 Did you mean <code>/removekeyword</code>?');
            }
            
            let errorMessage = `❌ <b>Unrecognized command:</b> <code>/${escapedCommand}</code>\n\n`;
            errorMessage += 'Use <code>/help</code> to see all available commands.\n';
            if (this.authorization.isAdmin(userId)) {
                errorMessage += 'Use <code>/admin</code> to see admin-only commands.\n';
            }
            
            if (suggestions.length > 0) {
                errorMessage += '\n' + suggestions.join('\n');
            }
            
            await this.bot.sendMessage(chatId, errorMessage, { parse_mode: 'HTML' });
            console.log(`⚠️ Unrecognized command from user ${userId}: /${command}`);
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

    // Load group subscriptions from Supabase first, fallback to file
    async loadGroupSubscriptions() {
        try {
            // Try Supabase first if enabled
            if (this.keywordDetector && this.keywordDetector.supabase && this.keywordDetector.supabase.isEnabled()) {
                try {
                    const subscriptions = await this.keywordDetector.supabase.getGroupSubscriptions();
                    if (subscriptions !== null) {
                        console.log('📊 Loaded group subscriptions from Supabase');
                        return subscriptions;
                    }
                } catch (error) {
                    console.warn('⚠️ Failed to load group subscriptions from Supabase, falling back to file:', error.message);
                }
            }
            
            // Fallback to file-based config
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

    // Save group subscriptions to file (backup)
    async saveGroupSubscriptions(subscriptions) {
        try {
            // Save to file first (backup)
            const fs = require('fs');
            const path = require('path');
            const subscriptionsPath = path.join(__dirname, '../config/group-subscriptions.json');
            
            fs.writeFileSync(subscriptionsPath, JSON.stringify(subscriptions, null, 2));
            console.log('✅ Group subscriptions saved to file');
            
            // Note: Supabase operations are handled individually via add/remove methods for better consistency
        } catch (error) {
            console.error('Error saving group subscriptions:', error.message);
        }
    }

    // Get user's timezone preference from Supabase first, fallback to file
    async getUserTimezone(chatId) {
        try {
            // Try Supabase first if enabled
            if (this.keywordDetector && this.keywordDetector.supabase && this.keywordDetector.supabase.isEnabled()) {
                try {
                    const prefs = await this.keywordDetector.supabase.getUserPreferences(chatId.toString());
                    if (prefs && prefs.timezone) {
                        console.log(`📊 Loaded timezone preference from Supabase for user ${chatId}: ${prefs.timezone}`);
                        return prefs.timezone;
                    } else if (prefs !== null) {
                        // Supabase returned data but no timezone preference
                        return 'Asia/Jerusalem'; // Default to Israeli time
                    }
                } catch (error) {
                    console.warn(`⚠️ Failed to load timezone preference from Supabase for user ${chatId}, falling back to file:`, error.message);
                }
            }
            
            // Fallback to file-based config
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
        bot.onText(/\/ok/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            console.log(`📨 Received /ok from user ${userId} (chatId: ${chatId})`);
            
            try {
            if (!this.authorization.isAuthorized(userId)) {
                    await bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                return;
            }

            if (this.isDuplicateCommand(userId, 'ok')) {
                    console.log(`⚠️ Duplicate /ok command from user ${userId} - ignoring`);
                return;
            }

                // Get reminder manager with error handling
            const reminderManager = this.getReminderManager();
                if (!reminderManager) {
                    console.error(`❌ ReminderManager is null for user ${userId}`);
                    await bot.sendMessage(chatId, '❌ Reminder system is not available. Please contact an administrator.');
                    return;
                }

                // Acknowledge reminder with error handling
                let result;
                try {
                    result = await reminderManager.acknowledgeReminder(userId);
                    console.log(`✅ Successfully acknowledged reminders for user ${userId}`);
                } catch (error) {
                    console.error(`❌ Error acknowledging reminder for user ${userId}:`, error.message);
                    console.error('Stack trace:', error.stack);
                    await bot.sendMessage(chatId, '❌ Error processing reminder acknowledgment. Check bot logs.');
                    return;
                }

                // Validate result before sending
                if (!result || !result.summary) {
                    console.error(`❌ Invalid result from acknowledgeReminder for user ${userId}:`, result);
                    await bot.sendMessage(chatId, '❌ Error: Invalid reminder data received.');
                    return;
                }

                // Send summary message with error handling
                try {
                    await bot.sendMessage(chatId, result.summary, { parse_mode: 'HTML' });
                    console.log(`✅ Successfully sent reminder summary to user ${userId}`);
                } catch (error) {
                    console.error(`❌ Failed to send reminder summary to user ${userId}:`, error.message);
                    // Don't throw - acknowledgement was successful, just couldn't send message
                    // User can check /reminders command if needed
                }
            } catch (error) {
                console.error(`❌ Unexpected error in /ok command handler for user ${userId}:`, error.message);
                console.error('Stack trace:', error.stack);
                try {
                    await bot.sendMessage(chatId, '❌ An unexpected error occurred. Please try again or contact an administrator.');
                } catch (sendError) {
                    console.error(`❌ Failed to send error message to user ${userId}:`, sendError.message);
                }
            }
        });

        // /reminders command - show active reminders
        bot.onText(/\/reminders/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            console.log(`📨 Received /reminders from user ${userId} (chatId: ${chatId})`);
            
            try {
            if (!this.authorization.isAuthorized(userId)) {
                    await bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
                return;
            }

            if (this.isDuplicateCommand(userId, 'reminders')) {
                    console.log(`⚠️ Duplicate /reminders command from user ${userId} - ignoring`);
                return;
            }

            const reminderManager = this.getReminderManager();
                if (!reminderManager) {
                    console.error(`❌ ReminderManager is null for user ${userId}`);
                    await bot.sendMessage(chatId, '❌ Reminder system is not available. Please contact an administrator.');
                    return;
                }

                try {
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
                        await bot.sendMessage(chatId, response);
                        console.log(`✅ Successfully sent reminder info to user ${userId}`);
                } else {
                        await bot.sendMessage(chatId, 'ℹ️ No active reminders.');
                    }
                } catch (error) {
                    console.error(`❌ Error getting reminders for user ${userId}:`, error.message);
                    console.error('Stack trace:', error.stack);
                    await bot.sendMessage(chatId, '❌ Error retrieving reminder information. Check bot logs.');
                }
            } catch (error) {
                console.error(`❌ Unexpected error in /reminders command handler for user ${userId}:`, error.message);
                console.error('Stack trace:', error.stack);
                try {
                    await bot.sendMessage(chatId, '❌ An unexpected error occurred. Please try again or contact an administrator.');
                } catch (sendError) {
                    console.error(`❌ Failed to send error message to user ${userId}:`, sendError.message);
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

    async updateTimezone(chatId, timezone) {
        try {
            // Save to Supabase first if enabled
            if (this.keywordDetector && this.keywordDetector.supabase && this.keywordDetector.supabase.isEnabled()) {
                try {
                    const success = await this.keywordDetector.supabase.setUserPreferences(chatId.toString(), { timezone });
                    if (success) {
                        console.log(`💾 Saved timezone preference to Supabase for user ${chatId}: ${timezone}`);
                    }
                } catch (error) {
                    console.error('Error saving timezone preference to Supabase:', error.message);
                }
            }
            
            // Also save to file (backup and backward compatibility)
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
            
            await this.bot.sendMessage(chatId,
                `🌍 Your timezone changed to: ${displayName}\n\n` +
                `✅ No restart needed! Changes take effect immediately.\n\n` +
                `💡 Each user can have their own timezone preference.\n` +
                `Use /sleep to check your personal sleep status.`
            );
        } catch (error) {
            try {
                await this.bot.sendMessage(chatId, '❌ Error updating timezone. Check bot logs.');
            } catch (sendError) {
                console.error('Failed to send error message:', sendError.message);
            }
        }
    }

    formatTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (seconds < 60) {
            return 'Just now';
        } else if (minutes < 60) {
            return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
        } else if (hours < 24) {
            return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        } else {
            return `${days} day${days !== 1 ? 's' : ''} ago`;
        }
    }

    async notifyAdmins(message) {
        // Send notification to all admin users
        const adminUsers = this.authorization.getAdminUsers();
        
        if (!adminUsers || adminUsers.length === 0) {
            console.warn('⚠️ No admin users found! Cannot send admin notification.');
            console.log('📢 Admin notification (logged only):', message);
            return;
        }
        
        console.log(`📢 Sending admin notification to ${adminUsers.length} admin(s):`, message);
        
        // Send to all admins asynchronously
        const sendPromises = adminUsers.map(async (adminId) => {
            try {
                await this.bot.sendMessage(adminId, message);
                console.log(`✅ Admin notification sent to admin ${adminId}`);
            } catch (error) {
                console.error(`❌ Failed to send admin notification to admin ${adminId}:`, error.message);
            }
        });
        
        // Wait for all notifications to be sent (or fail)
        await Promise.allSettled(sendPromises);
    }

    // Personal keyword management methods
    // Helper method that uses keywordDetector's Supabase-aware method
    async getPersonalKeywordsFromSupabase(userId) {
        try {
            if (this.keywordDetector) {
                // Use keywordDetector's method which checks Supabase first, then file
                return await this.keywordDetector.getPersonalKeywords(userId);
            }
            // Fallback to file if keywordDetector not available
            return this.getPersonalKeywords(userId);
        } catch (error) {
            console.error('Error loading personal keywords from Supabase:', error.message);
            // Fallback to file
            return this.getPersonalKeywords(userId);
        }
    }

    // Legacy file-based method (kept for backward compatibility and fallback)
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
            console.error('Error loading personal keywords from file:', error.message);
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