const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const { logError, logBotEvent } = require('./logger');

class ReminderManager extends EventEmitter {
    constructor() {
        super();
        this.reminders = new Map(); // userId → array of active reminders
        this.reminderTimers = new Map(); // userId → timeout ID
        this.reminderExecuting = new Map(); // userId → is executing (to prevent race conditions)
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

        const reminder = {
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
            nextReminderAt: new Date(Date.now() + 60000), // First reminder in 1 minute
            reminderCount: 0,
            acknowledged: false,
            reminderIntervals: [
                60000,   // 1 min (second reminder, 1 more minute)
                780000,  // 15 min (third reminder, 13 more minutes)
                2700000  // 1 hour (fourth reminder, 45 more minutes)
            ]
        };

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
        // Check if this reminder is already acknowledged - don't schedule
        if (reminder.acknowledged) {
            console.log(`⏰ Not scheduling timer for user ${reminder.userId} - reminder already acknowledged`);
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
                // Check if still active
                const currentReminder = this.reminders.get(reminder.userId);
                if (!currentReminder) {
                    console.log(`⏰ Reminder not found for user ${reminder.userId} - stopping`);
                    return;
                }
                
                // Check if acknowledged
                if (currentReminder.acknowledged) {
                    console.log(`⏰ Reminder already acknowledged for user ${reminder.userId} - stopping`);
                    // Clean up the acknowledged reminder
                    this.removeReminder(reminder.userId);
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
        const reminder = this.reminders.get(userId);
        
        // Always cancel pending timers, even if reminder doesn't exist
        this.cancelReminderTimer(userId);
        
        if (reminder) {
            console.log(`✅ User ${userId} acknowledged reminder - stopping all reminders`);
            // Mark as acknowledged to prevent scheduled timers from firing
            reminder.acknowledged = true;
            // DON'T remove the reminder - just mark it as acknowledged
            // This way if the same keyword is detected again, it won't restart reminders
            this.saveReminders();
            return true;
        }
        
        // Timer was cancelled but no reminder found
        console.log(`✅ User ${userId} cancelled pending reminder timer`);
        return false;
    }

    /**
     * Remove reminder for a user
     */
    removeReminder(userId) {
        // Cancel any pending timers
        this.cancelReminderTimer(userId);
        
        if (this.reminders.has(userId)) {
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

