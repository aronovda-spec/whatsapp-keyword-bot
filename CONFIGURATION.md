# WhatsApp Keyword Bot - Configuration Guide

## Environment Variables (.env)

Create a `.env` file in the root directory with these variables:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here

# Server Configuration
PORT=3000
NODE_ENV=development

# WhatsApp Configuration
WHATSAPP_SESSION_PATH=./sessions

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=./logs/bot.log
```

### Getting Telegram Credentials

1. **Bot Token:**
   - Message @BotFather on Telegram
   - Send `/newbot`
   - Follow instructions to create bot
   - Copy the token (format: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

2. **Chat ID:**
   - Message @userinfobot on Telegram
   - It will reply with your chat ID
   - Copy the number (format: `123456789`)

## Keyword Configuration (config/keywords.json)

```json
{
  "keywords": [
    "cake",
    "napkins",
    "list",
    "urgent",
    "emergency",
    "important",
    "deadline",
    "meeting",
    "event"
  ],
  "caseSensitive": false,
  "exactMatch": true,
  "enabled": true
}
```

### Configuration Options

- **keywords:** Array of words/phrases to detect
- **caseSensitive:** Whether to match case exactly (default: false)
- **exactMatch:** Whether to match whole words only (default: true)
- **enabled:** Whether keyword detection is active (default: true)

### Adding Keywords

You can add keywords in several ways:

1. **Edit config file directly**
2. **Use the API endpoint:**
   ```bash
   curl -X POST http://localhost:3000/reload-keywords
   ```
3. **Programmatically** (in future versions)

## Bot Settings (config/settings.json)

```json
{
  "bot": {
    "name": "WhatsApp Keyword Bot",
    "version": "1.0.0",
    "debug": false
  },
  "whatsapp": {
    "sessionPath": "./sessions",
    "qrTimeout": 60000,
    "reconnectDelay": 5000
  },
  "telegram": {
    "enabled": true,
    "retryAttempts": 3,
    "retryDelay": 1000
  },
  "monitoring": {
    "healthCheckInterval": 30000,
    "maxLogSize": "10MB",
    "maxLogFiles": 5
  }
}
```

## Logging Configuration

The bot uses Winston for logging with these levels:
- **error:** Critical errors and exceptions
- **warn:** Warning messages
- **info:** General information and keyword detections
- **debug:** Detailed debugging information

### Log Files
- `logs/error.log` - Error messages only
- `logs/combined.log` - All log messages
- Console output (in development mode)

### Log Rotation
- Maximum file size: 10MB
- Maximum files: 5
- Automatic rotation when limits reached

## WhatsApp Session Management

The bot stores WhatsApp session data in the `sessions/` directory:
- Session files are automatically created
- **Important:** Never delete session files while bot is running
- Session files persist bot login (no need to scan QR repeatedly)

### Session Security
- Session files contain authentication data
- Keep them secure and never share publicly
- Consider encrypting session files for production

## Notification Settings

### Telegram Notifications
- **Format:** HTML formatted messages
- **Retry:** 3 attempts with 1-second delay
- **Rate Limiting:** Built-in Telegram API limits apply

### Message Format
```
🚨 Keyword Alert!

🔍 Keyword: urgent
👤 Sender: John Doe
👥 Group: Family Chat
🕐 Time: 2024-01-15 14:30:25

💬 Message:
This is urgent! Please respond ASAP.

📱 Message ID: 3EB0C767D2A1B2C3
```

## Performance Tuning

### Memory Usage
- Monitor memory consumption in logs
- Restart bot if memory usage grows too high
- Consider upgrading Render plan for better resources

### Message Processing
- Bot processes messages in real-time
- No message queuing (messages processed immediately)
- Consider rate limiting for high-volume groups

### File Processing
- Currently only processes text messages
- File processing will be added in Phase 2
- Large groups may require optimization

## Security Considerations

### Environment Variables
- Never commit `.env` file to version control
- Use strong, unique values for all credentials
- Rotate credentials regularly

### API Endpoints
- Health check endpoint is public (required for Render)
- Stats endpoint is public (consider adding auth)
- Admin endpoints should be protected in production

### WhatsApp Compliance
- Bot only monitors groups it's added to
- Respects WhatsApp Terms of Service
- No automated message sending
- Read-only monitoring only

## Troubleshooting Configuration

### Common Issues

**Bot won't start:**
- Check all required environment variables are set
- Verify file permissions for logs and sessions directories
- Check Node.js version (16+ required)

**Keywords not detected:**
- Verify `config/keywords.json` syntax
- Check if keyword detection is enabled
- Test with simple keywords first

**Telegram notifications not working:**
- Verify bot token format
- Check chat ID is correct
- Ensure bot is not blocked
- Test with `/test-notification` endpoint

**WhatsApp connection issues:**
- Check internet connectivity
- Verify session files are not corrupted
- Clear sessions directory and restart if needed

### Debug Mode
Set `NODE_ENV=development` for detailed console output and debugging information.
