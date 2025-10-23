const { makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { logError, logBotEvent } = require('./logger');

class WhatsAppConnection {
    constructor() {
        this.sock = null;
        this.isConnected = false;
        this.sessionPath = process.env.WHATSAPP_SESSION_PATH || './sessions';
        this.reconnectDelay = 5000;
        this.qrTimeout = 60000;
        this.init();
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
            
            this.sock = makeWASocket({
                auth: state,
                printQRInTerminal: false, // We'll handle QR display ourselves
                logger: {
                    level: 'silent', // Reduce noise in logs
                    child: () => ({ level: 'silent' })
                }
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

    handleConnection() {
        this.isConnected = true;
        logBotEvent('whatsapp_connected');
        console.log('✅ WhatsApp connected successfully!');
        console.log('🤖 Bot is now monitoring for keywords...');
        
        // Emit connected event for bot to handle
        this.emit('connected');
    }

    handleDisconnection(lastDisconnect) {
        this.isConnected = false;
        
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
            logBotEvent('whatsapp_disconnected', { 
                reason: lastDisconnect?.error?.output?.statusCode,
                shouldReconnect: true 
            });
            console.log('🔄 WhatsApp disconnected. Reconnecting...');
            this.scheduleReconnect();
        } else {
            logBotEvent('whatsapp_logged_out');
            console.log('❌ WhatsApp logged out. Please scan QR code again.');
        }
        
        // Emit disconnected event for bot to handle
        this.emit('disconnected');
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
            const messageData = {
                id: message.key.id,
                text: messageText,
                timestamp: message.messageTimestamp,
                from: message.key.remoteJid,
                sender: this.getSenderName(message),
                group: this.isGroupMessage(message.key.remoteJid) ? 
                       this.getGroupName(message.key.remoteJid) : 'Private Chat'
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

    isConnected() {
        return this.isConnected;
    }

    getSocket() {
        return this.sock;
    }
}

module.exports = WhatsAppConnection;
