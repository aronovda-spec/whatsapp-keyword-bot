/**
 * Migration Script: Move Global Keywords from JSON to Supabase
 * 
 * Usage: node migrate-keywords.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const SupabaseManager = require('./src/supabase');

async function migrateKeywords() {
    console.log('🔄 Starting keyword migration to Supabase...\n');

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

    // Load keywords from JSON file
    const configPath = path.join(__dirname, 'config/keywords.json');
    if (!fs.existsSync(configPath)) {
        console.error(`❌ Config file not found: ${configPath}`);
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const keywords = config.keywords || [];

    if (keywords.length === 0) {
        console.log('⚠️ No keywords found in config/keywords.json');
        process.exit(0);
    }

    console.log(`📋 Found ${keywords.length} keywords to migrate:`);
    console.log(keywords.join(', '));
    console.log('');

    // Check if keywords already exist in database
    console.log('🔍 Checking existing keywords in database...');
    const existingKeywords = await supabase.getGlobalKeywords();
    const existingSet = new Set(existingKeywords || []);
    
    if (existingSet.size > 0) {
        console.log(`⚠️ Found ${existingSet.size} existing keywords in database:`);
        console.log(Array.from(existingSet).join(', '));
        console.log('');
        
        const newKeywords = keywords.filter(k => !existingSet.has(k));
        if (newKeywords.length === 0) {
            console.log('✅ All keywords already exist in database. Migration complete!');
            process.exit(0);
        }
        
        console.log(`📝 Will add ${newKeywords.length} new keywords:`);
        console.log(newKeywords.join(', '));
        console.log('');
    } else {
        console.log('✅ No existing keywords in database. All will be added.\n');
    }

    // Add keywords to database
    console.log('⬆️ Adding keywords to Supabase...\n');
    let successCount = 0;
    let failCount = 0;

    for (const keyword of keywords) {
        if (existingSet.has(keyword)) {
            console.log(`⏭️  Skipping "${keyword}" (already exists)`);
            continue;
        }

        const success = await supabase.addGlobalKeyword(keyword, 'migration-script');
        if (success) {
            console.log(`✅ Added "${keyword}"`);
            successCount++;
        } else {
            console.log(`❌ Failed to add "${keyword}"`);
            failCount++;
        }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Successfully added: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📝 Total in database: ${successCount + existingSet.size}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (successCount > 0 || existingSet.size > 0) {
        console.log('✅ Keywords are now in Supabase database!');
        console.log('💡 Your bot will now load keywords from Supabase instead of the JSON file.\n');
        console.log('🔍 Verify in Supabase Dashboard:');
        console.log('   1. Go to Table Editor');
        console.log('   2. Select "global_keywords" table');
        console.log('   3. You should see all your keywords there!\n');
    }

    if (failCount > 0) {
        console.log('⚠️ Some keywords failed to migrate. Check the errors above.');
        process.exit(1);
    }

    console.log('✨ Migration complete!');
}

// Run migration
migrateKeywords().catch(error => {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
});

