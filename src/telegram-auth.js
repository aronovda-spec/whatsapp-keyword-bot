/**
 * Telegram Bot Authorization System
 * Restricts bot access to only authorized users
 */

const fs = require('fs');
const path = require('path');
const SupabaseManager = require('./supabase');

class TelegramAuthorization {
    constructor() {
        this.authorizedUsers = new Set();
        this.adminUsers = new Set();
        this.pendingApprovals = new Map(); // userId -> timestamp
        this.configPath = path.join(__dirname, '../config/telegram-auth.json');
        this.supabase = new SupabaseManager();
        this.loadAuthorizedUsers();
    }

    async loadAuthorizedUsers() {
        try {
            // Set you as admin and authorized user by default
            this.authorizedUsers.add('1022850808'); // Your chat ID
            this.adminUsers.add('1022850808'); // Your chat ID
            
            // Add fallback admin from environment variable (for recovery)
            const fallbackAdmin = process.env.TELEGRAM_FALLBACK_ADMIN;
            if (fallbackAdmin && fallbackAdmin !== '1022850808') {
                this.authorizedUsers.add(fallbackAdmin);
                this.adminUsers.add(fallbackAdmin);
                console.log(`🛡️ Fallback admin loaded: ${fallbackAdmin}`);
            }
            
            // Load from environment variables first
            const envAuthorized = process.env.TELEGRAM_AUTHORIZED_USERS;
            const envAdmins = process.env.TELEGRAM_ADMIN_USERS;

            if (envAuthorized) {
                envAuthorized.split(',').map(id => id.trim()).forEach(id => this.authorizedUsers.add(id));
            }
            if (envAdmins) {
                envAdmins.split(',').map(id => id.trim()).forEach(id => this.adminUsers.add(id));
            }

            // Try Supabase first
            if (this.supabase.isEnabled()) {
                try {
                    const users = await this.supabase.getAuthorizedUsers();
                    if (users && users.length > 0) {
                        users.forEach(user => {
                            this.authorizedUsers.add(user.user_id);
                            if (user.is_admin) {
                                this.adminUsers.add(user.user_id);
                            }
                        });
                        console.log(`📊 Loaded ${users.length} users from Supabase database`);
                    }
                } catch (error) {
                    console.warn('⚠️ Failed to load from Supabase, falling back to files:', error.message);
                }
            }

            // Load from file (fallback)
            if (fs.existsSync(this.configPath)) {
                const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
                config.authorizedUsers.forEach(id => this.authorizedUsers.add(id));
                config.adminUsers.forEach(id => this.adminUsers.add(id));
                
                // Load user names
                if (config.userNames) {
                    this.userNames = new Map(Object.entries(config.userNames));
                }
                // Pending approvals are not persisted across restarts for security
            }
            
            console.log(`🔐 Authorization loaded: ${this.authorizedUsers.size} users, ${this.adminUsers.size} admins`);
        } catch (error) {
            console.error('❌ Failed to load authorized users:', error.message);
        }
    }

    isAuthorized(userId) {
        return this.authorizedUsers.has(userId.toString());
    }

    isAdmin(userId) {
        return this.adminUsers.has(userId.toString());
    }

    addAuthorizedUser(userId, addedBy = null, userName = null) {
        this.authorizedUsers.add(userId.toString());
        
        // Store user name if provided
        if (userName) {
            this.userNames = this.userNames || new Map();
            this.userNames.set(userId.toString(), userName);
        }
        
        console.log(`✅ User ${userId} (${userName || 'Unknown'}) authorized by ${addedBy || 'system'}`);
        this.saveConfig();
        
        // Save to Supabase if enabled
        if (this.supabase.isEnabled()) {
            this.supabase.addAuthorizedUser(userId, false); // Not admin by default
        }
        
        return true;
    }

    saveConfig() {
        try {
            const config = {
                authorizedUsers: Array.from(this.authorizedUsers),
                adminUsers: Array.from(this.adminUsers),
                userNames: this.userNames ? Object.fromEntries(this.userNames) : {}
            };
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
        } catch (error) {
            console.error('❌ Failed to save authorization config:', error.message);
        }
    }

    removeAuthorizedUser(userId, removedBy = null) {
        const userIdStr = userId.toString();
        const userName = this.getUserName(userIdStr) || 'Unknown';
        
        // Remove from authorized users
        this.authorizedUsers.delete(userIdStr);
        
        // Remove from admin users if they were an admin
        this.adminUsers.delete(userIdStr);
        
        // Remove user name
        if (this.userNames) {
            this.userNames.delete(userIdStr);
        }
        
        console.log(`❌ User ${userIdStr} (${userName}) removed by ${removedBy || 'system'}`);
        this.saveConfig();
        return true;
    }

    addPendingApproval(userId) {
        this.pendingApprovals.set(userId.toString(), Date.now());
        console.log(`⏳ User ${userId} added to pending approvals`);
    }

    getPendingApprovals() {
        return Array.from(this.pendingApprovals.keys());
    }

    approveUser(userId, approvedBy, userName = null) {
        const userIdStr = userId.toString();
        if (!this.pendingApprovals.has(userIdStr)) {
            console.log(`❌ Cannot approve user ${userId}: not in pending list`);
            return false;
        }
        
        this.pendingApprovals.delete(userIdStr);
        this.addAuthorizedUser(userId, approvedBy, userName);
        console.log(`✅ User ${userId} (${userName || 'Unknown'}) approved by ${approvedBy}`);
        return true;
    }

    rejectUser(userId, rejectedBy) {
        const userIdStr = userId.toString();
        if (!this.pendingApprovals.has(userIdStr)) {
            console.log(`❌ Cannot reject user ${userId}: not in pending list`);
            return false;
        }
        
        this.pendingApprovals.delete(userIdStr);
        console.log(`❌ User ${userId} rejected by ${rejectedBy}`);
        return true;
    }

    getAuthorizedUsers() {
        return Array.from(this.authorizedUsers);
    }

    getAdminUsers() {
        return Array.from(this.adminUsers);
    }

    // Check if user can perform action
    canPerformAction(userId, action) {
        switch (action) {
            case 'receive_notifications':
                return this.isAuthorized(userId);
            case 'manage_users':
                return this.isAdmin(userId);
            case 'view_stats':
                return this.isAuthorized(userId);
            default:
                return false;
        }
    }

    // Generate authorization report
    getAuthorizationReport() {
        return {
            totalAuthorized: this.authorizedUsers.size,
            totalAdmins: this.adminUsers.size,
            pendingApprovals: this.pendingApprovals.size,
            authorizedUsers: this.getAuthorizedUsers(),
            adminUsers: this.getAdminUsers(),
            pendingUsers: this.getPendingApprovals()
        };
    }

    getUserName(userId) {
        if (this.userNames && this.userNames.has(userId.toString())) {
            return this.userNames.get(userId.toString());
        }
        return null;
    }

    setUserName(userId, userName) {
        this.userNames = this.userNames || new Map();
        this.userNames.set(userId.toString(), userName);
        this.saveConfig();
    }

    // Clean up user data from all config files
    cleanupUserData(userId) {
        const userIdStr = userId.toString();
        const userName = this.getUserName(userIdStr) || 'Unknown';
        
        try {
            // Clean up personal keywords
            this.cleanupPersonalKeywords(userIdStr);
            
            // Clean up group subscriptions
            this.cleanupGroupSubscriptions(userIdStr);
            
            // Clean up user preferences
            this.cleanupUserPreferences(userIdStr);
            
            console.log(`🧹 Cleaned up all data for user ${userIdStr} (${userName})`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to cleanup user data for ${userIdStr}:`, error.message);
            return false;
        }
    }

    cleanupPersonalKeywords(userId) {
        try {
            const fs = require('fs');
            const path = require('path');
            const personalKeywordsPath = path.join(__dirname, '../config/personal-keywords.json');
            
            if (fs.existsSync(personalKeywordsPath)) {
                const data = JSON.parse(fs.readFileSync(personalKeywordsPath, 'utf8'));
                delete data[userId];
                fs.writeFileSync(personalKeywordsPath, JSON.stringify(data, null, 2));
                console.log(`🗑️ Removed personal keywords for user ${userId}`);
            }
        } catch (error) {
            console.error(`❌ Failed to cleanup personal keywords for ${userId}:`, error.message);
        }
    }

    cleanupGroupSubscriptions(userId) {
        try {
            const fs = require('fs');
            const path = require('path');
            const subscriptionsPath = path.join(__dirname, '../config/group-subscriptions.json');
            
            if (fs.existsSync(subscriptionsPath)) {
                const data = JSON.parse(fs.readFileSync(subscriptionsPath, 'utf8'));
                
                // Remove user from all group subscriptions
                Object.keys(data).forEach(groupName => {
                    if (Array.isArray(data[groupName])) {
                        data[groupName] = data[groupName].filter(id => id !== userId);
                    }
                });
                
                fs.writeFileSync(subscriptionsPath, JSON.stringify(data, null, 2));
                console.log(`🗑️ Removed group subscriptions for user ${userId}`);
            }
        } catch (error) {
            console.error(`❌ Failed to cleanup group subscriptions for ${userId}:`, error.message);
        }
    }

    cleanupUserPreferences(userId) {
        try {
            const fs = require('fs');
            const path = require('path');
            const preferencesPath = path.join(__dirname, '../config/user-preferences.json');
            
            if (fs.existsSync(preferencesPath)) {
                const data = JSON.parse(fs.readFileSync(preferencesPath, 'utf8'));
                delete data[userId];
                fs.writeFileSync(preferencesPath, JSON.stringify(data, null, 2));
                console.log(`🗑️ Removed user preferences for user ${userId}`);
            }
        } catch (error) {
            console.error(`❌ Failed to cleanup user preferences for ${userId}:`, error.message);
        }
    }

    // Check if system has enough admins
    hasMinimumAdmins() {
        return this.adminUsers.size >= 1;
    }

    // Emergency recovery - restore fallback admin
    emergencyRecovery() {
        try {
            const fallbackAdmin = process.env.TELEGRAM_FALLBACK_ADMIN;
            if (fallbackAdmin) {
                this.authorizedUsers.add(fallbackAdmin);
                this.adminUsers.add(fallbackAdmin);
                this.saveConfig();
                console.log(`🛡️ Emergency recovery: Restored fallback admin ${fallbackAdmin}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Emergency recovery failed:', error.message);
            return false;
        }
    }
}

module.exports = TelegramAuthorization;
