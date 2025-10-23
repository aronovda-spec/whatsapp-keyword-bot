// Multi-phone WhatsApp bot architecture
const WhatsAppConnection = require('./whatsapp');
const KeywordDetector = require('./keywordDetector');
const Notifier = require('./notifier');

class MultiPhoneWhatsAppBot {
    constructor() {
        this.connections = new Map(); // Store multiple WhatsApp connections
        this.keywordDetector = new KeywordDetector();
        this.notifier = new Notifier();
        this.stats = {
            startTime: new Date(),
            messagesProcessed: 0,
            keywordsDetected: 0,
            notificationsSent: 0,
            errors: 0
        };
    }

    // Add a new phone number to monitor
    addPhone(phoneNumber, sessionPath) {
        const connection = new WhatsAppConnection(sessionPath);
        
        connection.on('message', (messageData) => {
            this.handleMessage(messageData, phoneNumber);
        });

        connection.on('connected', () => {
            console.log(`✅ Phone ${phoneNumber} connected successfully!`);
        });

        connection.on('disconnected', () => {
            console.log(`❌ Phone ${phoneNumber} disconnected`);
        });

        this.connections.set(phoneNumber, connection);
        console.log(`📱 Added phone ${phoneNumber} to monitoring`);
    }

    // Handle messages from any connected phone
    async handleMessage(messageData, phoneNumber) {
        try {
            this.stats.messagesProcessed++;

            const detectedKeywords = this.keywordDetector.detectKeywords(messageData.text);

            if (detectedKeywords.length > 0) {
                this.stats.keywordsDetected += detectedKeywords.length;

                // Send notification with phone number info
                for (const keyword of detectedKeywords) {
                    const success = await this.notifier.sendKeywordAlert(
                        keyword,
                        messageData.text,
                        messageData.sender,
                        messageData.group,
                        messageData.id,
                        phoneNumber // Include which phone detected it
                    );

                    if (success) {
                        this.stats.notificationsSent++;
                    }
                }

                console.log(`🚨 Keyword "${detectedKeywords.join(', ')}" detected from phone ${phoneNumber}`);
            }
        } catch (error) {
            this.stats.errors++;
            console.error(`Error processing message from ${phoneNumber}:`, error);
        }
    }

    // Get status of all connected phones
    getStatus() {
        const status = {};
        for (const [phone, connection] of this.connections) {
            status[phone] = {
                connected: connection.getConnectionStatus(),
                lastSeen: connection.lastSeen || 'Unknown'
            };
        }
        return status;
    }
}

module.exports = MultiPhoneWhatsAppBot;
