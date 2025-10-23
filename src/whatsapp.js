const { makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { logError, logBotEvent } = require('./logger');
const WhatsAppAntiBan = require('./anti-ban');

class WhatsAppConnection {
    constructor() {
        this.sock = null;
        this.isConnected = false;
        this.sessionPath = process.env.WHATSAPP_SESSION_PATH || './sessions';
        this.reconnectDelay = 5000;
        this.qrTimeout = 60000;
        this.antiBan = new WhatsAppAntiBan(); // Anti-ban protection
        this.monitoredGroups = new Set(); // Track monitored groups
        this.loadGroupConfig();
        this.init();
    }

    loadGroupConfig() {
        try {
            const configPath = path.join(__dirname, '../config/monitored-groups.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                config.monitoredGroups.forEach(group => {
                    if (group.enabled && group.groupId !== 'GROUP_ID_PLACEHOLDER') {
                        this.monitoredGroups.add(group.groupId);
                        console.log(`📱 Added group to monitoring: ${group.name} (${group.groupId})`);
                    }
                });
                console.log(`📱 Total monitored groups: ${this.monitoredGroups.size}`);
            } else {
                console.log('📱 No group configuration found - will monitor all groups');
            }
        } catch (error) {
            console.error('❌ Error loading group config:', error.message);
        }
    }

    async init() {
        try {
            // Ensure session directory exists
            if (!fs.existsSync(this.sessionPath)) {
                fs.mkdirSync(this.sessionPath, { recursive: true });
            }

            await this.connect();
        } catch (error) {
            logError(error, { context: 'whatsapp_init' });
            console.error('❌ Failed to initialize WhatsApp connection:', error.message);
        }
    }

    async connect() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
            
            // Get anti-ban optimized configuration
            const sessionConfig = this.antiBan.getSessionConfig();
            
            this.sock = makeWASocket({
                auth: state,
                logger: {
                    level: 'silent',
                    child: () => ({
                        level: 'silent',
                        error: () => {},
                        warn: () => {},
                        info: () => {},
                        debug: () => {},
                        trace: () => {},
                        fatal: () => {}
                    }),
                    error: () => {},
                    warn: () => {},
                    info: () => {},
                    debug: () => {},
                    trace: () => {},
                    fatal: () => {}
                },
                ...sessionConfig
            });

            this.setupEventHandlers(saveCreds);
            
            logBotEvent('whatsapp_connection_attempt');
            console.log('🔄 Connecting to WhatsApp...');

        } catch (error) {
            logError(error, { context: 'whatsapp_connect' });
            console.error('❌ Failed to connect to WhatsApp:', error.message);
            this.scheduleReconnect();
        }
    }

    setupEventHandlers(saveCreds) {
        // Connection updates
        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                this.handleQRCode(qr);
            }

            if (connection === 'close') {
                this.handleDisconnection(lastDisconnect);
            } else if (connection === 'open') {
                this.handleConnection();
            }
        });

        // Save credentials when updated
        this.sock.ev.on('creds.update', saveCreds);

        // Message events
        this.sock.ev.on('messages.upsert', (m) => {
            this.handleMessages(m);
        });
    }

    handleQRCode(qr) {
        console.log('\n📱 Scan this QR code with your WhatsApp:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        qrcode.generate(qr, { small: true });
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('⏰ QR code will expire in 60 seconds...\n');

        // Set timeout for QR code
        setTimeout(() => {
            if (!this.isConnected) {
                console.log('⏰ QR code expired. Please restart the bot.');
            }
        }, this.qrTimeout);
    }

    async handleConnection() {
        this.isConnected = true;
        logBotEvent('whatsapp_connected');
        console.log('✅ WhatsApp connected successfully!');
        console.log('🤖 Bot is now monitoring for keywords...');
        
        // Discover all groups the bot is a member of
        await this.discoverGroups();
        
        // Emit connected event for bot to handle
        this.emit('connected');
    }

    handleDisconnection(lastDisconnect) {
        this.isConnected = false;
        
        const disconnectReason = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = disconnectReason !== DisconnectReason.loggedOut;
        
        // Determine the specific reason for disconnection
        let disconnectMessage = 'Bot lost connection to WhatsApp';
        let isVirtualNumberExpired = false;
        
        if (disconnectReason === DisconnectReason.loggedOut) {
            disconnectMessage = 'WhatsApp logged out - Virtual number may have expired!';
            isVirtualNumberExpired = true;
        } else if (disconnectReason === DisconnectReason.badSession) {
            disconnectMessage = 'Invalid session - Virtual number may have expired!';
            isVirtualNumberExpired = true;
        } else if (disconnectReason === DisconnectReason.connectionClosed) {
            disconnectMessage = 'Connection closed - Check virtual number status';
        } else if (disconnectReason === DisconnectReason.connectionLost) {
            disconnectMessage = 'Connection lost - Network or virtual number issue';
        } else if (disconnectReason === DisconnectReason.connectionReplaced) {
            disconnectMessage = 'Connection replaced - Another device connected';
        } else if (disconnectReason === DisconnectReason.timedOut) {
            disconnectMessage = 'Connection timed out - Check virtual number';
        } else {
            disconnectMessage = `WhatsApp disconnected (Reason: ${disconnectReason})`;
        }
        
        if (shouldReconnect) {
            logBotEvent('whatsapp_disconnected', { 
                reason: disconnectReason,
                shouldReconnect: true,
                isVirtualNumberExpired: isVirtualNumberExpired
            });
            console.log(`🔄 WhatsApp disconnected. Reconnecting...`);
            console.log(`📱 Reason: ${disconnectMessage}`);
            this.scheduleReconnect();
        } else {
            logBotEvent('whatsapp_logged_out', {
                reason: disconnectReason,
                isVirtualNumberExpired: isVirtualNumberExpired
            });
            console.log(`❌ WhatsApp logged out. Please scan QR code again.`);
            console.log(`📱 Reason: ${disconnectMessage}`);
        }
        
        // Emit disconnected event with detailed information
        this.emit('disconnected', {
            reason: disconnectReason,
            message: disconnectMessage,
            isVirtualNumberExpired: isVirtualNumberExpired
        });
    }

    scheduleReconnect() {
        setTimeout(() => {
            if (!this.isConnected) {
                console.log('🔄 Attempting to reconnect...');
                this.connect();
            }
        }, this.reconnectDelay);
    }

    handleMessages(m) {
        const { messages, type } = m;
        
        if (type !== 'notify') return;

        messages.forEach(message => {
            this.processMessage(message);
        });
    }

    processMessage(message) {
        try {
            // Only process text messages
            if (!message.message?.conversation && !message.message?.extendedTextMessage?.text) {
                return;
            }

            const messageText = message.message.conversation || 
                              message.message.extendedTextMessage?.text || '';

            if (!messageText.trim()) return;

            // Extract message metadata
            const sender = message.key.participant || message.key.remoteJid;
            const chatId = message.key.remoteJid;
            const isGroup = chatId.includes('@g.us');
            const isPrivate = chatId.includes('@s.whatsapp.net');
            const isBroadcast = chatId.includes('@broadcast');

            // Log chat information for easy ID discovery
            if (isGroup) {
                console.log(`📱 Group Message Detected:`);
                console.log(`   Group ID: ${chatId}`);
                console.log(`   Sender: ${sender}`);
                console.log(`   Message: ${messageText.substring(0, 50)}...`);
                console.log(`   Time: ${new Date().toLocaleString()}`);
                console.log('');
            } else if (isPrivate) {
                console.log(`👤 Private Chat Message Detected:`);
                console.log(`   User ID: ${chatId}`);
                console.log(`   Sender: ${sender}`);
                console.log(`   Message: ${messageText.substring(0, 50)}...`);
                console.log(`   Time: ${new Date().toLocaleString()}`);
                console.log('');
            } else if (isBroadcast) {
                console.log(`📢 Broadcast Message Detected:`);
                console.log(`   Broadcast ID: ${chatId}`);
                console.log(`   Sender: ${sender}`);
                console.log(`   Message: ${messageText.substring(0, 50)}...`);
                console.log(`   Time: ${new Date().toLocaleString()}`);
                console.log('');
            }

            const messageData = {
                id: message.key.id,
                text: messageText,
                timestamp: message.messageTimestamp,
                from: chatId,
                sender: this.getSenderName(message),
                group: isGroup ? this.getGroupName(chatId) : 
                       isPrivate ? 'Private Chat' : 
                       isBroadcast ? 'Broadcast' : 'Unknown'
            };

            // Emit message event for keyword detection
            this.emit('message', messageData);

        } catch (error) {
            logError(error, { context: 'process_message', messageId: message.key?.id });
        }
    }

    getSenderName(message) {
        try {
            // Try to get sender name from push name or participant
            const pushName = message.pushName;
            if (pushName) return pushName;

            // For group messages, try to get participant name
            if (this.isGroupMessage(message.key.remoteJid)) {
                const participant = message.key.participant;
                if (participant) {
                    return participant.split('@')[0]; // Remove @s.whatsapp.net
                }
            }

            return 'Unknown';
        } catch (error) {
            return 'Unknown';
        }
    }

    isGroupMessage(jid) {
        return jid?.endsWith('@g.us');
    }

    getGroupName(jid) {
        try {
            // Extract group name from JID (simplified)
            return jid.split('@')[0] || 'Unknown Group';
        } catch (error) {
            return 'Unknown Group';
        }
    }

    // Event emitter functionality
    emit(event, data) {
        if (this.eventHandlers && this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    logError(error, { context: 'event_handler', event });
                }
            });
        }
    }

    on(event, handler) {
        if (!this.eventHandlers) {
            this.eventHandlers = {};
        }
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(handler);
    }

    getConnectionStatus() {
        return this.isConnected;
    }

    shouldMonitorGroup(chatId) {
        // If no groups configured, monitor all chats
        if (this.monitoredGroups.size === 0) {
            return true;
        }
        
        // Check if this specific chat is in monitored list
        return this.monitoredGroups.has(chatId);
    }

    addMonitoredGroup(groupId, groupName = 'Unknown') {
        this.monitoredGroups.add(groupId);
        console.log(`📱 Added group to monitoring: ${groupName} (${groupId})`);
    }

    removeMonitoredGroup(groupId) {
        this.monitoredGroups.delete(groupId);
        console.log(`📱 Removed group from monitoring: ${groupId}`);
    }

    getMonitoredGroups() {
        return Array.from(this.monitoredGroups);
    }

    async discoverGroups() {
        try {
            console.log('🔍 Discovering WhatsApp chats and groups...');
            
            // Get all groups the bot is a member of
            const groups = await this.sock.groupFetchAllParticipating();
            
            console.log(`📱 Found ${Object.keys(groups).length} groups:`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            // Display all groups with their IDs
            Object.values(groups).forEach((group, index) => {
                const groupName = group.subject || 'Unnamed Group';
                const groupId = group.id;
                const participantCount = group.participants?.length || 0;
                
                console.log(`${index + 1}. ${groupName}`);
                console.log(`   ID: ${groupId}`);
                console.log(`   Participants: ${participantCount}`);
                console.log(`   Status: ${this.monitoredGroups.has(groupId) ? '✅ Monitored' : '⏸️ Not monitored'}`);
                console.log('');
            });
            
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('💡 Chat Types Detected:');
            console.log('• Groups: @g.us (multiple participants)');
            console.log('• Private chats: @s.whatsapp.net (single users)');
            console.log('• Broadcast lists: @broadcast (broadcast messages)');
            console.log('');
            console.log('💡 To monitor chats:');
            console.log('1. Copy the Chat ID (ending with @g.us or @s.whatsapp.net)');
            console.log('2. Update config/monitored-groups.json');
            console.log('3. Set enabled: true for that chat');
            console.log('4. Restart the bot');
            console.log('');
            
            // Save discovered groups to file for easy reference
            await this.saveDiscoveredGroups(groups);
            
        } catch (error) {
            console.error('❌ Error discovering groups:', error.message);
            logError(error, { context: 'discover_groups' });
        }
    }

    async saveDiscoveredGroups(groups) {
        try {
            const groupsData = Object.values(groups).map(group => ({
                id: group.id,
                name: group.subject || 'Unnamed Group',
                participants: group.participants?.length || 0,
                description: group.description || '',
                creation: group.creation || 0
            }));

            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(__dirname, '../config/discovered-groups.json');
            
            const data = {
                discoveredAt: new Date().toISOString(),
                totalGroups: groupsData.length,
                groups: groupsData
            };

            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`💾 Discovered groups saved to: config/discovered-groups.json`);
            
        } catch (error) {
            console.error('❌ Error saving discovered groups:', error.message);
        }
    }

    getSocket() {
        return this.sock;
    }
}

module.exports = WhatsAppConnection;
