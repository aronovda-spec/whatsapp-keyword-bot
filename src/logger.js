const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Configure Winston logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'whatsapp-bot' },
    transports: [
        // Write all logs to file
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5
        }),
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5
        })
    ]
});

// If not in production, also log to console
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

// Helper functions for structured logging
const logKeywordDetection = (keyword, message, sender, group) => {
    logger.info('Keyword detected', {
        keyword,
        message: message.substring(0, 100), // Truncate long messages
        sender: sender || 'Unknown',
        group: group || 'Unknown',
        timestamp: new Date().toISOString()
    });
};

const logBotEvent = (event, data = {}) => {
    logger.info(`Bot event: ${event}`, {
        event,
        ...data,
        timestamp: new Date().toISOString()
    });
};

const logError = (error, context = {}) => {
    logger.error('Bot error', {
        error: error.message,
        stack: error.stack,
        ...context,
        timestamp: new Date().toISOString()
    });
};

module.exports = {
    logger,
    logKeywordDetection,
    logBotEvent,
    logError
};
