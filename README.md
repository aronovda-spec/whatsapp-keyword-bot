# WhatsApp Keyword Tracking Bot

A cloud-based bot that monitors WhatsApp group messages for specific keywords and sends instant notifications via Telegram with advanced group management and multi-user support.

## ✨ Features

### 🔍 Core Monitoring
- ✅ WhatsApp connection using Baileys
- ✅ Real-time message monitoring
- ✅ Keyword detection in text messages (33 keywords in multiple languages)
- ✅ Telegram notifications
- ✅ Comprehensive logging
- ✅ Cloud deployment ready

### 📱 Group Management
- ✅ **Group Discovery**: Automatically discover all WhatsApp groups
- ✅ **User Subscriptions**: Users can subscribe to specific groups
- ✅ **Selective Notifications**: Only subscribed users get notifications from their groups
- ✅ **Multi-User Support**: Multiple users can use the same bot instance
- ✅ **Group Filtering**: Monitor only specific groups or all groups

### 🌍 Advanced Features
- ✅ **Multi-Language Support**: English, Hebrew, Russian keywords
- ✅ **Per-User Timezone**: Each user can set their own timezone
- ✅ **Anti-Ban Protection**: Rate limiting, human-like behavior, sleep schedules
- ✅ **Authorization System**: Admin-controlled user access
- ✅ **Duplicate Prevention**: Prevents command spam
- ✅ **24/7 Mode**: Optional continuous operation
- ✅ **Multi-Phone Support**: Monitor multiple WhatsApp accounts

## 🚀 Quick Start

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

## 📱 Telegram Commands

### 📊 Status Commands
- `/start` - Start the bot
- `/status` - Check bot status
- `/help` - Show this help
- `/sleep` - Check sleep status

### 📱 Group Management
- `/discover` - Show all groups bot is in
- `/allgroups` - Show available groups for subscription
- `/subscribe <group_name>` - Subscribe to a group
- `/unsubscribe <group_name>` - Unsubscribe from a group
- `/mygroups` - Show your subscriptions

### 🌍 Timezone Commands
- `/israel` - Israeli time 🇮🇱
- `/usa` - US Eastern time 🇺🇸
- `/uk` - UK time 🇬🇧
- `/japan` - Japan time 🇯🇵

### ⚙️ Control Commands
- `/24h` - Toggle 24/7 mode
- `/admin` - Admin panel
- `/users` - List users
- `/keywords` - Show keywords
- `/stats` - Bot statistics

### 👑 Admin Only
- `/approve <user_id>` - Approve user
- `/reject <user_id>` - Reject user
- `/pending` - Show pending requests

## ⚙️ Configuration

### Environment Variables (.env)
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
TELEGRAM_ADDITIONAL_CHAT_IDS=user1_id,user2_id,user3_id
PORT=3000
NODE_ENV=production
```

### Keywords (config/keywords.json)
```json
{
  "keywords": [
    "cake", "napkins", "list", "urgent", "emergency", "important",
    "deadline", "meeting", "event", "help", "asap", "critical",
    "דחוף", "חשוב", "עזרה", "מפגש", "אירוע", "רשימה",
    "עוגה", "מפיות", "חירום", "קריטי",
    "срочно", "важно", "помощь", "встреча", "событие",
    "список", "торт", "салфетки", "критично", "экстренно"
  ],
  "caseSensitive": false,
  "exactMatch": true,
  "enabled": true
}
```

### Multi-Phone Configuration (config/multi-phone.json)
```json
{
  "phones": [
    {
      "number": "YOUR_PRIMARY_PHONE_NUMBER",
      "sessionPath": "./sessions/phone1",
      "enabled": true,
      "description": "Primary monitoring phone"
    }
  ],
  "settings": {
    "maxConcurrentPhones": 5,
    "reconnectDelay": 5000,
    "healthCheckInterval": 30000,
    "autoReconnect": true
  }
}
```

## 🏗️ Project Structure

```
src/
├── bot.js                    # Main bot application
├── whatsapp.js              # WhatsApp connection handler
├── keywordDetector.js       # Keyword detection logic
├── notifier.js              # Telegram notification handler
├── telegram-commands.js     # Telegram command handler
├── telegram-auth.js         # User authorization system
├── anti-ban.js              # Anti-ban protection
├── keep-alive.js            # Anti-sleep mechanism
└── logger.js                # Logging configuration

config/
├── keywords.json            # Keyword configuration
├── settings.json            # Bot settings
├── multi-phone.json         # Multi-phone configuration
├── telegram-auth.json       # User authorization data
├── user-preferences.json    # Per-user timezone preferences
├── group-subscriptions.json # Group subscription data
└── discovered-groups.json   # Auto-discovered groups

sessions/                    # WhatsApp session storage
logs/                        # Log files
```

## 🌐 Deployment

This bot is configured for deployment on Render.com:

1. **Connect your GitHub repository to Render**
2. **Set environment variables in Render dashboard**
3. **Deploy as a Web Service**
4. **Set up UptimeRobot for health monitoring**

### Render Configuration (render.yaml)
```yaml
services:
  - type: web
    name: whatsapp-keyword-bot
    env: node
    plan: free
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /health
    autoDeploy: true
```

## 🔐 Security Features

- **Authorization System**: Only approved users can access the bot
- **Group Isolation**: Users only receive notifications from their subscribed groups
- **Anti-Ban Protection**: Rate limiting and human-like behavior
- **Secure Storage**: Sensitive data stored in environment variables
- **Duplicate Prevention**: Prevents command spam and abuse

## 📊 Monitoring

- **Health Check**: `http://your-domain.com/health`
- **Statistics**: `http://your-domain.com/stats`
- **Logs**: Comprehensive logging with Winston
- **Anti-Sleep**: Automatic keep-alive mechanism

## 🚀 Usage Examples

### Basic Setup
1. Add bot to WhatsApp groups
2. Users send `/start` to get authorized
3. Users subscribe to groups with `/subscribe <group_name>`
4. Bot monitors keywords and sends notifications

### Multi-User Scenario
- **User A**: Subscribes to "Family Group" → Gets notifications only from Family Group
- **User B**: Subscribes to "Work Group" → Gets notifications only from Work Group
- **User C**: Subscribes to both groups → Gets notifications from both

### Timezone Management
- **User A**: Sets Israeli timezone with `/israel`
- **User B**: Sets US timezone with `/usa`
- **Each user**: Gets sleep status in their local time

## 📝 License

MIT
