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

    // User Authorization Management
    async getAuthorizedUsers() {
        if (!this.enabled) return null;

        try {
            const { data, error } = await this.client
                .from('authorized_users')
                .select('*');

            if (error) throw error;

            return data;
        } catch (error) {
            console.error('Supabase getAuthorizedUsers error:', error.message);
            return null;
        }
    }

    async addAuthorizedUser(userId, isAdmin = false) {
        if (!this.enabled) return false;

        try {
            const { error } = await this.client
                .from('authorized_users')
                .upsert({
                    user_id: userId.toString(),
                    is_admin: isAdmin,
                    created_at: new Date().toISOString()
                });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Supabase addAuthorizedUser error:', error.message);
            return false;
        }
    }

    async promoteToAdmin(userId) {
        if (!this.enabled) return false;

        try {
            const { error } = await this.client
                .from('authorized_users')
                .upsert({
                    user_id: userId.toString(),
                    is_admin: true,
                    created_at: new Date().toISOString()
                });

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
                .from('authorized_users')
                .update({
                    is_admin: false
                })
                .eq('user_id', userId.toString());

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Supabase demoteFromAdmin error:', error.message);
            return false;
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

    // Session Backup (Supabase Storage)
    async backupSession(phoneNumber, sessionData) {
        if (!this.enabled) return false;

        try {
            const filename = `sessions/${phoneNumber}/session.json`;
            
            // Use storage client (with service key if available)
            const client = this.storageClient || this.client;
            
            const { error } = await client.storage
                .from('whatsapp-sessions')
                .upload(filename, JSON.stringify(sessionData), {
                    contentType: 'application/json',
                    upsert: true
                });

            if (error) throw error;

            console.log(`💾 Session backed up to cloud: ${phoneNumber}`);
            return true;
        } catch (error) {
            console.error('Supabase backupSession error:', error.message);
            
            // If it's an RLS error, provide helpful message
            if (error.message && error.message.includes('row-level security')) {
                console.log('💡 Tip: To enable storage, either:');
                console.log('   1. Add SUPABASE_SERVICE_KEY to your .env file (recommended)');
                console.log('   2. Or disable RLS on whatsapp-sessions bucket in Supabase dashboard');
            }
            
            return false;
        }
    }

    async restoreSession(phoneNumber) {
        if (!this.enabled) return null;

        try {
            const filename = `sessions/${phoneNumber}/session.json`;
            
            const { data, error } = await this.client.storage
                .from('whatsapp-sessions')
                .download(filename);

            if (error) {
                if (error.message.includes('not found')) return null;
                throw error;
            }

            const sessionJson = await data.text();
            const sessionData = JSON.parse(sessionJson);

            console.log(`📥 Session restored from cloud: ${phoneNumber}`);
            return sessionData;
        } catch (error) {
            console.error('Supabase restoreSession error:', error.message);
            return null;
        }
    }

    // Fallback: Check if enabled
    isEnabled() {
        return this.enabled;
    }
}

module.exports = SupabaseManager;

