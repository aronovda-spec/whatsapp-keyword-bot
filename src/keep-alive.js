#!/usr/bin/env node
/**
 * Keep Alive Script for Render Free Tier
 * Prevents the WhatsApp bot from sleeping by pinging itself
 * Based on the working implementation from Super2 project
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

class KeepAliveService {
    constructor() {
        this.isRunning = false;
        this.pingInterval = 5 * 60 * 1000; // 5 minutes
        this.serviceUrl = process.env.RENDER_EXTERNAL_URL || process.env.HEROKU_URL;
        this.port = process.env.PORT || 3000;
        this.localUrl = `http://localhost:${this.port}`;
    }

    async pingService() {
        try {
            const url = this.serviceUrl || this.localUrl;
            const targetUrl = `${url}/health`;
            
            console.log(`🔄 Pinging ${targetUrl} at ${new Date().toISOString()}`);
            
            const response = await this.makeRequest(targetUrl);
            
            if (response.statusCode === 200) {
                console.log(`✅ Ping successful - Service is alive`);
                return true;
            } else {
                console.log(`⚠️ Ping returned status ${response.statusCode}`);
                return false;
            }
        } catch (error) {
            console.log(`❌ Ping failed: ${error.message}`);
            return false;
        }
    }

    makeRequest(url) {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const isHttps = parsedUrl.protocol === 'https:';
            const client = isHttps ? https : http;
            
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (isHttps ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                timeout: 10000,
                headers: {
                    'User-Agent': 'WhatsApp-Bot-KeepAlive/1.0'
                }
            };

            const req = client.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: data
                    });
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    start() {
        if (this.isRunning) {
            console.log('⚠️ Keep alive service is already running');
            return;
        }

        this.isRunning = true;
        console.log('🔄 Starting keep alive service...');
        console.log(`📍 Service URL: ${this.serviceUrl || this.localUrl}`);
        console.log(`⏰ Ping interval: ${this.pingInterval / 1000} seconds`);

        // Initial ping
        this.pingService();

        // Set up interval
        this.intervalId = setInterval(() => {
            this.pingService();
        }, this.pingInterval);
    }

    stop() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        console.log('🛑 Keep alive service stopped');
    }
}

// Export for use in other modules
module.exports = KeepAliveService;

// Run standalone if called directly
if (require.main === module) {
    const keepAlive = new KeepAliveService();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Received SIGINT, shutting down keep alive...');
        keepAlive.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\n🛑 Received SIGTERM, shutting down keep alive...');
        keepAlive.stop();
        process.exit(0);
    });

    keepAlive.start();
}
