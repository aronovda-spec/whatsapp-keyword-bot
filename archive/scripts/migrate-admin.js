/**
 * Migration Script: Add Admin User to Supabase
 * 
 * Usage: node migrate-admin.js
 */

require('dotenv').config();
const SupabaseManager = require('./src/supabase');

async function migrateAdmin() {
    console.log('🔄 Starting admin migration to Supabase...\n');

    // Check if Supabase is configured
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
        console.error('❌ Supabase not configured in .env file!');
        console.log('Please add SUPABASE_URL and SUPABASE_KEY to your .env file.');
        process.exit(1);
    }

    // Initialize Supabase
    const supabase = new SupabaseManager();
    
    if (!supabase.isEnabled()) {
        console.error('❌ Failed to connect to Supabase!');
        process.exit(1);
    }

    console.log('✅ Connected to Supabase\n');

    // Get admin user ID from environment variable or require input
    const adminUserId = process.env.TELEGRAM_CHAT_ID || process.env.ADMIN_USER_ID;
    if (!adminUserId) {
        console.error('❌ Admin user ID not found!');
        console.log('Please set TELEGRAM_CHAT_ID or ADMIN_USER_ID in .env file, or pass as argument.');
        console.log('Usage: ADMIN_USER_ID=YOUR_USER_ID node migrate-admin.js');
        process.exit(1);
    }

    console.log(`👑 Adding admin user: ${adminUserId}\n`);

    // Add as admin
    const success = await supabase.promoteToAdmin(adminUserId);
    
    if (success) {
        console.log('✅ Admin user added successfully!\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 Summary:');
        console.log(`   👑 User ID: ${adminUserId}`);
        console.log(`   ✅ Role: Admin`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('💡 Your admin status is now in Supabase database!');
        console.log('🔍 Verify in Supabase Dashboard:');
        console.log('   1. Go to Table Editor');
        console.log('   2. Select "authorized_users" table');
        console.log('   3. You should see your user with is_admin = true!\n');
    } else {
        console.error('❌ Failed to add admin user!');
        process.exit(1);
    }

    console.log('✨ Migration complete!');
}

// Run migration
migrateAdmin().catch(error => {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
});

