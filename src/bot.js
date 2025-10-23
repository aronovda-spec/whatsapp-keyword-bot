require('dotenv').config();
const express = require('express');
const path = require('path');

// Import our modules
const WhatsAppConnection = require('./whatsapp');
const KeywordDetector = require('./keywordDetector');
const Notifier = require('./notifier');
const { logger, logKeywordDetection, logBotEvent, logError } = require('./logger');

class WhatsAppKeywordBot {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.keywordDetector = new KeywordDetector();
        this.notifier = new Notifier();
        this.whatsapp = new WhatsAppConnection();
        this.stats = {
            startTime: new Date(),
            messagesProcessed: 0,
            keywordsDetected: 0,
            notificationsSent: 0,
            errors: 0
        };

        this.setupExpress();
        this.setupWhatsAppHandlers();
        this.setupHealthMonitoring();
        this.start();
    }

    setupExpress() {
        // Middleware
        this.app.use(express.json());
        this.app.use(express.static('public'));

        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                uptime: Date.now() - this.stats.startTime.getTime(),
                whatsapp: this.whatsapp.isConnected(),
                telegram: this.notifier.isEnabled(),
                stats: this.stats,
                timestamp: new Date().toISOString()
            });
        });

        // Stats endpoint
        this.app.get('/stats', (req, res) => {
            res.json({
                stats: this.stats,
                keywords: this.keywordDetector.getKeywords(),
                config: {
                    keywordsEnabled: this.keywordDetector.isEnabled(),
                    telegramEnabled: this.notifier.isEnabled(),
                    whatsappConnected: this.whatsapp.isConnected()
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

    async handleMessage(messageData) {
        try {
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
                    messageData.group
                );

                // Send notifications for each detected keyword
                for (const keyword of detectedKeywords) {
                    const success = await this.notifier.sendKeywordAlert(
                        keyword,
                        messageData.text,
                        messageData.sender,
                        messageData.group,
                        messageData.id
                    );

                    if (success) {
                        this.stats.notificationsSent++;
                    }
                }

                console.log(`🚨 Keyword detected: "${detectedKeywords.join(', ')}" from ${messageData.sender} in ${messageData.group}`);
            }

        } catch (error) {
            this.stats.errors++;
            logError(error, {
                context: 'handle_message',
                messageId: messageData.id,
                sender: messageData.sender
            });
        }
    }

    setupHealthMonitoring() {
        // Send periodic status updates
        setInterval(() => {
            if (this.whatsapp.isConnected() && this.notifier.isEnabled()) {
                const uptime = Math.floor((Date.now() - this.stats.startTime.getTime()) / 1000 / 60); // minutes
                
                if (uptime % 60 === 0) { // Every hour
                    this.notifier.sendBotStatus('Running', 
                        `Uptime: ${uptime} minutes\nMessages: ${this.stats.messagesProcessed}\nKeywords: ${this.stats.keywordsDetected}`
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
