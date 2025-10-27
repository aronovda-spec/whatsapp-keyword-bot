const { makeWASocket, DisconnectReason, useMultiFileAuthState, downloadMediaMessage } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { logError, logBotEvent } = require('./logger');
const WhatsAppAntiBan = require('./anti-ban');
const FileExtractor = require('./fileExtractor');
const SupabaseManager = require('./supabase');

class WhatsAppConnection {
    constructor(sessionPath) {
        this.sock = null;
        this.isConnected = false;
        this.sessionPath = sessionPath || process.env.WHATSAPP_SESSION_PATH || './sessions';
        this.reconnectDelay = 5000;
        this.qrTimeout = 60000;
        this.antiBan = new WhatsAppAntiBan(); // Anti-ban protection
        this.monitoredGroups = new Set(); // Track monitored groups
        this.fileExtractor = new FileExtractor(); // File content extractor
        this.supabase = new SupabaseManager(); // Supabase for session backup
        this.phoneNumber = null; // Will be set when connected
        this.phoneNumberForBackup = null; // Phone number without device ID for consistent backup
        this.configPhoneNumber = sessionPath ? sessionPath.split(/[/\\]/).pop() : 'phone1'; // Extract phone identifier from path
        this.groupNames = new Map(); // Cache group names
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

            // Try to restore session from Supabase (if enabled)
            if (this.supabase && this.supabase.isEnabled()) {
                console.log('🔍 Supabase enabled, attempting session restore...');
                try {
                    // Try multiple possible paths where sessions might be stored
                    const restorePaths = [
                        'PHONE_PLACEHOLDER', // Phone number without device ID (NEW consistent path - first priority)
                        'phone1', // Config default
                        'PHONE_PLACEHOLDER:12@s.whatsapp.net', // Most recent old backup with device ID 12
                        'PHONE_PLACEHOLDER:11@s.whatsapp.net', // Another old backup
                        'PHONE_PLACEHOLDER:4@s.whatsapp.net', // Another old backup
                        'PHONE_PLACEHOLDER:1@s.whatsapp.net', // First old backup
                        this.configPhoneNumber // Fallback
                    ];
                    
                    let restored = false;
                    
                    for (const restorePath of restorePaths) {
                        console.log(`🔍 Trying to restore session from path: ${restorePath}`);
                        
                        const sessionFiles = await this.supabase.listSessionFiles(restorePath);
                        
                        console.log(`📋 Session files found for ${restorePath}:`, sessionFiles?.length || 0);
                        
                        if (sessionFiles && sessionFiles.length > 0) {
                            console.log(`📥 Found ${sessionFiles.length} session files from Supabase (${restorePath}), restoring...`);
                            
                            // Download and write each file
                            for (const filename of sessionFiles) {
                                const content = await this.supabase.restoreSessionFile(restorePath, filename);
                                if (content) {
                                    const filePath = path.join(this.sessionPath, filename);
                                    const dir = path.dirname(filePath);
                                    if (!fs.existsSync(dir)) {
                                        fs.mkdirSync(dir, { recursive: true });
                                    }
                                    fs.writeFileSync(filePath, content, 'utf8');
                                    console.log(`✅ Restored: ${filename}`);
                                }
                            }
                            console.log('✅ Session restored from cloud');
                            restored = true;
                            break; // Stop once we find and restore sessions
                        }
                    }
                    
                    if (!restored) {
                        console.log('📭 No session files found in any of the checked paths - QR code will be required');
                    }
                } catch (error) {
                    console.log('⚠️ Could not restore session from Supabase:', error.message);
                }
            } else {
                console.log('⚠️ Supabase not enabled - session restore skipped');
            }

            await this.connect();
        } catch (error) {
            logError(error, { context: 'whatsapp_init' });
            console.error('❌ Failed to initialize WhatsApp connection:', error.message);
        }
    }

    async connect() {
        try {
            // Check connection rate limiting
            if (!this.antiBan.canConnect()) {
                console.log('⏳ Connection rate limited, waiting...');
                await this.antiBan.humanLikeDelay();
                return this.scheduleReconnect();
            }

            const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
            
            // Get anti-ban optimized configuration
            const sessionConfig = this.antiBan.getSessionConfig();
            
            // Apply human-like delay before connecting
            await this.antiBan.humanLikeDelay();
            
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

        // Save credentials when updated + backup to cloud
        this.sock.ev.on('creds.update', async () => {
            saveCreds();
            
            // Backup session to Supabase Storage (use consistent phone number without device ID)
            if (this.supabase.isEnabled() && this.phoneNumberForBackup) {
                await this.backupSessionToCloud();
            }
        });

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
        
        // Get phone number from connection
        try {
            const user = this.sock.user;
            const fullId = user?.id || 'default';
            this.phoneNumber = fullId;
            
            // Extract phone number without device ID for consistent backup path
            // e.g. "PHONE_PLACEHOLDER:4@s.whatsapp.net" → "PHONE_PLACEHOLDER"
            const phoneMatch = fullId.match(/^(\d+):/);
            this.phoneNumberForBackup = phoneMatch ? phoneMatch[1] : this.phoneNumber;
            
            console.log(`📱 Connected as: ${this.phoneNumber} (backup as: ${this.phoneNumberForBackup})`);
        } catch (error) {
            console.warn('Could not get phone number:', error.message);
            this.phoneNumber = 'default';
            this.phoneNumberForBackup = 'default';
        }
        
        // Cache group names for better display (with error handling)
        try {
            await this.cacheGroupNames();
        } catch (error) {
            console.error('Failed to cache group names:', error.message);
            // Non-critical, continue anyway
        }
        
        logBotEvent('whatsapp_connected');
        console.log('✅ WhatsApp connected successfully!');
        console.log('🤖 Bot is now monitoring for keywords...');
        
        // Discover all groups the bot is a member of
        try {
        await this.discoverGroups();
        } catch (error) {
            console.error('Failed to discover groups:', error.message);
            // Non-critical, continue anyway
        }
        
        // Backup session to cloud (use consistent phone number without device ID)
        if (this.supabase.isEnabled() && this.phoneNumberForBackup) {
            await this.backupSessionToCloud();
        }
        
        // Emit connected event for bot to handle
        this.emit('connected');
    }

    handleDisconnection(lastDisconnect) {
        this.isConnected = false;
        
        // Log detailed disconnect information
        console.log('\n🔍 === DISCONNECT DETAILED DEBUG ===');
        console.log('Last Disconnect Object:', JSON.stringify(lastDisconnect, null, 2));
        console.log('Error Output:', lastDisconnect?.error?.output);
        console.log('Error Message:', lastDisconnect?.error?.message);
        console.log('=====================================\n');
        
        const disconnectReason = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = disconnectReason !== DisconnectReason.loggedOut;
        
        // Determine the specific reason for disconnection
        let disconnectMessage = 'Bot lost connection to WhatsApp';
        let isVirtualNumberExpired = false;
        
        // Map Baileys disconnect reasons to human-readable messages
        const disconnectReasons = {
            [DisconnectReason.connectionClosed]: 'Connection closed (402) - Network issue or server closed connection',
            [DisconnectReason.connectionLost]: 'Connection lost (408) - Internet connection dropped',
            [DisconnectReason.connectionReplaced]: 'Connection replaced (440) - Another device connected to this account',
            [DisconnectReason.loggedOut]: 'Logged out (401) - Session expired, need to scan QR code',
            [DisconnectReason.badSession]: 'Bad session (500) - Invalid or corrupted session',
            [DisconnectReason.restartRequired]: 'Restart required - WhatsApp forced restart',
            [DisconnectReason.timedOut]: 'Timed out (504) - Connection took too long to establish',
            [DisconnectReason.multideviceMismatch]: 'Multi-device mismatch - Multiple devices connected'
        };
        
        // Check for specific error messages that indicate different issues
        const errorMessage = lastDisconnect?.error?.message || '';
        
        if (disconnectReason === 408 && errorMessage.includes('QR refs attempts ended')) {
            disconnectMessage = 'QR connection timeout (408) - QR code expired, restarting to get new QR';
            // Force reconnection to get a new QR code
        } else if (disconnectReasons[disconnectReason]) {
            disconnectMessage = disconnectReasons[disconnectReason];
        } else if (disconnectReason === DisconnectReason.loggedOut) {
            disconnectMessage = 'WhatsApp logged out - Virtual number may have expired!';
            isVirtualNumberExpired = true;
        } else if (disconnectReason === DisconnectReason.badSession) {
            disconnectMessage = 'Invalid session - Virtual number may have expired!';
            isVirtualNumberExpired = true;
        } else {
            disconnectMessage = `WhatsApp disconnected (Reason code: ${disconnectReason || 'Unknown'})`;
        }
        
        console.log(`🔍 Detected Disconnect Reason Code: ${disconnectReason}`);
        console.log(`📱 Message: ${disconnectMessage}`);
        console.log(`🔄 Should Reconnect: ${shouldReconnect}`);
        
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

    async handleMessages(m) {
        const { messages, type } = m;
        
        if (type !== 'notify') return;

        for (const message of messages) {
            await this.processMessage(message);
        }
    }

    async processMessage(message) {
        try {
            // Apply human-like delay before processing
            await this.antiBan.humanLikeDelay();

            // Extract message content and type
            const msg = message.message;
            let messageText = '';
            let attachment = null;

            // Check for text content
            if (msg?.conversation) {
                messageText = msg.conversation;
            } else if (msg?.extendedTextMessage?.text) {
                messageText = msg.extendedTextMessage.text;
                // Extended text may also have caption for media
                if (msg.extendedTextMessage?.contextInfo?.quotedMessage) {
                    // Handle quote, but focus on the text itself
                }
            }

            // Check for attachments (documents, images, audio, video)
            if (msg?.documentMessage) {
                const doc = msg.documentMessage;
                attachment = {
                    type: 'document',
                    mimetype: doc.mimetype || 'unknown',
                    filename: doc.fileName || 'unnamed_file',
                    size: doc.fileLength || 0,
                    caption: doc.caption || ''
                };
                // Add caption to text if present
                if (doc.caption) {
                    messageText += (messageText ? '\n' : '') + doc.caption;
                }
            } else if (msg?.imageMessage) {
                const img = msg.imageMessage;
                attachment = {
                    type: 'image',
                    mimetype: img.mimetype || 'image/jpeg',
                    size: img.fileLength || 0,
                    caption: img.caption || ''
                };
                // Add caption to text if present
                if (img.caption) {
                    messageText += (messageText ? '\n' : '') + img.caption;
                }
            } else if (msg?.videoMessage) {
                const vid = msg.videoMessage;
                attachment = {
                    type: 'video',
                    mimetype: vid.mimetype || 'video/mp4',
                    size: vid.fileLength || 0,
                    caption: vid.caption || ''
                };
                // Add caption to text if present
                if (vid.caption) {
                    messageText += (messageText ? '\n' : '') + vid.caption;
                }
            } else if (msg?.audioMessage) {
                const aud = msg.audioMessage;
                attachment = {
                    type: 'audio',
                    mimetype: aud.mimetype || 'audio/mp3',
                    size: aud.fileLength || 0,
                    caption: ''
                };
            } else if (msg?.stickerMessage) {
                attachment = {
                    type: 'sticker',
                    mimetype: 'image/webp',
                    caption: ''
                };
            }

            // If no text and no attachment, skip
            if (!messageText.trim() && !attachment) {
                return;
            }

            // If attachment exists, download and extract text from file content
            let extractedText = '';
            if (attachment && this.fileExtractor && attachment.filename) {
                try {
                    console.log(`📥 Downloading and extracting content from: ${attachment.filename}`);
                    
                    // Download the file
                    const fileBuffer = await this.downloadAndExtractFile(message);
                    
                    if (fileBuffer) {
                        // Extract text from file content
                        extractedText = await this.extractFileContent(
                            fileBuffer,
                            attachment.mimetype,
                            attachment.filename
                        );
                        
                        if (extractedText) {
                            console.log(`✅ Extracted ${extractedText.length} characters from file`);
                            // Add extracted text to message text for keyword detection
                            messageText += (messageText ? '\n\n[File Content]\n' : '') + extractedText;
                        }
                    }
                } catch (error) {
                    logError(error, {
                        context: 'file_content_extraction_in_message',
                        filename: attachment.filename
                    });
                }
            }

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
                if (attachment) {
                    console.log(`   Attachment: ${attachment.type} - ${attachment.filename || 'no filename'}`);
                }
                if (messageText) {
                    console.log(`   Message: ${messageText.substring(0, 50)}...`);
                }
                console.log(`   Time: ${new Date().toLocaleString()}`);
                console.log('');
            } else if (isPrivate) {
                console.log(`👤 Private Chat Message Detected:`);
                console.log(`   User ID: ${chatId}`);
                console.log(`   Sender: ${sender}`);
                if (attachment) {
                    console.log(`   Attachment: ${attachment.type} - ${attachment.filename || 'no filename'}`);
                }
                if (messageText) {
                    console.log(`   Message: ${messageText.substring(0, 50)}...`);
                }
                console.log(`   Time: ${new Date().toLocaleString()}`);
                console.log('');
            } else if (isBroadcast) {
                console.log(`📢 Broadcast Message Detected:`);
                console.log(`   Broadcast ID: ${chatId}`);
                console.log(`   Sender: ${sender}`);
                if (attachment) {
                    console.log(`   Attachment: ${attachment.type} - ${attachment.filename || 'no filename'}`);
                }
                if (messageText) {
                    console.log(`   Message: ${messageText.substring(0, 50)}...`);
                }
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
                       isBroadcast ? 'Broadcast' : 'Unknown',
                attachment: attachment // Add attachment info
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
            // Check if group name is cached
            if (this.groupNames.has(jid)) {
                return this.groupNames.get(jid);
            }

            // Try to get group metadata from socket
            if (this.sock) {
                const groupInfo = this.sock.metadata?.[jid];
                if (groupInfo && groupInfo.subject) {
                    this.groupNames.set(jid, groupInfo.subject);
                    return groupInfo.subject;
                }
            }

            // If cache doesn't exist, try to get from group fetch
            // For now, return the JID without @g.us suffix as fallback
            const groupId = jid.split('@')[0];
            this.groupNames.set(jid, groupId);
            return groupId;
        } catch (error) {
            console.error('Error getting group name:', error.message);
            return 'Unknown Group';
        }
    }

    async cacheGroupNames() {
        try {
            if (!this.sock) return;

            // Fetch all groups the bot is in
            const groups = await this.sock.groupFetchAllParticipating();
            
            // Cache group names
            Object.values(groups).forEach(group => {
                if (group.id && group.subject) {
                    this.groupNames.set(group.id, group.subject);
                }
            });

            console.log(`✅ Cached ${this.groupNames.size} group names`);
        } catch (error) {
            console.error('Error caching group names:', error.message);
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

    async backupSessionToCloud() {
        if (!this.supabase.isEnabled() || !this.phoneNumberForBackup) {
            return;
        }

        try {
            console.log(`💾 Starting session backup for ${this.phoneNumberForBackup} (device: ${this.phoneNumber})...`);
            
            // Read all session files
            const sessionFiles = {};
            const files = fs.readdirSync(this.sessionPath, { recursive: true });
            
            for (const file of files) {
                const filePath = path.join(this.sessionPath, file);
                if (fs.statSync(filePath).isFile()) {
                    sessionFiles[file] = fs.readFileSync(filePath, 'utf8');
                }
            }

            console.log(`📁 Found ${Object.keys(sessionFiles).length} session files to backup`);

            // IMPORTANT: Only backup essential session files for session restore
            // These are the ONLY files needed to restore a WhatsApp session:
            // 1. creds.json - Your WhatsApp credentials (REQUIRED)
            // 2. device-list-*.json - Device information (REQUIRED)
            // 3. lid-mapping-*.json - Contact/channel mappings (optional but useful)
            // NOT needed: pre-key-* (hundreds of auto-generated encryption keys)
            // NOT needed: app-state-* (application state, auto-created)
            const essentialFiles = Object.entries(sessionFiles).filter(([filename]) => {
                // Skip files that are auto-generated:
                // - pre-key-* files (encryption keys, auto-regenerated)
                // - app-state-* files (application state, auto-synced)
                return !filename.includes('pre-key-') && !filename.includes('app-state-');
            });

            console.log(`📦 Backing up ${essentialFiles.length} essential session files (skipped pre-keys)`);

            // Backup each essential file individually with rate limiting
            let successCount = 0;
            let failCount = 0;

            for (const [filename, content] of essentialFiles) {
                try {
                    // Use phoneNumberForBackup for consistent storage path
                    const success = await this.supabase.backupSessionFile(this.phoneNumberForBackup, filename, content);
                    if (success) {
                        successCount++;
                        if (successCount % 10 === 0) {
                            console.log(`📦 Progress: ${successCount}/${essentialFiles.length} files backed up`);
                        }
                    } else {
                        failCount++;
                    }
                } catch (error) {
                    failCount++;
                    // Only log first few failures to avoid spam
                    if (failCount <= 3) {
                        console.error(`❌ Failed to backup ${filename}:`, error.message);
                    }
                }
                
                // Add small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log(`💾 Session backup completed: ${successCount} succeeded, ${failCount} failed for ${this.phoneNumberForBackup}`);
        } catch (error) {
            console.error('❌ Failed to backup session to cloud:', error.message);
        }
    }

    getSocket() {
        return this.sock;
    }

    /**
     * Download and extract text from a media message
     * @param {Object} message - WhatsApp message object
     * @returns {Promise<Buffer|null>} File buffer or null
     */
    async downloadAndExtractFile(message) {
        try {
            if (!this.sock || !this.isConnected) {
                return null;
            }

            // Check if message has media
            let mediaMessage = null;
            const msg = message.message;
            
            if (msg.documentMessage) mediaMessage = msg.documentMessage;
            else if (msg.imageMessage) mediaMessage = msg.imageMessage;
            else if (msg.videoMessage) mediaMessage = msg.videoMessage;
            else if (msg.audioMessage) mediaMessage = msg.audioMessage;
            
            if (!mediaMessage) return null;

            // Download the media
            const buffer = await downloadMediaMessage(
                message,
                'buffer',
                {},
                { logger: () => {} } // Suppress download logs
            );

            return buffer;
        } catch (error) {
            logError(error, { context: 'file_download' });
            return null;
        }
    }

    /**
     * Extract text from downloaded file content
     * @param {Buffer} buffer - File buffer
     * @param {string} mimetype - MIME type
     * @param {string} filename - File name
     * @returns {Promise<string>} Extracted text
     */
    async extractFileContent(buffer, mimetype, filename) {
        if (!buffer || !this.fileExtractor) return '';
        
        try {
            // Check if file type is supported
            if (!this.fileExtractor.isSupported(mimetype, filename)) {
                return '';
            }

            // Extract text from file
            const extractedText = await this.fileExtractor.extractText(buffer, mimetype, filename);
            return extractedText;
        } catch (error) {
            logError(error, {
                context: 'file_content_extraction',
                mimetype,
                filename
            });
            return '';
        }
    }
}

module.exports = WhatsAppConnection;
