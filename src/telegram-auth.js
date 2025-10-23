/**
 * Telegram Bot Authorization System
 * Restricts bot access to only authorized users
 */

const fs = require('fs');
const path = require('path');

class TelegramAuthorization {
    constructor() {
        this.authorizedUsers = new Set();
        this.adminUsers = new Set();
        this.pendingApprovals = new Map(); // userId -> timestamp
        this.configPath = path.join(__dirname, '../config/telegram-auth.json');
        this.loadAuthorizedUsers();
    }

    loadAuthorizedUsers() {
        try {
            // Set you as admin and authorized user by default
            this.authorizedUsers.add('1022850808'); // Your chat ID
            this.adminUsers.add('1022850808'); // Your chat ID
            
            // Load from environment variables first
            const envAuthorized = process.env.TELEGRAM_AUTHORIZED_USERS;
            const envAdmins = process.env.TELEGRAM_ADMIN_USERS;

            if (envAuthorized) {
                envAuthorized.split(',').map(id => id.trim()).forEach(id => this.authorizedUsers.add(id));
            }
            if (envAdmins) {
                envAdmins.split(',').map(id => id.trim()).forEach(id => this.adminUsers.add(id));
            }

            // Load from file (for dynamic updates)
            if (fs.existsSync(this.configPath)) {
                const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
                config.authorizedUsers.forEach(id => this.authorizedUsers.add(id));
                config.adminUsers.forEach(id => this.adminUsers.add(id));
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

    addAuthorizedUser(userId, addedBy = null) {
        this.authorizedUsers.add(userId.toString());
        console.log(`✅ User ${userId} authorized by ${addedBy || 'system'}`);
        this.saveConfig();
        return true;
    }

    saveConfig() {
        try {
            const config = {
                authorizedUsers: Array.from(this.authorizedUsers),
                adminUsers: Array.from(this.adminUsers)
            };
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
        } catch (error) {
            console.error('❌ Failed to save authorization config:', error.message);
        }
    }

    removeAuthorizedUser(userId, removedBy = null) {
        this.authorizedUsers.delete(userId.toString());
        console.log(`❌ User ${userId} removed by ${removedBy || 'system'}`);
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

    approveUser(userId, approvedBy) {
        this.pendingApprovals.delete(userId.toString());
        this.addAuthorizedUser(userId, approvedBy);
        return true;
    }

    rejectUser(userId, rejectedBy) {
        this.pendingApprovals.delete(userId.toString());
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
}

module.exports = TelegramAuthorization;
