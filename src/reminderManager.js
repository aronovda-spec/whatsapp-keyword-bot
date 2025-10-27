const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const { logError, logBotEvent } = require('./logger');

class ReminderManager extends EventEmitter {
    constructor() {
        super();
        this.reminders = new Map(); // userId → array of active reminders
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
                
                // Restore reminder timers
                for (const [userId, reminders] of Object.entries(savedReminders)) {
                    this.reminders.set(userId, reminders.map(reminder => ({
                        ...reminder,
                        nextReminderAt: new Date(reminder.nextReminderAt)
                    })));
                }
                
                console.log(`📋 Loaded ${this.reminders.size} active reminder(s)`);
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
            nextReminderAt: new Date(Date.now() + 60000), // 1 minute
            reminderCount: 0,
            acknowledged: false,
            reminderIntervals: [
                60000,   // 1 min
                60000,   // 2 min (1 more minute)
                780000,  // 15 min (13 more minutes)
                2700000  // 1 hour (45 more minutes)
            ]
        };

        this.reminders.set(userId, reminder);
        this.saveReminders();

        console.log(`⏰ Added reminder for user ${userId} - keyword: "${keyword}"`);
        
        // Emit immediate notification
        this.emit('sendReminder', reminder);

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

        setTimeout(() => {
            // Check if still active
            const currentReminder = this.reminders.get(reminder.userId);
            if (!currentReminder || currentReminder.acknowledged) {
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
            
            // Schedule next reminder
            const nextInterval = currentReminder.reminderIntervals[currentReminder.reminderCount - 1];
            if (nextInterval) {
                currentReminder.nextReminderAt = new Date(Date.now() + nextInterval);
                this.saveReminders();
                this.scheduleNextReminder(currentReminder);
            }
        }, delay);
    }

    /**
     * Acknowledge a reminder (stop all reminders for user)
     */
    acknowledgeReminder(userId) {
        const reminder = this.reminders.get(userId);
        if (reminder) {
            console.log(`✅ User ${userId} acknowledged reminder - stopping all reminders`);
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

