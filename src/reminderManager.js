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
        this.acknowledgedTime = new Map(); // userId → timestamp when /ok was pressed
        this.lastOkAt = new Map(); // userId → timestamp when /ok was last pressed (for tracking history)
        // NOTE: acknowledgedKeywords Set removed - we check reminders Map directly for acknowledged status (saves memory)
        this.reminderIdCounter = 0; // Counter for unique reminder IDs
        this.storagePath = path.join(__dirname, '../config/active-reminders.json');
        this.maxReminders = 7; // 0 min, 1 min, 2 min, 5 min, 15 min, 60 min, 90 min
        this.weeklyResetTimer = null; // Timer for weekly acknowledged reminders reset
        this.loadReminders();
        this.scheduleWeeklyReset(); // Start weekly reset schedule
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
            for (const [reminderId, reminder] of this.reminders) {
                // Store by reminderId (the actual key)
                remindersObj[reminderId] = reminder;
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
        
        // Check if user recently pressed /ok (within last 2 seconds - race condition protection)
        const userIdStr = userId.toString();
        if (this.acknowledgedTime.has(userIdStr)) {
            const acknowledgedTimestamp = this.acknowledgedTime.get(userIdStr);
            const timeSinceAcknowledged = Date.now() - acknowledgedTimestamp;
            if (timeSinceAcknowledged < 2000) { // 2 seconds - user likely still watching bot screen
                console.log(`⏰ User ${userId} recently pressed /ok (${Math.round(timeSinceAcknowledged/1000)}s ago) - not starting new reminder`);
                return;
            }
            // Clean up old acknowledgments (older than 2 seconds)
            this.acknowledgedTime.delete(userIdStr);
        }
        
        // Check if user has acknowledged this keyword (search reminders Map - no need for separate Set)
        // Once acknowledged, keyword is permanently blocked - check reminders directly
        const hasAcknowledgedKeyword = Array.from(this.reminders.values()).some(r => 
            r.userId.toString() === userIdStr && 
            r.keyword === keyword && 
            r.status === 'acknowledged'
        );
        if (hasAcknowledgedKeyword) {
                console.log(`⏰ User ${userId} already acknowledged keyword: "${keyword}" - not starting new reminder`);
                return;
        }
        
        // Check if there's an existing reminder for this user using the new system
        const existingReminderId = this.activeReminders.get(userIdStr);
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
            
            // Mark the existing reminder as 'cancelled' (overridden) with timestamp
            if (existingReminder && existingReminder.status === 'active') {
                existingReminder.status = 'cancelled';
                existingReminder.cancelledAt = new Date();
                this.saveReminders();
                console.log(`⏰ Marked reminder ${existingReminderId} as 'cancelled' (overridden by new keyword)`);
            }
            // DON'T delete from activeReminders - we'll update it with new reminderId
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
                60000,    // R1→R2: +1 min (2 min total)
                180000,   // R2→R3: +3 min (5 min total)
                600000,   // R3→R4: +10 min (15 min total)
                2700000,  // R4→R5: +45 min (60 min total)
                1800000   // R5→R6: +30 min (90 min total)
            ]
        };

        // Store by reminderId for unique access
        this.reminders.set(reminderId, reminder);
        this.activeReminders.set(userIdStr, reminderId); // Fast user lookup (use string key for consistency)
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
                    currentReminder.completedAt = new Date();
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
        console.log(`🔍 acknowledgeReminder START for user ${userId} (type: ${typeof userId})`);
        console.log(`🔍 activeReminders Map size: ${this.activeReminders.size}`);
        console.log(`🔍 activeReminders keys:`, Array.from(this.activeReminders.keys()));
        console.log(`🔍 activeReminders entries:`, Array.from(this.activeReminders.entries()));
        
        const userIdStr = userId.toString();
        const now = Date.now();
        
        // IMPORTANT: Set acknowledgedTime FIRST to protect against race conditions
        // This blocks new reminders immediately when /ok is pressed, before processing completes
        this.acknowledgedTime.set(userIdStr, now);
        
        const lastOkTimestamp = this.lastOkAt.get(userIdStr) || 0; // Get last /ok timestamp (0 = beginning of time)
        
        // Get all reminders for this user since last /ok
        const allUserReminders = Array.from(this.reminders.values()).filter(r => {
            if (r.userId.toString() !== userIdStr) return false;
            const reminderTime = new Date(r.firstDetectedAt).getTime();
            return reminderTime >= lastOkTimestamp;
        });
        
        // Categorize reminders
        const activeReminder = allUserReminders.find(r => r.status === 'active');
        const cancelledReminders = allUserReminders.filter(r => r.status === 'cancelled');
        const completedReminders = allUserReminders.filter(r => r.status === 'completed');
        
        const reminderId = this.activeReminders.get(userIdStr);
        console.log(`🔍 Looking up key: "${userIdStr}" (type: ${typeof userIdStr})`);
        console.log(`🔍 Found reminderId: ${reminderId}`);
        console.log(`🔍 Found ${allUserReminders.length} reminders since last /ok: ${activeReminder ? 1 : 0} active, ${cancelledReminders.length} cancelled, ${completedReminders.length} completed`);
        
        // FULL RESET: Mark ALL reminders (active, cancelled, completed) as acknowledged
        // This ensures they never trigger again and clears all timers
        
        // Build summary message
        let summary = '';
        const activeKeywords = [];
        const cancelledKeywords = [];
        const completedKeywords = [];
        
        // Process ACTIVE reminder - acknowledge and stop
        // Safety check: If reminderId exists in activeReminders but not in filtered list, still acknowledge it
        if (reminderId) {
            const reminder = this.reminders.get(reminderId);
            // Double-check: verify it's the same user and active status
            if (reminder && reminder.userId.toString() === userIdStr && reminder.status === 'active') {
                // Check if it was already in activeKeywords (from activeReminder match)
                const alreadyProcessed = activeReminder && activeReminder.reminderId === reminderId;
                
                if (!alreadyProcessed) {
                    console.log(`✅ User ${userId} acknowledging ACTIVE reminder ${reminderId} (safety check - not in filtered list) - stopping timers`);
                } else {
                    console.log(`✅ User ${userId} acknowledging ACTIVE reminder ${reminderId} - stopping timers`);
                }
                
                // Mark as acknowledged
                reminder.status = 'acknowledged';
                reminder.acknowledgedAt = new Date();
                
                // Cancel any pending timers
                this.cancelReminderTimer(reminderId);
                
                // Keyword is now permanently blocked (status='acknowledged' checked in addReminder)
                
                // Add to keywords only if not already added
                if (!activeKeywords.includes(`"${reminder.keyword}"`)) {
                    activeKeywords.push(`"${reminder.keyword}"`);
                }
            }
        }
        
        // Defensive check: Process activeReminder if it exists and wasn't already processed
        // (handles edge case where activeReminder exists but reminderId is null or different)
        if (activeReminder && (!reminderId || activeReminder.reminderId !== reminderId)) {
            console.log(`✅ User ${userId} acknowledging ACTIVE reminder ${activeReminder.reminderId} (from filtered list, not in activeReminders Map) - stopping timers`);
            
            // Mark as acknowledged
            activeReminder.status = 'acknowledged';
            activeReminder.acknowledgedAt = new Date();
            
            // Cancel any pending timers
            this.cancelReminderTimer(activeReminder.reminderId);
            
            // Add to keywords only if not already added
            if (!activeKeywords.includes(`"${activeReminder.keyword}"`)) {
                activeKeywords.push(`"${activeReminder.keyword}"`);
            }
        }
        
        // Process CANCELLED reminders - convert to acknowledged
        cancelledReminders.forEach(r => {
            console.log(`✅ User ${userId} acknowledging CANCELLED reminder ${r.reminderId} - marking as acknowledged`);
            
            // Mark as acknowledged (even though it was cancelled)
            r.status = 'acknowledged';
            r.acknowledgedAt = new Date();
            
            // Cancel any pending timers (shouldn't have any, but be safe)
            this.cancelReminderTimer(r.reminderId);
            
            // Collect for summary (deduplicate)
            if (!cancelledKeywords.includes(`"${r.keyword}"`)) {
                cancelledKeywords.push(`"${r.keyword}"`);
            }
        });
                
        // Process COMPLETED reminders - convert to acknowledged
        completedReminders.forEach(r => {
            console.log(`✅ User ${userId} acknowledging COMPLETED reminder ${r.reminderId} - marking as acknowledged`);
            
            // Mark as acknowledged (even though it completed)
            r.status = 'acknowledged';
            r.acknowledgedAt = new Date();
            
            // Cancel any pending timers (shouldn't have any, but be safe)
            this.cancelReminderTimer(r.reminderId);
            
            // Collect for summary (deduplicate)
            if (!completedKeywords.includes(`"${r.keyword}"`)) {
                completedKeywords.push(`"${r.keyword}"`);
            }
        });
        
        // Build the summary message BEFORE deleting reminders
        if (activeKeywords.length > 0 || cancelledKeywords.length > 0 || completedKeywords.length > 0) {
            summary = '✅ <b>Reminder acknowledged and stopped.</b>\n\n';
            
            if (activeKeywords.length > 0) {
                summary += `🟢 <b>Active reminders stopped:</b> ${activeKeywords.join(', ')}\n`;
            }
            
            if (cancelledKeywords.length > 0) {
                summary += `⚪ <b>Override reminders (canceled early):</b> ${cancelledKeywords.join(', ')}\n`;
            }
            
            if (completedKeywords.length > 0) {
                summary += `🔴 <b>Expired reminders (completed schedule after 1 hour without /ok):</b> ${completedKeywords.join(', ')}\n`;
            }
        } else {
            console.log(`✅ User ${userId} pressed /ok but no reminders found since last /ok`);
            summary = '✅ <b>No active reminders to acknowledge</b>';
        }
        
        // IMPORTANT: Delete ALL acknowledged reminders immediately after building summary
        // This prevents permanent keyword blocking - keywords can trigger again immediately
        const acknowledgedReminderIdsToDelete = [];
        
        // Collect all acknowledged reminders from allUserReminders
        for (const r of allUserReminders) {
            if (r.status === 'acknowledged') {
                acknowledgedReminderIdsToDelete.push(r.reminderId);
            }
        }
        
        // Also check reminderId directly (if processed via safety check)
        if (reminderId) {
            const reminder = this.reminders.get(reminderId);
            if (reminder && reminder.status === 'acknowledged') {
                if (!acknowledgedReminderIdsToDelete.includes(reminderId)) {
                    acknowledgedReminderIdsToDelete.push(reminderId);
                }
            }
        }
        
        // Delete all acknowledged reminders from Map
        let deletedCount = 0;
        for (const reminderIdToDelete of acknowledgedReminderIdsToDelete) {
            this.reminders.delete(reminderIdToDelete);
            
            // Also remove from activeReminders if it's the current active reminder
            if (reminderIdToDelete === reminderId) {
                this.activeReminders.delete(userIdStr);
            }
            
            deletedCount++;
            console.log(`🗑️ Deleted acknowledged reminder ${reminderIdToDelete} - keyword can trigger again`);
        }
        
        // Save changes (reminders deleted from memory)
        if (deletedCount > 0 || activeKeywords.length > 0 || cancelledKeywords.length > 0 || completedKeywords.length > 0) {
            this.saveReminders();
        }
        
        // Update lastOkAt timestamp
        this.lastOkAt.set(userIdStr, now);
        
        // NOTE: acknowledgedTime was already set at the beginning of this function for race condition protection
        
        console.log(`✅ Acknowledged ${deletedCount} reminders and deleted them - keywords are no longer blocked`);
        
        return {
            hasActive: activeKeywords.length > 0,
            summary: summary
        };
    }
    
    /**
     * Remove reminder by userId (clears the activeReminders mapping)
     */
    removeReminderByUserId(userId) {
        const userIdStr = userId.toString();
        const reminderId = this.activeReminders.get(userIdStr);
        if (reminderId) {
            this.activeReminders.delete(userIdStr);
            // Note: Don't delete from reminders Map, let it expire
        }
    }

    /**
     * Remove reminder for a user
     */
    removeReminder(userId, keepAcknowledgedKeyword = false) {
        const userIdStr = userId.toString();
        const reminderId = this.activeReminders.get(userIdStr);
        if (!reminderId) {
            return;
        }
        
        // Cancel any pending timers
        this.cancelReminderTimer(reminderId);
        
        const reminder = this.reminders.get(reminderId);
        if (reminder) {
            // NOTE: No need to manage acknowledgedKeywords Set anymore
            // Acknowledged status is tracked directly in reminders Map
            
            this.reminders.delete(reminderId);
            this.activeReminders.delete(userIdStr);
            this.saveReminders();
        }
    }

    /**
     * Get active reminder for a user
     */
    getReminders(userId) {
        const userIdStr = userId.toString();
        const reminderId = this.activeReminders.get(userIdStr);
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
        const userIdStr = userId.toString();
        if (!this.acknowledgedTime.has(userIdStr)) {
            return false;
        }
        const acknowledgedTimestamp = this.acknowledgedTime.get(userIdStr);
        const timeSinceAcknowledged = Date.now() - acknowledgedTimestamp;
        return timeSinceAcknowledged < (maxSeconds * 1000);
    }

    /**
     * Check if user has pending reminder
     */
    hasReminder(userId) {
        const userIdStr = userId.toString();
        const reminderId = this.activeReminders.get(userIdStr);
        if (!reminderId) return false;
        const reminder = this.reminders.get(reminderId);
        return reminder && reminder.status === 'active';
    }

    /**
     * Reset reminder for same keyword (restart timer)
     */
    resetReminderForKeyword(userId, keyword, message, sender, group, messageId, phoneNumber, attachment, isGlobal = false) {
        console.log(`🔍 resetReminderForKeyword called for user ${userId}, keyword "${keyword}"`);
        const userIdStr = userId.toString();
        const existingReminderId = this.activeReminders.get(userIdStr);
        const existingReminder = existingReminderId ? this.reminders.get(existingReminderId) : null;
        
        // If same keyword detected again AND not acknowledged, restart the timer
        if (existingReminder && existingReminder.keyword === keyword && existingReminder.status !== 'acknowledged') {
            console.log(`🔄 Restarting reminder for user ${userId} - same keyword detected again`);
            this.addReminder(userId, keyword, message, sender, group, messageId, phoneNumber, attachment, isGlobal);
            return true;
        }
        
        // If same keyword is acknowledged, respect the user's choice and don't restart
        if (existingReminder && existingReminder.keyword === keyword && existingReminder.status === 'acknowledged') {
            console.log(`⏰ User ${userId} already acknowledged reminder for keyword: "${keyword}" - not restarting`);
            return false;
        }
        
        return false;
    }

    /**
     * Clear all acknowledged reminders from memory (weekly reset)
     * This frees memory and allows previously acknowledged keywords to trigger new reminders
     */
    clearAcknowledgedReminders() {
        console.log(`🧹 Starting weekly reset: Clearing acknowledged reminders from memory...`);
        
        let clearedCount = 0;
        const acknowledgedReminderIds = [];
        
        // Find all acknowledged reminders
        for (const [reminderId, reminder] of this.reminders) {
            if (reminder.status === 'acknowledged') {
                acknowledgedReminderIds.push(reminderId);
            }
        }
        
        // Remove acknowledged reminders from Map
        for (const reminderId of acknowledgedReminderIds) {
            this.reminders.delete(reminderId);
            // Also cancel any lingering timers (shouldn't exist, but be safe)
            this.cancelReminderTimer(reminderId);
            clearedCount++;
        }
        
        // Also clear old acknowledgedTime entries (older than 1 week) to free memory
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        let clearedTimeEntries = 0;
        for (const [userIdStr, timestamp] of this.acknowledgedTime) {
            if (timestamp < oneWeekAgo) {
                this.acknowledgedTime.delete(userIdStr);
                clearedTimeEntries++;
            }
        }
        
        // Also clear old lastOkAt entries (older than 1 week) to free memory
        let clearedOkEntries = 0;
        for (const [userIdStr, timestamp] of this.lastOkAt) {
            if (timestamp < oneWeekAgo) {
                this.lastOkAt.delete(userIdStr);
                clearedOkEntries++;
            }
        }
        
        // Save the cleaned state (removes acknowledged reminders from file)
        this.saveReminders();
        
        console.log(`✅ Weekly reset complete: Cleared ${clearedCount} acknowledged reminders, ${clearedTimeEntries} old acknowledgedTime entries, ${clearedOkEntries} old lastOkAt entries`);
        console.log(`💾 Reminders Map size: ${this.reminders.size}, Active reminders: ${this.activeReminders.size}`);
    }

    /**
     * Calculate next Saturday at 1:00 PM in local time
     */
    getNextSaturday1PM() {
        const now = new Date();
        const nextReset = new Date();
        
        // Set to Saturday 1:00 PM
        nextReset.setHours(13, 0, 0, 0);
        
        // Get current day of week (0 = Sunday, 6 = Saturday)
        const currentDay = now.getDay();
        const daysUntilSaturday = (6 - currentDay) % 7;
        
        if (daysUntilSaturday === 0) {
            // Today is Saturday
            if (now.getHours() >= 13) {
                // Already past 1 PM today, schedule for next Saturday
                nextReset.setDate(now.getDate() + 7);
            } else {
                // Before 1 PM today, schedule for today
                nextReset.setDate(now.getDate());
            }
        } else {
            // Not Saturday yet, schedule for upcoming Saturday
            nextReset.setDate(now.getDate() + daysUntilSaturday);
        }
        
        return nextReset;
    }

    /**
     * Schedule weekly reset of acknowledged reminders (every Saturday at 1:00 PM)
     * Runs silently without notifications
     */
    scheduleWeeklyReset() {
        // Clear any existing timer
        if (this.weeklyResetTimer) {
            clearTimeout(this.weeklyResetTimer);
        }
        
        const nextReset = this.getNextSaturday1PM();
        const delay = nextReset.getTime() - Date.now();
        
        console.log(`📅 Weekly reset scheduled for: ${nextReset.toLocaleString()} (in ${Math.round(delay / 1000 / 60 / 60)} hours)`);
        
        this.weeklyResetTimer = setTimeout(() => {
            // Clear acknowledged reminders (silent reset)
            this.clearAcknowledgedReminders();
            
            // Schedule next reset (7 days later)
            this.scheduleWeeklyReset();
        }, delay);
    }

    /**
     * Stop weekly reset schedule (for cleanup/shutdown)
     */
    stopWeeklyReset() {
        if (this.weeklyResetTimer) {
            clearTimeout(this.weeklyResetTimer);
            this.weeklyResetTimer = null;
            console.log(`📅 Weekly reset schedule stopped`);
        }
    }
}

module.exports = ReminderManager;

