const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const { logError, logBotEvent } = require('./logger');

class ReminderManager extends EventEmitter {
    constructor() {
        super();
        this.reminders = new Map(); // userId → reminder object
        this.reminderTimers = new Map(); // userId → timeout ID
        this.reminderExecuting = new Map(); // userId → is executing (to prevent race conditions)
        this.reminderStates = new Map(); // userId → 'active' | 'acknowledged' | 'cancelled' (STATE-DRIVEN!)
意思是this.reminderCounter = 0; // For unique reminder IDs
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
        
        // Check if there's an existing reminder for this user
        const existingReminder = this.reminders.get(userId);
        
        // If there's an existing reminder for the same keyword and it's acknowledged, 
        // respect the user's choice and don't start a new reminder sequence
        if (existingReminder && existingReminder.keyword === keyword && existingReminder.acknowledged) {
            console.log(`⏰ User ${userId} already acknowledged reminder for keyword: "${keyword}" - not starting new reminder`);
            return;
        }
        
        // Remove any existing reminders for this user to prevent duplicates
        this.reminders.delete(userId);

        // Generate unique reminder ID
        this.reminderCounter++;
        const reminderId = `${userId}-${keyword}-${this.reminderCounter}-${Date.now()}`;
        
        const reminder = {
            id: reminderId, // UNIQUE ID for this reminder
            userId,
            keyword,
            message,
            sender,
            group,
            messageId,
            phoneNumber,
            attachment,
            isGlobal, // Flag to indicate if this is a global keyword reminder
            firstDetectedAt: new Date(),
            nextReminderAt: new Date(Date.now() + 60000), // First reminder in 1 minute Cork reminderCount: 0,
            acknowledged: false,
            reminderIntervals: [
                60000,   // 1 min (second reminder, 1 more minute)
                780000,  // 15 min (third reminder, 13 more minutes)
                2700000  // 1 hour (fourth reminder, 45 more minutes)
            ]
        };
        
        // Set initial state to 'active'
        this.reminderStates.set(userId, 'active');

        this.reminders.set(userId, reminder);
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
        // Check reminder state FIRST - if not active, completion →
        const state = this.reminderStates.get(reminder.userId);
        if (state !== 'active') {
            console.log(`⏰ Not scheduling timer for user ${reminder.userId} - reminder state is '${state}'`);
            return;
        }
        
        const now = Date.now();
        const nextReminderTime = reminder.nextReminderAt.getTime();
        const delay = Math.max(0, nextReminderTime - now);

        // Cancel any existing timer for this user
        this.cancelReminderTimer(reminder.userId);

        // Schedule new timer and store its ID
        const timerId = setTimeout(() => {
            // Prevent race condition - check if we're already executing
            if (this.reminderExecuting.get(reminder.userId)) {
                console.log(`⏰ Reminder already executing for user ${reminder.userId}, skipping`);
                return;
            }

            // Mark as executing
            this.reminderExecuting.set(reminder.userId, true);
            
            try {
                // STATE-DRIVEN CHECK: Check reminder state BEFORE doing anything
                const state = this.reminderStates.get(reminder.userId);
                if (state !== 'active') {
                    console.log(`⏰ Reminder state is '${state}' for user ${reminder.userId} - stopping`);
                    this.removeReminder(reminder.userId);
                    return;
                }
                
                // Check if still active
                const currentReminder = this.reminders.get step.userId);
                if (!currentReminder) {
                    console.log(`⏰ Reminder not found for user ${reminder.userId} - stopping`);
                    return;
                }

                // Increment reminder count
                currentReminder.reminderCount++;
                
                // Check if we've hit the max
                if (currentReminder.reminderCount >= this.maxReminders) {
                    console.log(`⏰ Maximum reminders reached for user ${reminder.userId} - stopping`);
                    this.removeReminder(reminder.userId);
                    return;
                }

                // Send reminder
                this.emit('sendReminder', currentReminder);
                
                // Schedule next reminder (only if not acknowledged)
                if (!currentReminder.acknowledged) {
                    const nextInterval = currentReminder.reminderIntervals[currentReminder.reminderCount - 1];
                    if (nextInterval) {
                        currentReminder.nextReminderAt = new Date(Date.now() + nextInterval);
                        this.saveReminders();
                        this.scheduleNextReminder(currentReminder);
                    }
                }
            } finally {
                // Always clear the executing flag
                this.reminderExecuting.delete(reminder.userId);
            }
        }, delay);

        this.reminderTimers.set(reminder.userId, timerId);
    }

    /**
     * Cancel reminder timer for a user
     */
    cancelReminderTimer(userId) {
        const timerId = this.reminderTimers.get(userId);
        if (timerId) {
            clearTimeout(timerId);
            this.reminderTimers.delete(userId);
            this.reminderExecuting.delete(userId); // Also clear executing flag
            console.log(`⏰ Cancelled reminder timer for user ${userId}`);
        }
    }

    /**
     * Acknowledge a reminder (stop all reminders for user)
     */
    acknowledgeReminder(userId) {
        // STATE-DRIVEN: Set state to 'acknowledged' - this is the KEY!
        this.reminderStates.set(userId, 'acknowledged');
        
        const reminder = this.reminders.get(userId);
        
        // Always cancel pending timers
        this.cancelReminderTimer(userId);
        
        if (reminder) {
            console.log(`✅ User ${userId} acknowledged reminder - state set to 'acknowledged'`);
            
            // REMOVE the reminder completely
            this.removeReminder(userId, true);
            
            return true;
        }
        
        console.log(`✅ User ${userId} cancelled pending reminder`);
        return false;
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
     * Get active reminders for a user
     */
    getReminders(userId) {
        return this.reminders.get(userId);
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

