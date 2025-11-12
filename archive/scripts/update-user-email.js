/**
 * Update User Email in Database
 * 
 * Takes email from .env (EMAIL_TO) and adds it to users table
 * 
 * Usage: node update-user-email.js
 */

require('dotenv').config();
const SupabaseManager = require('./src/supabase');

async function updateUserEmail() {
    console.log('🔄 Updating user email in database...\n');

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

    // Get email from .env
    const email = process.env.EMAIL_TO;
    if (!email) {
        console.error('❌ EMAIL_TO not found in .env file!');
        console.log('Add your email to .env: EMAIL_TO=your-email@gmail.com');
        process.exit(1);
    }

    // Get the first email if multiple (comma-separated)
    const userEmail = email.split(',')[0].trim();

    // Get user ID from environment variable
    const userId = process.env.TELEGRAM_CHAT_ID || process.env.ADMIN_USER_ID;
    if (!userId) {
        console.error('❌ User ID not found!');
        console.log('Please set TELEGRAM_CHAT_ID or ADMIN_USER_ID in .env file.');
        process.exit(1);
    }

    console.log(`📧 Updating email for user: ${userId}`);
    console.log(`📧 New email: ${userEmail}\n`);

    // Update user in database
    const success = await updateEmail(supabase, userId, userEmail);
    
    if (success) {
        console.log('✅ Email updated successfully!\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 Summary:');
        console.log(`   👤 User ID: ${userId}`);
        console.log(`   👑 Role: Admin`);
        console.log(`   📧 Email: ${userEmail}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('💡 Your email is now in the database!');
        console.log('🔍 Verify in Supabase Dashboard → Table Editor → users\n');
    } else {
        console.error('❌ Failed to update email!');
        process.exit(1);
    }

    console.log('✨ Update complete!');
}

async function updateEmail(supabase, userId, email) {
    if (!supabase.enabled) return false;

    try {
        const { error } = await supabase.client
            .from('users')
            .update({
                email: email,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error(`Error updating email:`, error.message);
        return false;
    }
}

// Run update
updateUserEmail().catch(error => {
    console.error('\n❌ Update failed:', error.message);
    console.error(error);
    process.exit(1);
});

