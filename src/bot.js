require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

// Import our modules
const WhatsAppConnection = require('./whatsapp');
const KeywordDetector = require('./keywordDetector');
const Notifier = require('./notifier');
const KeepAliveService = require('./keep-alive');
const TelegramCommandHandler = require('./telegram-commands');
const { logger, logKeywordDetection, logBotEvent, logError } = require('./logger');
const requireAuth = require('./middleware/auth');

class WhatsAppKeywordBot {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        
        // Validate environment variables
        this.validateEnvironment();
        
        this.keywordDetector = new KeywordDetector();
        
        // Wait for async config loading to complete
        this.keywordDetector.loadConfig().then(() => {
            console.log('✅ Keywords loaded and ready');
        }).catch(err => {
            console.error('❌ Failed to load keywords:', err);
        });
        this.notifier = new Notifier();
        this.connections = new Map(); // Store multiple WhatsApp connections
        this.keepAlive = new KeepAliveService(); // Anti-sleep mechanism
        this.commandHandler = null; // Telegram command handler
        this.stats = {
            startTime: new Date(),
            messagesProcessed: 0,
            keywordsDetected: 0,
            notificationsSent: 0,
            errors: 0
        };

        this.loadMultiPhoneConfig();
        this.setupExpress();
        this.setupHealthMonitoring();
        this.start();
    }

    validateEnvironment() {
        const requiredVars = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
        const missing = requiredVars.filter(varName => !process.env[varName]);
        
        if (missing.length > 0) {
            console.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`);
            console.warn('📝 Please check your .env file configuration');
        }
    }

    loadMultiPhoneConfig() {
        try {
            const configPath = path.join(__dirname, '../config/multi-phone.json');
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            
            console.log(`📱 Loading ${config.phones.length} phone configurations...`);
            
            config.phones.forEach(phone => {
                if (phone.enabled) {
                    this.addPhone(phone.number, phone.sessionPath, phone.description);
                } else {
                    console.log(`⏸️  Phone ${phone.number} is disabled`);
                }
            });
            
            this.multiPhoneConfig = config;
        } catch (error) {
            console.error('❌ Failed to load multi-phone config:', error.message);
            console.log('🔄 Falling back to single phone mode...');
            this.addPhone('YOUR_PHONE_NUMBER_HERE', './sessions', 'Default phone');
        }
    }

    addPhone(phoneNumber, sessionPath, description = '') {
        try {
            const connection = new WhatsAppConnection(sessionPath);
            
            connection.on('message', (messageData) => {
                this.handleMessage(messageData, phoneNumber);
            });

            connection.on('connected', () => {
                console.log(`✅ Phone ${phoneNumber} connected successfully!`);
                logBotEvent('phone_connected', { phoneNumber, description });
            });

            connection.on('disconnected', () => {
                console.log(`❌ Phone ${phoneNumber} disconnected`);
                logBotEvent('phone_disconnected', { phoneNumber });
            });

            this.connections.set(phoneNumber, connection);
            console.log(`📱 Added phone ${phoneNumber} to monitoring (${description})`);
            
        } catch (error) {
            logError(error, { context: 'add_phone', phoneNumber });
            console.error(`❌ Failed to add phone ${phoneNumber}:`, error.message);
        }
    }

    setupExpress() {
        // Middleware
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.static('public'));
        
        // Simple rate limiting
        this.app.use((req, res, next) => {
            const now = Date.now();
            const windowMs = 60000; // 1 minute
            const maxRequests = 100; // 100 requests per minute
            
            if (!this.requestCounts) {
                this.requestCounts = new Map();
            }
            
            const clientIp = req.ip || req.connection.remoteAddress;
            const clientData = this.requestCounts.get(clientIp) || { count: 0, resetTime: now + windowMs };
            
            if (now > clientData.resetTime) {
                clientData.count = 0;
                clientData.resetTime = now + windowMs;
            }
            
            if (clientData.count >= maxRequests) {
                return res.status(429).json({ error: 'Too many requests' });
            }
            
            clientData.count++;
            this.requestCounts.set(clientIp, clientData);
            next();
        });

        // Health check endpoint
        this.app.get('/health', (req, res) => {
            const phoneStatus = {};
            for (const [phone, connection] of this.connections) {
                phoneStatus[phone] = connection.getConnectionStatus();
            }
            
            res.json({
                status: 'healthy',
                uptime: Date.now() - this.stats.startTime.getTime(),
                phones: phoneStatus,
                telegram: this.notifier.isEnabled(),
                stats: this.stats,
                timestamp: new Date().toISOString()
            });
        });

        // Stats endpoint (protected)
        this.app.get('/stats', requireAuth, (req, res) => {
            const phoneStatus = {};
            for (const [phone, connection] of this.connections) {
                phoneStatus[phone] = connection.getConnectionStatus();
            }
            
            res.json({
                stats: this.stats,
                keywords: this.keywordDetector.getKeywords(),
                phones: phoneStatus,
                config: {
                    keywordsEnabled: this.keywordDetector.isEnabled(),
                    telegramEnabled: this.notifier.isEnabled(),
                    totalPhones: this.connections.size,
                    enabledPhones: Array.from(this.connections.keys())
                }
            });
        });

        // Test notification endpoint (protected)
        this.app.post('/test-notification', requireAuth, async (req, res) => {
            try {
                const success = await this.notifier.sendTestMessage();
                res.json({ success, message: success ? 'Test notification sent' : 'Failed to send test notification' });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Reload keywords endpoint (protected)
        this.app.post('/reload-keywords', requireAuth, (req, res) => {
            try {
                this.keywordDetector.reloadConfig();
                res.json({ success: true, keywords: this.keywordDetector.getKeywords() });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Root endpoint
        this.app.get('/', (req, res) => {
            res.json({
                name: 'WhatsApp Keyword Bot',
                version: '1.0.0',
                status: 'running',
                endpoints: {
                    health: '/health',
                    stats: '/stats',
                    testNotification: 'POST /test-notification',
                    reloadKeywords: 'POST /reload-keywords'
                }
            });
        });
    }

    setupWhatsAppHandlers() {
        // Listen for WhatsApp messages
        this.whatsapp.on('message', (messageData) => {
            this.handleMessage(messageData);
        });

        // Handle WhatsApp connection events
        this.whatsapp.on('connected', () => {
            logBotEvent('bot_started');
            this.notifier.sendBotStatus('Connected', 'Bot is now monitoring WhatsApp messages');
        });

        this.whatsapp.on('disconnected', (disconnectInfo) => {
            logBotEvent('bot_disconnected', disconnectInfo);
            
            let statusMessage = 'Bot lost connection to WhatsApp';
            let details = '';
            
            if (disconnectInfo) {
                statusMessage = disconnectInfo.message || statusMessage;
                
                if (disconnectInfo.isVirtualNumberExpired) {
                    details = '🚨 VIRTUAL NUMBER MAY HAVE EXPIRED!\n\n' +
                             '📋 Action Required:\n' +
                             '1. Check virtual number status with provider\n' +
                             '2. Renew or get new virtual number\n' +
                             '3. Update bot configuration\n' +
                             '4. Restart bot and scan new QR code\n\n' +
                             '💡 Check logs for more details';
                    
                    // Send critical alert to ALL authorized users
                    this.notifier.sendCriticalAlert('Virtual Number Expired', details);
                } else {
                    details = `Disconnect reason: ${disconnectInfo.reason || 'Unknown'}`;
                    this.notifier.sendBotStatus('Disconnected', details);
                }
            } else {
                this.notifier.sendBotStatus('Disconnected', 'Bot lost connection to WhatsApp');
            }
        });
    }

    async handleMessage(messageData, phoneNumber) {
        try {
            // Validate message data - must have text OR attachment
            if (!messageData) {
                return;
            }

            // If no text and no attachment, skip
            if ((!messageData.text || typeof messageData.text !== 'string') && !messageData.attachment) {
                return;
            }

            // Get connection for anti-ban checks
            const connection = this.connections.get(phoneNumber);
            if (!connection) {
                console.warn(`⚠️ No connection found for phone: ${phoneNumber}`);
                return;
            }

            // Check if we should monitor this chat (group or private)
            if (!connection.shouldMonitorGroup(messageData.from)) {
                // Skip this message - chat not in monitored list
                return;
            }

            // Apply anti-ban rate limiting (even for read-only monitoring)
            if (!connection.antiBan.canSendMessage()) {
                console.log('⏳ Message processing rate limited for anti-ban protection');
                return;
            }

            // Track message processing for anti-ban statistics
            connection.antiBan.trackMessageProcessing();
            this.stats.messagesProcessed++;

            // Prepare text for keyword detection (combine text and file name if present)
            let textToSearch = messageData.text || '';
            
            // If there's an attachment with a filename, also search the filename for keywords
            if (messageData.attachment && messageData.attachment.filename) {
                // Combine filename with message text for keyword detection
                textToSearch = (textToSearch ? textToSearch + '\n' : '') + messageData.attachment.filename;
            }

            // Detect keywords in the message text and file name (global + personal for subscribed users only)
            const detectedKeywords = this.keywordDetector.detectKeywords(textToSearch, messageData.group);

            if (detectedKeywords.length > 0) {
                this.stats.keywordsDetected += detectedKeywords.length;

                // Separate global and personal keywords
                const globalKeywords = detectedKeywords.filter(k => k.type === 'global');
                const personalKeywords = detectedKeywords.filter(k => k.type === 'personal');

                // Send notifications for global keywords to ALL authorized users
                for (const keywordData of globalKeywords) {
                    try {
                        const success = await this.notifier.sendKeywordAlert(
                            keywordData.keyword,
                            messageData.text,
                            messageData.sender,
                            messageData.group,
                            messageData.id,
                            phoneNumber,
                            keywordData.matchType,
                            keywordData.token,
                            messageData.attachment,
                            false, // isReminder (first alert, not a reminder)
                            0 // reminderCount (first alert)
                        );

                        if (success) {
                            this.stats.notificationsSent++;
                            
                            // Start reminder system for global keywords for ALL authorized users
                            const authorizedUsers = this.notifier.authorization.getAuthorizedUsers();
                            
                            for (const userId of authorizedUsers) {
                                // Check if reminder already exists for this user
                                const existingReminder = this.notifier.reminderManager.getReminders(userId);
                                
                                // Skip if user recently pressed /ok (within last 60 seconds)
                                if (this.notifier.reminderManager.hasRecentlyAcknowledged(userId, 60)) {
                                    console.log(`⏰ User ${userId} recently pressed /ok - skipping reminder for keyword: "${keywordData.keyword}"`);
                                    continue;
                                }
                                
                                // Skip if user already acknowledged a reminder for this keyword
                                if (existingReminder && existingReminder.keyword === keywordData.keyword && existingReminder.status === 'acknowledged') {
                                    console.log(`⏰ User ${userId} already acknowledged reminder for keyword: "${keywordData.keyword}" - skipping`);
                                    continue;
                                }
                                
                                if (existingReminder && existingReminder.keyword === keywordData.keyword) {
                                    // Same keyword detected again - restart timer
                                    this.notifier.reminderManager.resetReminderForKeyword(
                                        userId,
                                        keywordData.keyword,
                                        messageData.text,
                                        messageData.sender,
                                        messageData.group,
                                        messageData.id,
                                        phoneNumber,
                                        messageData.attachment,
                                        true // isGlobal
                                    );
                                } else {
                                    // New reminder - mark as global keyword reminder
                                    this.notifier.reminderManager.addReminder(
                                        userId,
                                        keywordData.keyword,
                                        messageData.text,
                                        messageData.sender,
                                        messageData.group,
                                        messageData.id,
                                        phoneNumber,
                                        messageData.attachment,
                                        true // isGlobal
                                    );
                                }
                            }
                        }
                    } catch (notificationError) {
                        logError(notificationError, {
                            context: 'global_keyword_notification_error',
                            keyword: keywordData.keyword,
                            messageId: messageData.id,
                            phoneNumber
                        });
                    }
                }

                // Send notifications for personal keywords to SPECIFIC users
                for (const keywordData of personalKeywords) {
                    try {
                        const success = await this.notifier.sendPersonalKeywordAlert(
                            keywordData.keyword,
                            messageData.text,
                            messageData.sender,
                            messageData.group,
                            messageData.id,
                            phoneNumber,
                            keywordData.userId,
                            keywordData.matchType,
                            keywordData.token,
                            messageData.attachment
                        );

                        if (success) {
                            this.stats.notificationsSent++;
                            
                            // Start reminder system for personal keywords
                            // Check if reminder already exists for this user
                            const existingReminder = this.notifier.reminderManager.getReminders(keywordData.userId);
                            
                            // Skip if user recently pressed /ok (within last 60 seconds)
                            if (this.notifier.reminderManager.hasRecentlyAcknowledged(keywordData.userId, 60)) {
                                console.log(`⏰ User ${keywordData.userId} recently pressed /ok - skipping reminder for keyword: "${keywordData.keyword}"`);
                                continue;
                            }
                            
                            // Skip if user already acknowledged a reminder for this keyword
                            if (existingReminder && existingReminder.keyword === keywordData.keyword && existingReminder.acknowledged) {
                                console.log(`⏰ User ${keywordData.userId} already acknowledged reminder for keyword: "${keywordData.keyword}" - skipping`);
                                continue;
                            }
                            
                            // Only restart if reminder exists AND is not acknowledged
                            if (existingReminder && existingReminder.keyword === keywordData.keyword && !existingReminder.acknowledged) {
                                // Same keyword detected again - restart timer
                                this.notifier.reminderManager.resetReminderForKeyword(
                                    keywordData.userId,
                                    keywordData.keyword,
                                    messageData.text,
                                    messageData.sender,
                                    messageData.group,
                                    messageData.id,
                                    phoneNumber,
                                    messageData.attachment
                                );
                            } else {
                                // New reminder OR different keyword - add new reminder
                                this.notifier.reminderManager.addReminder(
                                    keywordData.userId,
                                    keywordData.keyword,
                                    messageData.text,
                                    messageData.sender,
                                    messageData.group,
                                    messageData.id,
                                    phoneNumber,
                                    messageData.attachment
                                );
                            }
                        }
                    } catch (notificationError) {
                        logError(notificationError, {
                            context: 'personal_keyword_notification_error',
                            keyword: keywordData.keyword,
                            userId: keywordData.userId,
                            messageId: messageData.id,
                            phoneNumber
                        });
                    }
                }

                console.log(`🚨 Keywords detected: Global: ${globalKeywords.length}, Personal: ${personalKeywords.length} from ${messageData.sender} in ${messageData.group} (via ${phoneNumber})`);
            }

        } catch (error) {
            this.stats.errors++;
            logError(error, {
                context: 'handle_message',
                messageId: messageData?.id,
                sender: messageData?.sender,
                phoneNumber
            });
        }
    }

    setupHealthMonitoring() {
        // Send periodic status updates
        setInterval(() => {
            const connectedPhones = Array.from(this.connections.entries())
                .filter(([phone, connection]) => connection.getConnectionStatus())
                .map(([phone]) => phone);
            
            if (connectedPhones.length > 0 && this.notifier.isEnabled()) {
                const uptime = Math.floor((Date.now() - this.stats.startTime.getTime()) / 1000 / 60); // minutes
                
                if (uptime % 60 === 0) { // Every hour
                    this.notifier.sendBotStatus('Running', 
                        `Uptime: ${uptime} minutes\nMessages: ${this.stats.messagesProcessed}\nKeywords: ${this.stats.keywordsDetected}\nConnected phones: ${connectedPhones.join(', ')}`
                    );
                }
            }
        }, 60000); // Check every minute

        // Anti-ban safety monitoring
        setInterval(() => {
            this.performAntiBanCheck();
        }, 30000); // Every 30 seconds
    }

    performAntiBanCheck() {
        try {
            console.log('🛡️ Anti-Ban Safety Check:');
            for (const [phoneNumber, connection] of this.connections) {
                // Skip placeholder phone numbers in anti-ban check
                if (phoneNumber && (
                    phoneNumber.includes('YOUR_') || 
                    phoneNumber.includes('PRIMARY') ||
                    phoneNumber.includes('PHONE_NUMBER')
                )) {
                    continue; // Skip placeholder, not a real connection yet
                }
                
                // Use actual WhatsApp phone if available, otherwise use config phone
                const actualPhone = connection.phoneNumber || phoneNumber;
                console.log(`📱 Phone ${actualPhone}:`);
                connection.antiBan.logSafetyMetrics();
                
                // Check if approaching rate limits
                if (connection.antiBan.isApproachingRateLimit()) {
                    console.warn(`⚠️ Phone ${phoneNumber} is approaching rate limits!`);
                }
            }
        } catch (error) {
            logError(error, { context: 'anti_ban_check' });
        }
    }

    start() {
        this.app.listen(this.port, '0.0.0.0', () => {
            console.log('🚀 WhatsApp Keyword Bot started!');
            console.log(`📊 Server running on port ${this.port}`);
            console.log(`🔗 Health check: http://localhost:${this.port}/health`);
            console.log(`📈 Stats: http://localhost:${this.port}/stats`);
            console.log('');
            console.log('📱 Waiting for WhatsApp connection...');
            console.log('💡 Make sure to set up your Telegram bot credentials in .env file');
            console.log('');

            // Start anti-sleep mechanism for Render free tier
            this.keepAlive.start();
            console.log('🔄 Anti-sleep mechanism activated');

            // Initialize Telegram command handler for authorization
            // IMPORTANT: Only create if not already exists to prevent 409 conflicts
            if (this.notifier.isEnabled()) {
                try {
                    // Check if command handler already exists
                    if (!this.commandHandler) {
                        console.log('🔐 Initializing Telegram command handler...');
                        this.commandHandler = new TelegramCommandHandler(
                            process.env.TELEGRAM_BOT_TOKEN,
                            this.notifier.authorization,
                            this.keywordDetector // Pass keywordDetector to command handler
                        );
                        // Inject reminder manager into command handler
                        if (this.commandHandler) {
                            this.commandHandler.reminderManager = this.notifier.reminderManager;
                        }
                        console.log('✅ Telegram authorization system activated');
                    } else {
                        console.log('⚠️ Telegram command handler already exists - skipping re-initialization');
                    }
                } catch (error) {
                    console.log('⚠️ Telegram command handler failed to initialize:', error.message);
                    console.log('📱 Notifications will still work, but commands are disabled');
                }
            }

            // Log stats periodically
            setInterval(() => {
                logBotEvent('stats_update', this.stats);
            }, 300000); // Every 5 minutes

            logBotEvent('server_started', { port: this.port });
        });

        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down bot...');
            this.keepAlive.stop();
            if (this.commandHandler) {
                this.commandHandler.stop(); // Stop Telegram polling
            }
            this.notifier.sendBotStatus('Shutting Down', 'Bot is being stopped');
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            console.log('\n🛑 Received SIGTERM, shutting down...');
            this.keepAlive.stop();
            if (this.commandHandler) {
                this.commandHandler.stop(); // Stop Telegram polling
            }
            this.notifier.sendBotStatus('Shutting Down', 'Bot received termination signal');
            process.exit(0);
        });
    }

    getStats() {
        return this.stats;
    }
}

// Start the bot
const bot = new WhatsAppKeywordBot();

module.exports = WhatsAppKeywordBot;
