# WhatsApp Keyword Tracking Bot

A cloud-based bot that monitors WhatsApp group messages for specific keywords and sends instant notifications via Telegram.

## Phase 1 Features

- ✅ WhatsApp connection using Baileys
- ✅ Real-time message monitoring
- ✅ Keyword detection in text messages
- ✅ Telegram notifications
- ✅ Basic logging
- ✅ Cloud deployment ready

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your Telegram bot token and chat ID
   ```

3. **Configure keywords:**
   ```bash
   # Edit config/keywords.json with your target keywords
   ```

4. **Run the bot:**
   ```bash
   npm start
   ```

5. **Scan QR code** with your WhatsApp to connect

## Configuration

### Environment Variables (.env)
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
PORT=3000
NODE_ENV=production
```

### Keywords (config/keywords.json)
```json
{
  "keywords": [
    "cake",
    "napkins",
    "list",
    "urgent",
    "emergency"
  ],
  "caseSensitive": false,
  "exactMatch": true
}
```

## Deployment

This bot is configured for deployment on Render.com:

1. Connect your GitHub repository to Render
2. Set environment variables in Render dashboard
3. Deploy as a Web Service
4. Set up UptimeRobot for health monitoring

## Project Structure

```
src/
├── bot.js              # Main bot application
├── whatsapp.js         # WhatsApp connection handler
├── keywordDetector.js  # Keyword detection logic
├── notifier.js         # Telegram notification handler
└── logger.js           # Logging configuration

config/
├── keywords.json       # Keyword configuration
└── settings.json       # Bot settings

sessions/               # WhatsApp session storage
logs/                   # Log files
```

## License

MIT
