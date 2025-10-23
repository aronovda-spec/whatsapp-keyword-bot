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
            enablePresenceUpdates: false,
            
            // Non-active hours configuration
            nonActiveHours: {
                enabled: true,
                timezone: 'Asia/Jerusalem', // Israeli timezone
                schedules: [
                    {
                        name: 'Night Sleep (Israeli Time)',
                        start: '01:00', // 1 AM Israeli time
                        end: '06:00',   // 6 AM Israeli time
                        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
                        enabled: true,
                        behavior: 'sleep' // Options: 'sleep', 'reduced', 'offline'
                    },
                    {
                        name: 'Weekend Break (Optional)',
                        start: '00:00', // All day
                        end: '23:59',  // All day
                        days: ['saturday', 'sunday'],
                        enabled: false, // Disabled by default
                        behavior: 'reduced'
                    }
                ]
            }
        };
        
        this.stats = {
            messagesSent: 0,
            lastMessageTime: null,
            connectionCount: 0,
            lastConnectionTime: null
        };
    }

    // Check if currently in non-active hours
    isNonActiveHours() {
        if (!this.config.nonActiveHours.enabled) {
            return { isActive: true };
        }

        const now = new Date();
        const israeliTime = new Date(now.toLocaleString("en-US", {timeZone: this.config.nonActiveHours.timezone}));
        const currentTime = israeliTime.toTimeString().substring(0, 5); // HH:MM format
        const currentDay = israeliTime.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

        for (const schedule of this.config.nonActiveHours.schedules) {
            if (!schedule.enabled) continue;
            if (!schedule.days.includes(currentDay)) continue;

            if (this.isTimeInRange(currentTime, schedule.start, schedule.end)) {
                return {
                    isActive: false,
                    schedule: schedule,
                    currentTime: currentTime,
                    behavior: schedule.behavior
                };
            }
        }

        return { isActive: true };
    }

    // Helper function to check if time is in range
    isTimeInRange(currentTime, startTime, endTime) {
        const current = this.timeToMinutes(currentTime);
        const start = this.timeToMinutes(startTime);
        const end = this.timeToMinutes(endTime);

        if (start <= end) {
            // Same day range (e.g., 01:00 to 06:00)
            return current >= start && current <= end;
        } else {
            // Overnight range (e.g., 23:00 to 07:00)
            return current >= start || current <= end;
        }
    }

    // Convert time string to minutes for comparison
    timeToMinutes(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }

    // Rate limiting for messages (enhanced with non-active hours)
    canSendMessage() {
        // Check non-active hours first
        const nonActiveStatus = this.isNonActiveHours();
        if (!nonActiveStatus.isActive) {
            console.log(`😴 Non-active hours: ${nonActiveStatus.schedule.name} (${nonActiveStatus.currentTime}) - ${nonActiveStatus.behavior} mode`);
            
            if (nonActiveStatus.behavior === 'sleep') {
                return false; // Complete sleep mode
            } else if (nonActiveStatus.behavior === 'reduced') {
                // Reduced activity - allow only 20% of normal rate
                const reducedLimit = Math.floor(this.config.maxMessagesPerMinute * 0.2);
                if (this.stats.messagesSent >= reducedLimit) {
                    return false;
                }
            }
        }
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

    // Enhanced safety measures
    getEnhancedSessionConfig() {
        return {
            // Baileys configuration for maximum safety
            browser: ['WhatsApp Bot', 'Chrome', '1.0.0'],
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            retryRequestDelayMs: 250,
            
            // Disable ALL features that might trigger bans
            printQRInTerminal: false,
            defaultQueryTimeoutMs: 60000,
            
            // Connection settings - MAXIMUM STEALTH
            markOnlineOnConnect: false,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            
            // Message settings - READ ONLY
            generateHighQualityLinkPreview: false,
            getMessage: async (key) => null,
            
            // Additional safety measures
            shouldIgnoreJid: (jid) => {
                // Ignore certain types of messages to reduce activity
                return false; // Process all messages but with rate limiting
            },
            
            // Connection behavior
            connectionOptions: {
                maxMsgRetryCount: 1,
                msgRetryCounterCache: new Map(),
                linkPreviewImageThumbnailWidth: 192,
                transactionOpts: {
                    maxCommitRetries: 1,
                    delayBetweenTriesMs: 3000
                }
            }
        };
    }

    // Get recommended session settings (backward compatibility)
    getSessionConfig() {
        return this.getEnhancedSessionConfig();
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

    // Additional safety methods
    async applySafetyDelay() {
        // Random delay between 2-8 seconds for human-like behavior
        const delay = Math.random() * 6000 + 2000; // 2-8 seconds
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Track message processing for rate limiting
    trackMessageProcessing() {
        this.stats.messagesSent++;
        this.stats.lastMessageTime = Date.now();
    }

    // Check if we're approaching rate limits
    isApproachingRateLimit() {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        const timeSinceLastMessage = now - (this.stats.lastMessageTime || 0);
        
        // If we've processed more than 80% of hourly limit in the last hour
        return timeSinceLastMessage < oneHour && 
               this.stats.messagesSent >= (this.config.maxMessagesPerHour * 0.8);
    }

    // Get current safety status (enhanced with non-active hours)
    getSafetyStatus() {
        const nonActiveStatus = this.isNonActiveHours();
        
        return {
            canProcessMessage: this.canSendMessage(),
            canConnect: this.canConnect(),
            approachingRateLimit: this.isApproachingRateLimit(),
            messagesProcessed: this.stats.messagesSent,
            connectionsMade: this.stats.connectionCount,
            lastActivity: this.stats.lastMessageTime,
            nonActiveHours: nonActiveStatus,
            currentTimezone: this.config.nonActiveHours.timezone,
            israeliTime: nonActiveStatus.isActive ? 
                new Date().toLocaleString("en-US", {timeZone: this.config.nonActiveHours.timezone}) : 
                'Active hours'
        };
    }

    // Log safety metrics (enhanced with non-active hours)
    logSafetyMetrics() {
        const nonActiveStatus = this.isNonActiveHours();
        const israeliTime = new Date().toLocaleString("en-US", {timeZone: this.config.nonActiveHours.timezone});
        
        console.log('🛡️ WhatsApp Anti-Ban Metrics:');
        console.log(`📊 Messages processed today: ${this.stats.messagesSent}/${this.config.maxMessagesPerDay}`);
        console.log(`🔗 Connections made: ${this.stats.connectionCount}`);
        console.log(`⏰ Last activity: ${this.stats.lastMessageTime ? new Date(this.stats.lastMessageTime).toLocaleString() : 'Never'}`);
        console.log(`✅ Rate limiting: ${this.canSendMessage() ? 'OK' : 'BLOCKED'}`);
        console.log(`⚠️ Approaching limit: ${this.isApproachingRateLimit() ? 'YES' : 'NO'}`);
        console.log(`🌍 Israeli time: ${israeliTime}`);
        
        if (!nonActiveStatus.isActive) {
            console.log(`😴 Non-active hours: ${nonActiveStatus.schedule.name} (${nonActiveStatus.currentTime})`);
            console.log(`🛌 Behavior: ${nonActiveStatus.behavior.toUpperCase()} mode`);
        } else {
            console.log(`☀️ Active hours: Normal operation`);
        }
    }
}

module.exports = WhatsAppAntiBan;
