/**
 * Migration Script: Move to Unified Users Table
 * 
 * Migrates data from:
 * - authorized_users -> users (merge with user_preferences)
 * - user-emails.json -> users.email
 * 
 * Usage: node migrate-to-unified-schema.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const SupabaseManager = require('./src/supabase');

async function migrateToUnifiedSchema() {
    console.log('🔄 Starting migration to unified users table...\n');

    // Check if Supabase is configured
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
        console.error('❌ Supabase not configured in .env file!');
        process.exit(1);
    }

    const supabase = new SupabaseManager();
    
    if (!supabase.isEnabled()) {
        console.error('❌ Failed to connect to Supabase!');
        process.exit(1);
    }

    console.log('✅ Connected to Supabase\n');

    // Step 1: Get existing data from old tables
    console.log('📥 Fetching existing data from old tables...\n');
    
    const authorizedUsers = await supabase.getAuthorizedUsers();
    console.log(`Found ${authorizedUsers?.length || 0} authorized users`);

    // Step 2: Load email mappings from JSON (if exists)
    let emailMap = new Map();
    const emailFilePath = path.join(__dirname, 'config/user-emails.json');
    if (fs.existsSync(emailFilePath)) {
        const emailData = JSON.parse(fs.readFileSync(emailFilePath, 'utf8'));
        emailMap = new Map(Object.entries(emailData));
        console.log(`Found ${emailMap.size} email mappings from user-emails.json`);
    }

    console.log('');

    // Step 3: Create unified users in new table
    if (!authorizedUsers || authorizedUsers.length === 0) {
        console.log('⚠️ No users found to migrate. Creating you as admin...');
        
        // Add you as admin
        const adminUserId = '1022850808';
        const userEmail = emailMap.get(adminUserId) || null;
        const emailValue = userEmail ? (Array.isArray(userEmail) ? userEmail[0] : userEmail) : null;
        
        const success = await migrateUser(supabase, {
            user_id: adminUserId,
            is_admin: true,
            email: emailValue
        });

        if (success) {
            console.log(`✅ Added admin user: ${adminUserId}\n`);
        }
    } else {
        console.log('⬆️ Migrating users to unified table...\n');
        
        let successCount = 0;
        for (const user of authorizedUsers) {
            const userEmail = emailMap.get(user.user_id) || null;
            const emailValue = userEmail ? (Array.isArray(userEmail) ? userEmail[0] : userEmail) : null;
            
            const success = await migrateUser(supabase, {
                user_id: user.user_id,
                is_admin: user.is_admin || false,
                email: emailValue
            });

            if (success) {
                successCount++;
                console.log(`✅ Migrated: ${user.user_id} (admin: ${user.is_admin || false}, email: ${emailValue || 'none'})`);
            } else {
                console.log(`❌ Failed: ${user.user_id}`);
            }
        }

        console.log(`\n📊 Migrated ${successCount} users\n`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Migration complete!');
    console.log('💡 All user data is now in the unified "users" table');
    console.log('🔍 Verify in Supabase Dashboard → Table Editor → users');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

async function migrateUser(supabase, userData) {
    if (!supabase.enabled) return false;

    try {
        // Insert into unified users table
        const { error } = await supabase.client
            .from('users')
            .upsert({
                user_id: userData.user_id.toString(),
                is_admin: userData.is_admin || false,
                email: userData.email || null,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error(`Error migrating user ${userData.user_id}:`, error.message);
        return false;
    }
}

// Run migration
migrateToUnifiedSchema().catch(error => {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
});

