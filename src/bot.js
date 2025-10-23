require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

// Import our modules
const WhatsAppConnection = require('./whatsapp');
const KeywordDetector = require('./keywordDetector');
const Notifier = require('./notifier');
const { logger, logKeywordDetection, logBotEvent, logError } = require('./logger');

class WhatsAppKeywordBot {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        
        // Validate environment variables
        this.validateEnvironment();
        
        this.keywordDetector = new KeywordDetector();
        this.notifier = new Notifier();
        this.connections = new Map(); // Store multiple WhatsApp connections
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
            this.addPhone('+972523784909', './sessions', 'Default phone');
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

        // Stats endpoint
        this.app.get('/stats', (req, res) => {
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

        // Test notification endpoint
        this.app.post('/test-notification', async (req, res) => {
            try {
                const success = await this.notifier.sendTestMessage();
                res.json({ success, message: success ? 'Test notification sent' : 'Failed to send test notification' });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Reload keywords endpoint
        this.app.post('/reload-keywords', (req, res) => {
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

        this.whatsapp.on('disconnected', () => {
            logBotEvent('bot_disconnected');
            this.notifier.sendBotStatus('Disconnected', 'Bot lost connection to WhatsApp');
        });
    }

    async handleMessage(messageData, phoneNumber) {
        try {
            // Validate message data
            if (!messageData || !messageData.text || typeof messageData.text !== 'string') {
                return;
            }

            this.stats.messagesProcessed++;

            // Detect keywords in the message
            const detectedKeywords = this.keywordDetector.detectKeywords(messageData.text);

            if (detectedKeywords.length > 0) {
                this.stats.keywordsDetected += detectedKeywords.length;

                // Log the detection
                logKeywordDetection(
                    detectedKeywords.join(', '),
                    messageData.text,
                    messageData.sender,
                    messageData.group,
                    phoneNumber
                );

                // Send notifications for each detected keyword
                for (const keyword of detectedKeywords) {
                    try {
                        const success = await this.notifier.sendKeywordAlert(
                            keyword,
                            messageData.text,
                            messageData.sender,
                            messageData.group,
                            messageData.id,
                            phoneNumber
                        );

                        if (success) {
                            this.stats.notificationsSent++;
                        }
                    } catch (notificationError) {
                        logError(notificationError, {
                            context: 'notification_error',
                            keyword,
                            messageId: messageData.id,
                            phoneNumber
                        });
                    }
                }

                console.log(`🚨 Keyword detected: "${detectedKeywords.join(', ')}" from ${messageData.sender} in ${messageData.group} (via ${phoneNumber})`);
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

        // Log stats periodically
        setInterval(() => {
            logBotEvent('stats_update', this.stats);
        }, 300000); // Every 5 minutes
    }

    start() {
        this.app.listen(this.port, () => {
            console.log('🚀 WhatsApp Keyword Bot started!');
            console.log(`📊 Server running on port ${this.port}`);
            console.log(`🔗 Health check: http://localhost:${this.port}/health`);
            console.log(`📈 Stats: http://localhost:${this.port}/stats`);
            console.log('');
            console.log('📱 Waiting for WhatsApp connection...');
            console.log('💡 Make sure to set up your Telegram bot credentials in .env file');
            console.log('');

            logBotEvent('server_started', { port: this.port });
        });

        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down bot...');
            this.notifier.sendBotStatus('Shutting Down', 'Bot is being stopped');
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            console.log('\n🛑 Received SIGTERM, shutting down...');
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
