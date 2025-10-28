# WhatsApp Keyword Tracking Bot

A cloud-based bot that monitors WhatsApp group messages for specific keywords and sends instant notifications via Telegram with advanced group management and multi-user support.

## ✨ Features

### 🔍 Core Monitoring
- ✅ WhatsApp connection using Baileys
- ✅ Real-time message monitoring
- ✅ Keyword detection in text messages (52 keywords in multiple languages)
- ✅ **Telegram notifications**
- ✅ **Email notifications** (Gmail, SendGrid, etc.)
- ✅ **File attachment detection** (PDF, Excel, Word, Images)
- ✅ **Smart repeating reminders** for personal keywords
- ✅ Comprehensive logging
- ✅ Cloud deployment ready

### 📱 Group Management
- ✅ **Group Discovery**: Automatically discover all WhatsApp groups
- ✅ **User Subscriptions**: Users can subscribe to specific groups
- ✅ **Selective Notifications**: Only subscribed users get notifications from their groups
- ✅ **Multi-User Support**: Multiple users can use the same bot instance
- ✅ **Group Filtering**: Monitor only specific groups or all groups

### 🌍 Advanced Features
- ✅ **Multi-Language Support**: English, Hebrew, Russian keywords with fuzzy matching
- ✅ **File Content Extraction**: Extract text from PDFs, Excel, Word documents
- ✅ **Multi-Channel Notifications**: Telegram + Email
- ✅ **Repeating Reminders**: Personal keywords send reminders until acknowledged
- ✅ **Per-User Timezone**: Each user can set their own timezone
- ✅ **Anti-Ban Protection**: Rate limiting, human-like behavior, sleep schedules
- ✅ **Authorization System**: Admin-controlled user access
- ✅ **Duplicate Prevention**: Prevents command spam
- ✅ **24/7 Mode**: Optional continuous operation
- ✅ **Multi-Phone Support**: Monitor multiple WhatsApp accounts
- ✅ **Enhanced User Management**: Clear admin identification and role display
- ✅ **Personal Keywords**: Users can manage their own keyword lists

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
- `/ok` - Acknowledge reminder and stop
- `/reminders` - Show active reminders
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
- `/users` - List all users with admin badges
- `/admins` - Show admin users only
- `/keywords` - Show keywords
- `/stats` - Bot statistics

### 👑 Admin Only
- `/approve <user_id>` - Approve user
- `/reject <user_id>` - Reject user
- `/pending` - Show pending requests
- `/remove <user_id>` - Remove user
- `/setemail <user_id> <email>` - Set user email for notifications
- `/removeemail <user_id>` - Remove user email from notifications
- `/addkeyword <word>` - Add global keyword
- `/removekeyword <word>` - Remove global keyword
- `/restart` - Restart bot (preserves all data)

### 🔑 Keyword Management
- `/keywords` - Show global keywords
- `/mykeywords` - Show your personal keywords
- `/addmykeyword <word>` - Add personal keyword
- `/removemykeyword <word>` - Remove personal keyword

**🌍 Multilingual Support**: Keywords can be added in any language including Hebrew, Russian, Arabic, Chinese, Japanese, and any Unicode-based script.

## ⚙️ Configuration

### Environment Variables (.env)
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
TELEGRAM_ADDITIONAL_CHAT_IDS=user1_id,user2_id,user3_id

# Email Notifications (Optional)
EMAIL_ENABLED=true
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your_email@gmail.com
EMAIL_SMTP_PASS=your_app_password
EMAIL_TO=user1@mail.com,user2@mail.com

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
├── notifier.js              # Multi-channel notifications (Telegram + Email)
├── reminderManager.js       # Repeating reminders for personal keywords
├── fileExtractor.js          # File content extraction (PDF, Excel, Word)
├── telegram-commands.js     # Telegram command handler
├── telegram-auth.js         # User authorization system
├── anti-ban.js              # Anti-ban protection
├── keep-alive.js            # Anti-sleep mechanism
├── logger.js                # Logging configuration
└── notifiers/
    └── emailChannel.js      # Email notification channel

config/
├── keywords.json            # Keyword configuration
├── file-extraction.json     # File content extraction settings
├── settings.json            # Bot settings
├── multi-phone.json         # Multi-phone configuration
├── telegram-auth.json       # User authorization data
├── user-preferences.json    # Per-user timezone preferences
├── group-subscriptions.json # Group subscription data
├── personal-keywords.json   # Personal keyword management
├── non-active-hours.json    # Sleep schedule configuration
├── discovered-groups.json   # Auto-discovered groups
└── active-reminders.json    # Active reminder tracking

sessions/                    # WhatsApp session storage
logs/                        # Log files
```

## 🌐 Deployment

This bot is configured for deployment on Render.com (free tier):

### Step 1: Deploy to Render
1. Go to [render.com](https://render.com)
2. Sign up/login with GitHub
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Settings:
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free

### Step 2: Environment Variables
In Render dashboard, add:
```env
NODE_ENV=production
PORT=10000
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
EMAIL_ENABLED=true
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your_email@gmail.com
EMAIL_SMTP_PASS=your_app_password
EMAIL_TO=your@email.com
ADMIN_API_KEY=generate_secure_random_key
LOG_LEVEL=info
```

### Step 3: Connect WhatsApp
1. Deploy service
2. Check Render logs for QR code
3. Scan QR code with WhatsApp
4. Bot auto-connects after scan

### Step 4: Monitoring
- **Health:** `https://your-app.onrender.com/health`
- **Stats:** `https://your-app.onrender.com/stats?token=YOUR_API_KEY`
- **Uptime:** Set up [UptimeRobot](https://uptimerobot.com) to monitor `/health`

## 🔐 Security Features

- **Authorization System**: Only approved users can access the bot
- **Group Isolation**: Users only receive notifications from their subscribed groups
- **Anti-Ban Protection**: Rate limiting and human-like behavior
- **Secure Storage**: Sensitive data stored in environment variables
- **Duplicate Prevention**: Prevents command spam and abuse
- **Admin Role Management**: Clear distinction between admins and regular users
- **Personal Keyword Privacy**: Users' personal keywords are private to them

## 📊 Monitoring

- **Health Check**: `http://your-domain.com/health`
- **Statistics**: `http://your-domain.com/stats`
- **Logs**: Comprehensive logging with Winston
- **Anti-Sleep**: Automatic keep-alive mechanism

## 🆕 Recent Enhancements

### File Attachment Support (NEW!)
- **File Detection**: Detects PDF, Excel, Word, Images, Audio, Videos
- **Filename Keywords**: Detects keywords in file names (multi-language)
- **File Content Extraction**: Extract text from PDFs, Excel, Word documents
- **Image OCR**: Ready for implementation (disabled by default)
- **Metadata Display**: Shows file type, size, and name in notifications

### Multi-Channel Notifications (NEW!)
- **Telegram**: Instant messaging notifications (already implemented)
- **Email**: HTML formatted email notifications (NEW!)
- **Parallel Sending**: Both channels work simultaneously
- **Free Tier Compatible**: Works on free Render

### Repeating Reminders for Personal Keywords (NEW!)
- **Smart Schedule**: Reminders at 0min, 1min, 2min, 15min, 1hour
- **User Control**: Type `/ok` to acknowledge and stop
- **Auto-Stop**: Stops after 1 hour or when acknowledged
- **Same Keyword**: Detecting same keyword restarts timer
- **Never Miss**: Ensures critical personal messages are seen

### Enhanced User Management
- **`/users` Command**: Shows all users with clear admin badges (👑 for admins, 👤 for users)
- **`/admins` Command**: Shows only admin users with their privileges
- **Role Visibility**: Easy identification of admin privileges
- **User Statistics**: Summary counts of users

### Advanced Keyword System
- **Global Keywords**: Admin-managed keywords that notify all users
- **Personal Keywords**: User-managed keywords with repeating reminders
- **Fuzzy Matching**: Handles typos in all languages (Hebrew, English, Russian)
- **Multi-Language**: Full Unicode support (Hebrew, Russian, Arabic, etc.)
- **Easy Management**: Simple commands to add/remove keywords

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

### Personal Keywords with Reminders
- **User adds**: `/addmykeyword urgent`
- **WhatsApp message**: "urgent meeting at 3pm"
- **User receives**: 
  - Immediate alert at 0min
  - Reminder at 1min
  - Reminder at 2min
  - Reminder at 15min
  - Final reminder at 1hour
- **User types**: `/ok`
- **Reminders stop**: No more notifications

### File Attachments
- **WhatsApp file**: "urgent_report.pdf"
- **Bot detects**: Filename keyword "urgent"
- **Bot extracts**: Text from PDF content
- **User receives**: Notification with file info + extracted content

## 🔧 Troubleshooting

### Bot not connecting to WhatsApp
- Check if QR code is being generated in logs
- Ensure session files are persisted
- Verify no firewall blocking WhatsApp Web

### Telegram notifications not working
- Verify bot token and chat ID in `.env`
- Test with `/test-notification` endpoint (requires API key)
- Check if bot is blocked by user

### Keywords not detected
- Check `config/keywords.json` syntax
- Verify case sensitivity settings
- Test with `/reload-keywords` endpoint (requires API key)

### Bot disconnects frequently
- Check Render logs for errors
- Verify stable internet connection
- Consider upgrading to paid Render plan

### Testing Endpoints
```bash
# Health check (no auth required)
curl https://your-app.onrender.com/health

# Stats (requires API key)
curl "https://your-app.onrender.com/stats?token=YOUR_API_KEY"

# Test notification (requires API key)
curl -X POST "https://your-app.onrender.com/test-notification?token=YOUR_API_KEY"
```

## 📝 License

MIT
