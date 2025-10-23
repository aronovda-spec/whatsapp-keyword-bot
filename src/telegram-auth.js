/**
 * Telegram Bot Authorization System
 * Restricts bot access to only authorized users
 */

class TelegramAuthorization {
    constructor() {
        this.authorizedUsers = new Set();
        this.adminUsers = new Set();
        this.pendingApprovals = new Map(); // userId -> timestamp
        this.loadAuthorizedUsers();
    }

    loadAuthorizedUsers() {
        try {
            // Set you as admin and authorized user by default
            this.authorizedUsers.add('1022850808'); // Your chat ID
            this.adminUsers.add('1022850808'); // Your chat ID
            
            // Load from environment variables
            const authorizedChatIds = process.env.TELEGRAM_AUTHORIZED_USERS || '';
            const adminChatIds = process.env.TELEGRAM_ADMIN_USERS || '';
            
            if (authorizedChatIds) {
                authorizedChatIds.split(',').forEach(id => {
                    this.authorizedUsers.add(id.trim());
                });
            }
            
            if (adminChatIds) {
                adminChatIds.split(',').forEach(id => {
                    this.adminUsers.add(id.trim());
                });
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
        return true;
    }

    removeAuthorizedUser(userId, removedBy = null) {
        this.authorizedUsers.delete(userId.toString());
        console.log(`❌ User ${userId} removed by ${removedBy || 'system'}`);
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
