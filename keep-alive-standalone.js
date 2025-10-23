#!/usr/bin/env node
/**
 * Standalone Keep Alive Script
 * Run this separately to test anti-sleep mechanism
 * Usage: node keep-alive-standalone.js
 */

const KeepAliveService = require('./src/keep-alive');

console.log('🚀 Starting standalone keep alive service...');
console.log('💡 This will ping the bot every 5 minutes to prevent sleep');

const keepAlive = new KeepAliveService();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Stopping keep alive service...');
    keepAlive.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Stopping keep alive service...');
    keepAlive.stop();
    process.exit(0);
});

keepAlive.start();
