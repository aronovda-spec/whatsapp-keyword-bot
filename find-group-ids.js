#!/usr/bin/env node
/**
 * Group ID Finder Script
 * Helps you find WhatsApp group IDs for monitoring configuration
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 WhatsApp Group ID Finder');
console.log('============================');
console.log('');
console.log('📱 To find group IDs:');
console.log('');
console.log('1. Add your bot to the WhatsApp groups you want to monitor');
console.log('2. Send any message in each group');
console.log('3. Check the bot logs for group IDs like:');
console.log('   📱 Message from: John in group: 120363123456789012@g.us');
console.log('');
console.log('4. Copy the group ID (the part ending with @g.us)');
console.log('5. Update config/monitored-groups.json');
console.log('');
console.log('📋 Current monitored groups configuration:');

try {
    const configPath = path.join(__dirname, 'config/monitored-groups.json');
    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log('');
        config.monitoredGroups.forEach((group, index) => {
            const status = group.enabled ? '✅ Enabled' : '❌ Disabled';
            console.log(`${index + 1}. ${group.name} - ${status}`);
            console.log(`   ID: ${group.groupId}`);
            console.log(`   Description: ${group.description}`);
            console.log('');
        });
    } else {
        console.log('❌ No group configuration found');
        console.log('📝 Create config/monitored-groups.json first');
    }
} catch (error) {
    console.error('❌ Error reading group config:', error.message);
}

console.log('🎯 Next steps:');
console.log('1. Add bot to WhatsApp groups');
console.log('2. Send test messages in groups');
console.log('3. Check bot logs for group IDs');
console.log('4. Update monitored-groups.json');
console.log('5. Restart bot');
console.log('');
console.log('💡 Tip: Start with 1-2 groups for testing!');
