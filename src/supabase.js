/**
 * Supabase Integration
 * Cloud database and storage for WhatsApp Bot
 */

const { createClient } = require('@supabase/supabase-js');

class SupabaseManager {
    constructor() {
        this.client = null;
        this.enabled = false;
        this.init();
    }

    init() {
        try {
            const url = process.env.SUPABASE_URL;
            const key = process.env.SUPABASE_KEY;
            const serviceKey = process.env.SUPABASE_SERVICE_KEY;

            if (!url || !key) {
                console.log('📊 Supabase: Not configured (optional). Using local file storage.');
                return;
            }

            // Use service key for storage forwarding, anon key for database queries
            this.client = createClient(url, key);
            
            // Create separate client for storage operations if service key is provided
            if (serviceKey) {
                this.storageClient = createClient(url, serviceKey);
            } else {
                this.storageClient = this.client; // Fallback to anon key
            }
            
            this.enabled = true;

            console.log('✅ Supabase: Connected to cloud database');
        } catch (error) {
            console.error('❌ Supabase initialization failed:', error.message);
        }
    }

    // Global Keywords Management
    async getGlobalKeywords() {
        if (!this.enabled) return null;

        try {
            const { data, error } = await this.client
                .from('global_keywords')
                .select('keyword')
                .eq('enabled', true);

            if (error) throw error;

            return data.map(row => row.keyword);
        } catch (error) {
            console.error('Supabase getGlobalKeywords error:', error.message);
            return null;
        }
    }

    async addGlobalKeyword(keyword, addedBy = 'system') {
        if (!this.enabled) return false;

        try {
            const { error } = await this.client
                .from('global_keywords')
                .upsert({
                    keyword: keyword,
                    enabled: true,
                    added_at: new Date().toISOString(),
                    added_by: addedBy
                });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Supabase addGlobalKeyword error:', error.message);
            return false;
        }
    }

    async removeGlobalKeyword(keyword) {
        if (!this.enabled) return false;

        try {
            const { error } = await this.client
                .from('global_keywords')
                .delete()
                .eq('keyword', keyword);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Supabase removeGlobalKeyword error:', error.message);
            return false;
        }
    }

    // User Management (Unified Users Table)
    async getUsers() {
        if (!this.enabled) return null;

        try {
            const { data, error } = await this.client
                .from('users')
                .select('*')
                .eq('active', true);

            if (error) throw error;

            return data;
        } catch (error) {
            console.error('Supabase getUsers error:', error.message);
            return null;
        }
    }

    // For backward compatibility
    async getAuthorizedUsers() {
        const users = await this.getUsers();
        if (!users) return null;
        
        // Map to old format
        return users.map(user => ({
            user_id: user.user_id,
            is_admin: user.is_admin || false
        }));
    }

    async addUser(userId, username = null, firstName = null, isAdmin = false, email = null) {
        if (!this.enabled) return false;

        try {
            const { error } = await this.client
                .from('users')
                .upsert({
                    user_id: userId.toString(),
                    username: username,
                    first_name: firstName,
                    is_admin: isAdmin,
                    email: email,
                    active: true,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Supabase addUser error:', error.message);
            return false;
        }
    }

    async addAuthorizedUser(userId, isAdmin = false) {
        return await this.addUser(userId, null, null, isAdmin, null);
    }

    async promoteToAdmin(userId) {
        if (!this.enabled) return false;

        try {
            const { error } = await this.client
                .from('users')
                .update({
                    is_admin: true,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId.toString());

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Supabase promoteToAdmin error:', error.message);
            return false;
        }
    }

    async demoteFromAdmin(userId) {
        if (!this.enabled) return false;

        try {
            const { error } = await this.client
                .from('users')
                .update({
                    is_admin: false,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId.toString());

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Supabase demoteFromAdmin error:', error.message);
            return false;
        }
    }

    async getUserEmail(userId) {
        if (!this.enabled) return null;

        try {
            const { data, error } = await this.client
                .from('users')
                .select('email')
                .eq('user_id', userId.toString())
                .single();

            if (error) {
                if (error.code === 'PGRST116') return null;
                throw error;
            }

            return data?.email || null;
        } catch (error) {
            console.error('Supabase getUserEmail error:', error.message);
            return null;
        }
    }

    // Personal Keywords
    async getPersonalKeywords(userId) {
        if (!this.enabled) return null;

        try {
            const { data, error } = await this.client
                .from('personal_keywords')
                .select('keywords')
                .eq('user_id', userId.toString())
                .single();

            if (error) {
                if (error.code === 'PGRST116') return null; // Not found
                throw error;
            }

            return data?.keywords || [];
        } catch (error) {
            console.error('Supabase getPersonalKeywords error:', error.message);
            return null;
        }
    }

    async setPersonalKeywords(userId, keywords) {
        if (!this.enabled) return false;

        try {
            const { error } = await this.client
                .from('personal_keywords')
                .upsert({
                    user_id: userId.toString(),
                    keywords: keywords,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Supabase setPersonalKeywords error:', error.message);
            return false;
        }
    }

    // Group Subscriptions
    async getGroupSubscriptions() {
        if (!this.enabled) return null;

        try {
            const { data, error } = await this.client
                .from('group_subscriptions')
                .select('*');

            if (error) throw error;

            // Convert to format: { "group_name": ["user_id1", "user_id2"] }
            const subscriptions = {};
            data.forEach(row => {
                if (!subscriptions[row.group_name]) {
                    subscriptions[row.group_name] = [];
                }
                subscriptions[row.group_name].push(row.user_id);
            });

            return subscriptions;
        } catch (error) {
            console.error('Supabase getGroupSubscriptions error:', error.message);
            return null;
        }
    }

    async addGroupSubscription(userId, groupName) {
        if (!this.enabled) return false;

        try {
            const { error } = await this.client
                .from('group_subscriptions')
                .insert({
                    user_id: userId.toString(),
                    group_name: groupName
                });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Supabase addGroupSubscription error:', error.message);
            return false;
        }
    }

    // User Preferences
    async getUserPreferences(userId) {
        if (!this.enabled) return null;

        try {
            const { data, error } = await this.client
                .from('user_preferences')
                .select('*')
                .eq('user_id', userId.toString())
                .single();

            if (error) {
                if (error.code === 'PGRST116') return null; // Not found
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Supabase getUserPreferences error:', error.message);
            return null;
        }
    }

    async setUserPreferences(userId, preferences) {
        if (!this.enabled) return false;

        try {
            const { error } = await this.client
                .from('user_preferences')
                .upsert({
                    user_id: userId.toString(),
                    ...preferences,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Supabase setUserPreferences error:', error.message);
            return false;
        }
    }

    // Active Reminders
    async getActiveReminders(userId) {
        if (!this.enabled) return null;

        try {
            const { data, error } = await this.client
                .from('active_reminders')
                .select('*')
                .eq('user_id', userId.toString());

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Supabase getActiveReminders error:', error.message);
            return null;
        }
    }

    async saveActiveReminder(reminder) {
        if (!this.enabled) return false;

        try {
            const { error } = await this.client
                .from('active_reminders')
                .upsert({
                    user_id: reminder.userId.toString(),
                    keyword: reminder.keyword,
                    message: reminder.message,
                    sender: reminder.sender,
                    group: reminder.group,
                    first_detected_at: reminder.firstDetectedAt,
                    next_reminder_at: reminder.nextReminderAt,
                    reminder_count: reminder.reminderCount,
                    acknowledged: reminder.acknowledged
                });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Supabase saveActiveReminder error:', error.message);
            return false;
        }
    }

    async deleteActiveReminder(userId) {
        if (!this.enabled) return false;

        try {
            const { error } = await this.client
                .from('active_reminders')
                .delete()
                .eq('user_id', userId.toString());

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Supabase deleteActiveReminder error:', error.message);
            return false;
        }
    }

    // Session Backup - Backup individual file (NEW IMPROVED METHOD)
    async backupSessionFile(phoneNumber, filename, content) {
        if (!this.enabled) return false;

        try {
            const filePath = `sessions/${phoneNumber}/${filename}`;
            
            // Use storage client (with service key if available)
            const client = this.storageClient || this.client;
            
            const { error } = await client.storage
                .from('whatsapp-sessions')
                .upload(filePath, content, {
                    contentType: 'text/plain',
                    upsert: true
                });

            if (error) {
                // If bucket doesn't exist, try to create it
                if (error.message && error.message.includes('not found')) {
                    console.log('📦 Storage bucket not found. Please create "whatsapp-sessions" bucket in Supabase.');
                    return false;
                }
                throw error;
            }

            return true;
        } catch (error) {
            console.error(`Supabase backupSessionFile error for ${filename}:`, error.message);
            return false;
        }
    }

    // Session Restore - Restore individual file (NEW IMPROVED METHOD)
    async restoreSessionFile(phoneNumber, filename) {
        if (!this.enabled) return null;

        try {
            const filePath = `sessions/${phoneNumber}/${filename}`;
            
            const { data, error } = await this.client.storage
                .from('whatsapp-sessions')
                .download(filePath);

            if (error) {
                if (error.message.includes('not found')) return null;
                throw error;
            }

            const content = await data.text();
            return content;
        } catch (error) {
            console.error(`Supabase restoreSessionFile error for ${filename}:`, error.message);
            return null;
        }
    }

    // Session List - List all files for a session (NEW METHOD)
    async listSessionFiles(phoneNumber) {
        if (!this.enabled) return [];

        try {
            // First, try listing ALL files in the bucket to see what's actually there
            console.log(`🔍 Listing ALL files in bucket to debug...`);
            const { data: allData, error: allError } = await this.client.storage
                .from('whatsapp-sessions')
                .list('sessions', {
                    limit: 100,
                    offset: 0,
                    sortBy: { column: 'name', order: 'asc' }
                });
            
            if (!allError && allData) {
                console.log(`📦 Total items in sessions folder: ${allData.length}`);
                console.log(`📋 All items:`, allData.map(item => item.name).slice(0, 20));
            }
            
            const folderPath = `sessions/${phoneNumber}`;
            
            console.log(`🔍 Listing files from Supabase path: ${folderPath}`);
            
            const { data, error } = await this.client.storage
                .from('whatsapp-sessions')
                .list(folderPath);

            if (error) {
                console.log(`❌ Error listing files: ${error.message}`);
                if (error.message.includes('not found')) return [];
                throw error;
            }

            console.log(`📋 Raw data from Supabase (${data?.length || 0} items):`, JSON.stringify(data, null, 2));

            // Filter out directories, return only files (without the folder path prefix)
            const files = (data || [])
                .filter(item => item.metadata !== null) // Files have metadata, directories don't
                .map(item => {
                    // Remove the folder path prefix to get just the filename
                    const name = item.name.replace(`${phoneNumber}/`, '');
                    return name;
                });
            
            console.log(`📄 Extracted ${files.length} files:`, files);
            
            return files;
        } catch (error) {
            console.error('Supabase listSessionFiles error:', error.message);
            return [];
        }
    }

    // Legacy methods (kept for compatibility)
    async backupSession(phoneNumber, sessionData) {
        // Use new method - backup as single JSON
        return await this.backupSessionFile(phoneNumber, 'session.json', JSON.stringify(sessionData));
    }

    async restoreSession(phoneNumber) {
        // Use new method - restore as single JSON
        const content = await this.restoreSessionFile(phoneNumber, 'session.json');
        if (!content) return null;
        
        try {
            return JSON.parse(content);
        } catch (error) {
            return null;
        }
    }

    // Fallback: Check if enabled
    isEnabled() {
        return this.enabled;
    }
}

module.exports = SupabaseManager;

