const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const { logError, logBotEvent } = require('./logger');

class ReminderManager extends EventEmitter {
    constructor() {
        super();
        this.reminders = new Map(); // reminderId → reminder object
        this.reminderTimers = new Map(); // reminderId → timeout ID
        this.reminderExecuting = new Map(); // reminderId → is executing (to prevent race conditions)
        this.activeReminders = new Map(); // userId → Set of reminderIds (supports multiple reminders per user)
        this.acknowledgedKeywords = new Map(); // userId → Set of acknowledged keywords
        this.acknowledgedTime = new Map(); // userId → timestamp when /ok was pressed
        this.lastAcknowledgedTime = new Map(); // userId → timestamp of last acknowledgment (for historical tracking)
        this.reminderIdCounter = 0; // Counter for unique reminder IDs
        this.storagePath = path.join(__dirname, '../config/active-reminders.json');
        this.maxReminders = 5; // 0 min, 1 min, 2 min, 15 min, 1 hour
        this.loadReminders();
    }

    /**
     * Load active reminders from file
     */
    loadReminders() {
        try {
            if (fs.existsSync(this.storagePath)) {
                const data = fs.readFileSync(this.storagePath, 'utf8');
                const savedReminders = JSON.parse(data);
                
                // Note: We don't restore old reminder timers on startup
                // because the setTimeout IDs are lost after restart
                // Users will need to re-trigger keyword alerts for new reminders
                console.log(`📋 Found saved reminders but not restoring (timers lost on restart)`);
                console.log(`📋 To prevent old reminders from spamming, clearing saved reminders...`);
                
                // Clear old reminders file to prevent confusion
                fs.unlinkSync(this.storagePath);
                console.log(`🗑️ Cleared old reminders file`);
            }
        } catch (error) {
            logError(error, { context: 'load_reminders' });
            console.error('❌ Failed to load reminders');
        }
    }

    /**
     * Save active reminders to file
     */
    saveReminders() {
        try {
            const remindersObj = {};
            for (const [userId, reminders] of this.reminders) {
                remindersObj[userId] = reminders;
            }
            
            // Ensure directory exists
            const dir = path.dirname(this.storagePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(this.storagePath, JSON.stringify(remindersObj, null, 2));
        } catch (error) {
            logError(error, { context: 'save_reminders' });
        }
    }

    /**
     * Add a new reminder for a user
     */
    addReminder(userId, keyword, message, sender, group, messageId, phoneNumber, attachment, isGlobal = false) {
        // Check if user recently pressed /ok (within last 10 seconds - race condition protection)
        if (this.acknowledgedTime.has(userId)) {
            const acknowledgedTimestamp = this.acknowledgedTime.get(userId);
            const timeSinceAcknowledged = Date.now() - acknowledgedTimestamp;
            if (timeSinceAcknowledged < 10000) { // 10 seconds
                console.log(`⏰ User ${userId} recently pressed /ok (${Math.round(timeSinceAcknowledged/1000)}s ago) - not starting new reminder`);
                return;
            }
            // Clean up old acknowledgments
            this.acknowledgedTime.delete(userId);
        }
        
        // Check if user has acknowledged this keyword (even before reminder was added)
        if (this.acknowledgedKeywords.has(userId)) {
            const userAcknowledgedKeywords = this.acknowledgedKeywords.get(userId);
            if (userAcknowledgedKeywords.has(keyword)) {
                console.log(`⏰ User ${userId} already acknowledged keyword: "${keyword}" - not starting new reminder`);
                return;
            }
        }
        
        // Check if there's an existing reminder for this user/keyword using the new Set-based system
        const reminderIds = this.activeReminders.get(userId) || new Set();
        for (const reminderId of reminderIds) {
            const existingReminder = this.reminders.get(reminderId);
            // If existing reminder is for same keyword and acknowledged, skip
            if (existingReminder && existingReminder.keyword === keyword && existingReminder.status === 'acknowledged') {
                console.log(`⏰ User ${userId} already acknowledged reminder for keyword: "${keyword}" - not starting new reminder`);
                return;
            }
            // If existing reminder is for same keyword and still active, mark as overridden
            if (existingReminder && existingReminder.keyword === keyword && existingReminder.status === 'active') {
                console.log(`⏰ Replacing active reminder for keyword: "${keyword}" - mark as overridden`);
                existingReminder.status = 'overridden';
                this.cancelReminderTimer(reminderId);
                reminderIds.delete(reminderId);
                break;
            }
        }

        // Generate unique reminder ID
        const reminderId = `reminder_${++this.reminderIdCounter}_${userId}_${Date.now()}`;

        const reminder = {
            reminderId, // Unique ID for this reminder
            userId,
            keyword,
            message,
            sender,
            group,
            messageId,
            phoneNumber,
            attachment,
            isGlobal, // Flag to indicate if this is a global keyword reminder
            status: 'active', // STATE: 'active', 'acknowledged', 'cancelled', 'completed'
            firstDetectedAt: new Date(),
            nextReminderAt: new Date(Date.now() + 60000), // First reminder in 1 minute
            reminderCount: 0,
            reminderIntervals: [
                60000,   // 1 min (second reminder, 1 more minute)
                780000,  // 15 min (third reminder, 13 more minutes)
                2700000  // 1 hour (fourth reminder, 45 more minutes)
            ]
        };

        // Store by reminderId for unique access
        this.reminders.set(reminderId, reminder);
        
        // Add to user's active reminders Set
        if (!this.activeReminders.has(userId)) {
            this.activeReminders.set(userId, new Set());
        }
        this.activeReminders.get(userId).add(reminderId);
        
        this.saveReminders();

        console.log(`⏰ Added reminder for user ${userId} - keyword: "${keyword}"`);
        
        // Don't emit immediate notification - the first alert was already sent in bot.js
        // Only schedule the next reminder

        // Schedule next reminder
        this.scheduleNextReminder(reminder);
    }

    /**
     * Schedule next reminder
     */
    scheduleNextReminder(reminder) {
        // Check status BEFORE scheduling
        if (reminder.status !== 'active') {
            console.log(`⏰ Not scheduling timer for ${reminder.reminderId} - status is "${reminder.status}"`);
            return;
        }
        
        const now = Date.now();
        const nextReminderTime = reminder.nextReminderAt.getTime();
        const delay = Math.max(0, nextReminderTime - now);

        // Cancel any existing timer for this reminder
        this.cancelReminderTimer(reminder.reminderId);

        // Schedule new timer and store its ID
        const timerId = setTimeout(() => {
            // Prevent race condition - check if we're already executing
            if (this.reminderExecuting.get(reminder.reminderId)) {
                console.log(`⏰ Reminder already executing for ${reminder.reminderId}, skipping`);
                return;
            }

            // Mark as executing
            this.reminderExecuting.set(reminder.reminderId, true);
            
            try {
                // STATE CHECK - If not active, stop silently
                const currentReminder = this.reminders.get(reminder.reminderId);
                if (!currentReminder) {
                    console.log(`⏰ Reminder ${reminder.reminderId} not found - stopping`);
                    return;
                }
                
                // CRITICAL: Check status BEFORE doing anything
                if (currentReminder.status !== 'active') {
                    console.log(`⏰ Reminder ${reminder.reminderId} status is "${currentReminder.status}" - stopping`);
                    this.removeReminderByUserId(currentReminder.userId, reminder.reminderId);
                    return;
                }

                // Increment reminder count
                currentReminder.reminderCount++;
                
                // Check if we've hit the max
                if (currentReminder.reminderCount >= this.maxReminders) {
                    console.log(`⏰ Maximum reminders reached for ${reminder.reminderId} - marking completed`);
                    currentReminder.status = 'completed';
                    this.saveReminders();
                    this.removeReminderByUserId(currentReminder.userId, reminder.reminderId);
                    return;
                }

                // Send reminder
                this.emit('sendReminder', currentReminder);
                
                // Schedule next reminder (only if still active)
                if (currentReminder.status === 'active') {
                    const nextInterval = currentReminder.reminderIntervals[currentReminder.reminderCount - 1];
                    if (nextInterval) {
                        currentReminder.nextReminderAt = new Date(Date.now() + nextInterval);
                        this.saveReminders();
                        this.scheduleNextReminder(currentReminder);
                    }
                }
            } finally {
                // Always clear the executing flag
                this.reminderExecuting.delete(reminder.reminderId);
            }
        }, delay);

        this.reminderTimers.set(reminder.reminderId, timerId);
    }

    /**
     * Cancel reminder timer for a user
     */
    cancelReminderTimer(reminderId) {
        const timerId = this.reminderTimers.get(reminderId);
        if (timerId) {
            clearTimeout(timerId);
            this.reminderTimers.delete(reminderId);
            this.reminderExecuting.delete(reminderId); // Also clear executing flag
            console.log(`⏰ Cancelled reminder timer for ${reminderId}`);
        }
    }

    /**
     * Acknowledge a reminder (stop all reminders for user)
     */
    acknowledgeReminder(userId) {
        const reminderIds = this.activeReminders.get(userId);
        
        if (!reminderIds || reminderIds.size === 0) {
            console.log(`✅ User ${userId} pressed /ok but no active reminder found`);
            return {
                hasActive: false,
                summary: "✅ No active reminders to acknowledge"
            };
        }
        
        const summary = {
            hasActive: true,
            active: [],
            overridden: [],
            expired: []
        };
        
        // Find ALL reminders for this user since last acknowledgment
        const lastAckTime = this.lastAcknowledgedTime.get(userId) || 0;
        const now = Date.now();
        
        console.log(`🔍 Searching for reminders for user ${userId}, lastAckTime: ${lastAckTime}, now: ${now}`);
        console.log(`📋 Total reminders in Map: ${this.reminders.size}`);
        console.log(`📋 Active reminders for user: ${(this.activeReminders.get(userId) || new Set()).size}`);
        
        // Process reminders from activeReminders Set first (current active reminders)
        const activeReminderIds = this.activeReminders.get(userId) || new Set();
        
        // Also check ALL reminders in the Map to find overridden/completed ones
        const allRemindersForUser = new Set();
        
        // Add active reminders
        activeReminderIds.forEach(reminderId => {
            allRemindersForUser.add(reminderId);
        });
        
        // Add any other reminders for this user from the reminders Map
        for (const [reminderId, reminder] of this.reminders.entries()) {
            if (reminder.userId !== userId) continue;
            allRemindersForUser.add(reminderId);
        }
        
        console.log(`📋 Total unique reminders for user: ${allRemindersForUser.size}`);
        
        // Process all reminders for this user
        for (const reminderId of allRemindersForUser) {
            const reminder = this.reminders.get(reminderId);
            if (!reminder) continue;
            
            // Only include reminders created since last acknowledgment
            const reminderTime = reminder.firstDetectedAt.getTime();
            if (reminderTime < lastAckTime) continue;
            
            // Categorize by status
            if (reminder.status === 'active') {
                // Acknowledge active reminders
                reminder.status = 'acknowledged';
                this.cancelReminderTimer(reminderId);
                summary.active.push({
                    type: reminder.isGlobal ? 'Global' : 'Personal',
                    keyword: reminder.keyword
                });
                summary.hasActive = true;
                
                // Store the keyword to prevent future reminders
                if (!this.acknowledgedKeywords.has(userId)) {
                    this.acknowledgedKeywords.set(userId, new Set());
                }
                this.acknowledgedKeywords.get(userId).add(reminder.keyword);
            } else if (reminder.status === 'overridden') {
                // Include in summary but don't change status
                summary.overridden.push({
                    type: reminder.isGlobal ? 'Global' : 'Personal',
                    keyword: reminder.keyword
                });
            } else if (reminder.status === 'completed') {
                // Include in summary but don't change status
                summary.expired.push({
                    type: reminder.isGlobal ? 'Global' : 'Personal',
                    keyword: reminder.keyword
                });
            }
        }
        
        // Update last acknowledged time
        this.lastAcknowledgedTime.set(userId, now);
        this.saveReminders();
        
        // Generate summary message
        if (!summary.hasActive && summary.overridden.length === 0 && summary.expired.length === 0) {
            return {
                hasActive: false,
                summary: "✅ No active reminders to acknowledge"
            };
        }
        
        const summaryText = this.formatAcknowledgmentSummary(summary);
        console.log(`✅ User ${userId} acknowledged: ${summaryText}`);
        
        return summary;
    }
    
    formatAcknowledgmentSummary(summary) {
        if (!summary.hasActive) {
            return summary.summary;
        }
        
        let message = "🟢 **Active reminders stopped:**\n";
        
        if (summary.active.length > 0) {
            summary.active.forEach(r => {
                message += `• ${r.type}: "${r.keyword}"\n`;
            });
        } else {
            message += "• None\n";
        }
        
        if (summary.overridden.length > 0) {
            message += "\n⚪ **Override reminders (canceled early):**\n";
            summary.overridden.forEach(r => {
                message += `• ${r.type}: "${r.keyword}"\n`;
            });
        }
        
        if (summary.expired.length > 0) {
            message += "\n🔴 **Expired reminders (completed schedule):**\n";
            summary.expired.forEach(r => {
                message += `• ${r.type}: "${r.keyword}"\n`;
            });
        }
        
        return message;
    }
    
    /**
     * Remove reminder by userId (clears the activeReminders mapping)
     */
    removeReminderByUserId(userId, reminderId) {
        const reminderIds = this.activeReminders.get(userId);
        if (reminderIds && reminderId) {
            reminderIds.delete(reminderId);
            // Clean up empty Set
            if (reminderIds.size === 0) {
                this.activeReminders.delete(userId);
            }
        }
    }

    /**
     * Remove reminder for a user
     */
    removeReminder(userId, keepAcknowledgedKeyword = false) {
        // Cancel any pending timers
        this.cancelReminderTimer(userId);
        
        if (this.reminders.has(userId)) {
            const reminder = this.reminders.get(userId);
            
            // Only clear acknowledged keyword tracking if we want to (default is clear it)
            // When called from acknowledgeReminder, we want to KEEP the keyword so future reminders are blocked
            if (!keepAcknowledgedKeyword && this.acknowledgedKeywords.has(userId)) {
                this.acknowledgedKeywords.get(userId).delete(reminder.keyword);
                // Clean up empty Set
                if (this.acknowledgedKeywords.get(userId).size === 0) {
                    this.acknowledgedKeywords.delete(userId);
                }
            }
            
            this.reminders.delete(userId);
            this.saveReminders();
        }
    }

    /**
     * Get active reminders for a user (returns first active, or all)
     */
    getReminders(userId) {
        const reminderIds = this.activeReminders.get(userId);
        if (reminderIds && reminderIds.size > 0) {
            // Return the first active reminder (for backward compatibility)
            for (const reminderId of reminderIds) {
                const reminder = this.reminders.get(reminderId);
                if (reminder && reminder.status === 'active') {
                    return reminder;
                }
            }
        }
        return null;
    }
    
    /**
     * Get all active reminders for a user
     */
    getAllRemindersForUser(userId) {
        const reminderIds = this.activeReminders.get(userId);
        if (!reminderIds) return [];
        
        const reminders = [];
        for (const reminderId of reminderIds) {
            const reminder = this.reminders.get(reminderId);
            if (reminder) {
                reminders.push(reminder);
            }
        }
        return reminders;
    }

    /**
     * Get all active reminders
     */
    getAllReminders() {
        return Array.from(this.reminders.values());
    }

    /**
     * Check if user pressed /ok recently
     */
    hasRecentlyAcknowledged(userId, maxSeconds = 60) {
        if (!this.acknowledgedTime.has(userId)) {
            return false;
        }
        const acknowledgedTimestamp = this.acknowledgedTime.get(userId);
        const timeSinceAcknowledged = Date.now() - acknowledgedTimestamp;
        return timeSinceAcknowledged < (maxSeconds * 1000);
    }

    /**
     * Check if user has pending reminder
     */
    hasReminder(userId) {
        return this.reminders.has(userId) && !this.reminders.get(userId).acknowledged;
    }

    /**
     * Reset reminder for same keyword (restart timer)
     */
    resetReminderForKeyword(userId, keyword, message, sender, group, messageId, phoneNumber, attachment, isGlobal = false) {
        const existingReminder = this.reminders.get(userId);
        
        // If same keyword detected again AND not acknowledged, restart the timer
        if (existingReminder && existingReminder.keyword === keyword && !existingReminder.acknowledged) {
            console.log(`🔄 Restarting reminder for user ${userId} - same keyword detected again`);
            this.addReminder(userId, keyword, message, sender, group, messageId, phoneNumber, attachment, isGlobal);
            return true;
        }
        
        // If same keyword is acknowledged, respect the user's choice and don't restart
        if (existingReminder && existingReminder.keyword === keyword && existingReminder.acknowledged) {
            console.log(`⏰ User ${userId} already acknowledged reminder for keyword: "${keyword}" - not restarting`);
            return false;
        }
        
        return false;
    }
}

module.exports = ReminderManager;

