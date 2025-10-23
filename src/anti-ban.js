/**
 * WhatsApp Anti-Ban Best Practices
 * Guidelines and configurations to avoid automatic bans
 */

class WhatsAppAntiBan {
    constructor() {
        this.config = {
            // Message rate limiting
            maxMessagesPerMinute: 10,
            maxMessagesPerHour: 50,
            maxMessagesPerDay: 200,
            
            // Connection behavior
            connectionDelay: 5000, // 5 seconds between connections
            reconnectDelay: 30000, // 30 seconds between reconnects
            maxReconnectAttempts: 5,
            
            // Activity patterns
            humanLikeBehavior: true,
            randomDelayMin: 1000, // 1 second
            randomDelayMax: 5000, // 5 seconds
            
            // Session management
            sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
            qrTimeout: 60000, // 1 minute
            
            // Monitoring limits
            maxGroupsPerAccount: 20,
            maxContactsPerAccount: 100,
            
            // Safety measures
            enableReadReceipts: false,
            enableTypingIndicator: false,
            enablePresenceUpdates: false
        };
        
        this.stats = {
            messagesSent: 0,
            lastMessageTime: null,
            connectionCount: 0,
            lastConnectionTime: null
        };
    }

    // Rate limiting for messages
    canSendMessage() {
        const now = Date.now();
        const oneMinute = 60 * 1000;
        const oneHour = 60 * 60 * 1000;
        const oneDay = 24 * 60 * 60 * 1000;

        // Reset counters if needed
        if (!this.stats.lastMessageTime || (now - this.stats.lastMessageTime) > oneDay) {
            this.stats.messagesSent = 0;
            this.stats.lastMessageTime = now;
        }

        // Check rate limits
        const timeSinceLastMessage = now - (this.stats.lastMessageTime || 0);
        
        if (timeSinceLastMessage < oneMinute && this.stats.messagesSent >= this.config.maxMessagesPerMinute) {
            return false;
        }
        
        if (timeSinceLastMessage < oneHour && this.stats.messagesSent >= this.config.maxMessagesPerHour) {
            return false;
        }
        
        if (this.stats.messagesSent >= this.config.maxMessagesPerDay) {
            return false;
        }

        return true;
    }

    // Human-like delays
    async humanLikeDelay() {
        if (!this.config.humanLikeBehavior) return;
        
        const delay = Math.random() * (this.config.randomDelayMax - this.config.randomDelayMin) + this.config.randomDelayMin;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Connection rate limiting
    canConnect() {
        const now = Date.now();
        const timeSinceLastConnection = now - (this.stats.lastConnectionTime || 0);
        
        if (timeSinceLastConnection < this.config.connectionDelay) {
            return false;
        }
        
        this.stats.lastConnectionTime = now;
        this.stats.connectionCount++;
        
        return true;
    }

    // Get recommended session settings
    getSessionConfig() {
        return {
            // Baileys configuration for safety
            browser: ['WhatsApp Bot', 'Chrome', '1.0.0'],
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            retryRequestDelayMs: 250,
            
            // Disable features that might trigger bans
            printQRInTerminal: false, // Use custom QR handling
            defaultQueryTimeoutMs: 60000,
            
            // Connection settings
            markOnlineOnConnect: false,
            syncFullHistory: false,
            
            // Message settings
            generateHighQualityLinkPreview: false,
            getMessage: async (key) => {
                // Custom message handling
                return null;
            }
        };
    }

    // Safety checklist
    getSafetyChecklist() {
        return {
            phoneNumber: {
                dedicated: true,
                virtual: true,
                notPersonal: true,
                verified: true
            },
            behavior: {
                noSpam: true,
                humanLikeDelays: true,
                rateLimited: true,
                noAutomatedReplies: true
            },
            monitoring: {
                readOnly: true,
                noMessageSending: true,
                noGroupCreation: true,
                noContactAddition: true
            },
            session: {
                persistent: true,
                secure: true,
                isolated: true,
                backup: true
            }
        };
    }

    // Log safety metrics
    logSafetyMetrics() {
        console.log('🛡️ WhatsApp Anti-Ban Metrics:');
        console.log(`📊 Messages sent today: ${this.stats.messagesSent}/${this.config.maxMessagesPerDay}`);
        console.log(`🔗 Connections made: ${this.stats.connectionCount}`);
        console.log(`⏰ Last message: ${this.stats.lastMessageTime ? new Date(this.stats.lastMessageTime).toLocaleString() : 'Never'}`);
        console.log(`✅ Rate limiting: ${this.canSendMessage() ? 'OK' : 'BLOCKED'}`);
    }
}

module.exports = WhatsAppAntiBan;
