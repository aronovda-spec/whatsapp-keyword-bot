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
        this.activeReminders = new Map(); // userId → reminderId (for fast lookup)
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
        console.log(`🔍 addReminder START for user ${userId}, keyword "${keyword}"`);
        
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
        
        // Check if there's an existing reminder for this user using the new system
        const existingReminderId = this.activeReminders.get(userId);
        if (existingReminderId) {
            console.log(`🔍 Found existing reminder ${existingReminderId} for user ${userId}`);
            const existingReminder = this.reminders.get(existingReminderId);
            // If existing reminder is for same keyword and acknowledged, skip
            if (existingReminder && existingReminder.keyword === keyword && existingReminder.status === 'acknowledged') {
                console.log(`⏰ User ${userId} already acknowledged reminder for keyword: "${keyword}" - not starting new reminder`);
                return;
            }
            // Cancel the existing reminder to prevent duplicates
            console.log(`🔍 Canceling existing reminder and replacing`);
            this.cancelReminderTimer(existingReminderId);
            this.activeReminders.delete(userId);
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
        this.activeReminders.set(userId, reminderId); // Fast user lookup
        this.saveReminders();

        console.log(`⏰ Added reminder for user ${userId} - keyword: "${keyword}"`);
        console.log(`🔍 About to call scheduleNextReminder for ${reminderId}`);
        
        // Don't emit immediate notification - the first alert was already sent in bot.js
        // Only schedule the next reminder

        // Schedule next reminder
        this.scheduleNextReminder(reminder);
        console.log(`🔍 ScheduleNextReminder called, addReminder END`);
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

        console.log(`⏰ Scheduling reminder for user ${reminder.userId}, keyword "${reminder.keyword}", delay: ${delay}ms (${Math.round(delay/1000)}s)`);

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
                    this.removeReminderByUserId(currentReminder.userId);
                    return;
                }

                console.log(`⏰ Sending reminder ${currentReminder.reminderCount + 1} for user ${currentReminder.userId}, keyword "${currentReminder.keyword}"`);
                
                // Increment reminder count
                currentReminder.reminderCount++;
                
                // Check if we've hit the max
                if (currentReminder.reminderCount >= this.maxReminders) {
                    console.log(`⏰ Maximum reminders reached for ${reminder.reminderId} - marking completed`);
                    currentReminder.status = 'completed';
                    this.saveReminders();
                    this.removeReminderByUserId(currentReminder.userId);
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
        const reminderId = this.activeReminders.get(userId);
        
        if (reminderId) {
            const reminder = this.reminders.get(reminderId);
            
            if (reminder) {
                console.log(`✅ User ${userId} acknowledged reminder ${reminderId} - stopping all reminders`);
                
                // CRITICAL: Set status to 'acknowledged' - this stops all timers
                reminder.status = 'acknowledged';
                this.saveReminders();
                
                // Cancel any pending timers
                this.cancelReminderTimer(reminderId);
                
                // Store the keyword to prevent future reminders
                if (!this.acknowledgedKeywords.has(userId)) {
                    this.acknowledgedKeywords.set(userId, new Set());
                }
                this.acknowledgedKeywords.get(userId).add(reminder.keyword);
                
                // Return object format expected by telegram-commands.js
                return {
                    hasActive: true,
                    summary: `✅ Reminder acknowledged and stopped. Keyword: "${reminder.keyword}"`
                };
            }
        }
        
        console.log(`✅ User ${userId} pressed /ok but no active reminder found`);
        return {
            hasActive: false,
            summary: "✅ No active reminders to acknowledge"
        };
    }
    
    /**
     * Remove reminder by userId (clears the activeReminders mapping)
     */
    removeReminderByUserId(userId) {
        const reminderId = this.activeReminders.get(userId);
        if (reminderId) {
            this.activeReminders.delete(userId);
            // Note: Don't delete from reminders Map, let it expire
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
     * Get active reminder for a user
     */
    getReminders(userId) {
        const reminderId = this.activeReminders.get(userId);
        if (reminderId) {
            return this.reminders.get(reminderId);
        }
        return null;
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
        console.log(`🔍 resetReminderForKeyword called for user ${userId}, keyword "${keyword}"`);
        const existingReminderId = this.activeReminders.get(userId);
        const existingReminder = existingReminderId ? this.reminders.get(existingReminderId) : null;
        
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

