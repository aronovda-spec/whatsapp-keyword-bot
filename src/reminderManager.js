const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const { logError, logBotEvent } = require('./logger');

class ReminderManager extends EventEmitter {
    constructor() {
        super();
        this.reminders = new Map(); // userId → array of active reminders
        this.reminderTimers = new Map(); // userId → timeout ID
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
        const now = Date.now();
        const nextReminderTime = reminder.nextReminderAt.getTime();
        const delay = Math.max(0, nextReminderTime - now);

        // Cancel any existing timer for this user
        this.cancelReminderTimer(reminder.userId);

        // Schedule new timer and store its ID
        const timerId = setTimeout(() => {
            // Check if still active
            const currentReminder = this.reminders.get(reminder.userId);
            if (!currentReminder || currentReminder.acknowledged) {
                console.log(`⏰ Reminder cancelled or acknowledged for user ${reminder.userId}`);
                this.reminderTimers.delete(reminder.userId);
                return;
            }

            // Increment reminder count
            currentReminder.reminderCount++;
            
            // Check if we've hit the max
            if (currentReminder.reminderCount >= this.maxReminders) {
                console.log(`⏰ Maximum reminders reached for user ${reminder.userId} - stopping`);
                this.reminderTimers.delete(reminder.userId);
                this.removeReminder(reminder.userId);
                return;
            }

            // Send reminder
            this.emit('sendReminder', currentReminder);
            
            // Schedule next reminder
            const nextInterval = currentReminder.reminderIntervals[currentReminder.reminderCount - 1];
            if (nextInterval) {
                currentReminder.nextReminderAt = new Date(Date.now() + nextInterval);
                this.saveReminders();
                this.scheduleNextReminder(currentReminder);
            } else {
                this.reminderTimers.delete(reminder.userId);
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
            console.log(`⏰ Cancelled reminder timer for user ${userId}`);
        }
    }

    /**
     * Acknowledge a reminder (stop all reminders for user)
     */
    acknowledgeReminder(userId) {
        const reminder = this.reminders.get(userId);
        if (reminder) {
            console.log(`✅ User ${userId} acknowledged reminder - stopping all reminders`);
            // Cancel any pending timers
            this.cancelReminderTimer(userId);
            // Mark as acknowledged to prevent scheduled timers from firing
            reminder.acknowledged = true;
            this.removeReminder(userId);
            return true;
        }
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
        
        // If same keyword detected again, restart the timer
        if (existingReminder && existingReminder.keyword === keyword) {
            console.log(`🔄 Restarting reminder for user ${userId} - same keyword detected again`);
            this.addReminder(userId, keyword, message, sender, group, messageId, phoneNumber, attachment, isGlobal);
            return true;
        }
        
        return false;
    }
}

module.exports = ReminderManager;

