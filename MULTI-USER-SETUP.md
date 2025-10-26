# Multi-User & Multi-Email Setup Guide

## 📧 Multiple Email Recipients

### How It Works
The bot supports **unlimited email recipients**! Just add comma-separated emails to `EMAIL_TO`.

### .env Configuration for Multiple Emails

```env
EMAIL_ENABLED=true
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your_email@gmail.com
EMAIL_SMTP_PASS=your_app_password_here
EMAIL_TO=user1@gmail.com,user2@yahoo.com,user3@company.com,user4@gmail.com
```

### Example Scenarios

#### Scenario 1: Team Notifications
Send to 3 team members:
```env
EMAIL_TO=alice@company.com,bob@company.com,charlie@company.com
```

#### Scenario 2: Personal + Backup
Your primary email plus backup:
```env
EMAIL_TO=you@gmail.com,backup@gmail.com
```

#### Scenario 3: Multiple Personal Emails
Send to your work and personal emails:
```env
EMAIL_TO=you@gmail.com,you@company.com
```

### How Bot Handles Multiple Emails

1. **Global Keywords**: All recipients get notification
2. **Personal Keywords**: All recipients get notification (by design)
3. **Error Handling**: If one email fails, others still get it
4. **Retry Logic**: Each email gets 3 retry attempts

Example output when sending:
```
📧 Email sent to 3/3 recipients
```

If one fails:
```
⚠️ Failed to send email to 1 recipients
📧 Email sent to 2/3 recipients
```

## 👥 Multiple Telegram Users

### How It Works
Add additional users via `TELEGRAM_ADDITIONAL_CHAT_IDS` environment variable.

### .env Configuration for Multiple Users

```env
TELEGRAM_BOT_TOKEN=123456:ABC-defghijklmnopqrstuvwxyz
TELEGRAM_CHAT_ID=1022850808

# Add more users (comma-separated)
TELEGRAM_ADDITIONAL_CHAT_IDS=123456789,987654321,555123456
```

### Finding Telegram Chat IDs

1. Start a chat with [@userinfobot](https://t.me/userinfobot)
2. Send any message
3. Bot replies with your ID
4. Copy the ID number

### Adding Users Dynamically

You can also add users via Telegram commands:

#### As Admin:
```
/approve 123456789
```

This will:
- Add user to authorized users
- User can now receive notifications
- Saves to `config/telegram-auth.json`

#### Check All Users:
```
/users
```

Shows:
- All authorized users (👑 = admin, 👤 = user)
- User statistics
- Total users count

## 🎯 How Both Systems Work Together

### Example Setup

**Your .env:**
```env
# Telegram - Primary user (you)
TELEGRAM_CHAT_ID=1022850808

# Telegram - Additional users
TELEGRAM_ADDITIONAL_CHAT_IDS=123456789,987654321

# Email - Multiple recipients
EMAIL_ENABLED=true
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your_email@gmail.com
EMAIL_SMTP_PASS=your_app_password
EMAIL_TO=you@gmail.com,colleague@company.com,backup@gmail.com
```

### When Keywords Are Detected

**Global Keywords:**
- ✅ All Telegram users get notification
- ✅ All Email users get notification

**Personal Keywords:**
- ✅ User who added the keyword gets Telegram notification
- ✅ User who added the keyword gets Email notification
- ⏰ Repeating reminders activated for that user only

## 🔐 Authorization System

### User Levels

#### 1. **Primary User** (TELEGRAM_CHAT_ID)
- First user added
- Receives all notifications
- Has admin privileges by default

#### 2. **Additional Users** (TELEGRAM_ADDITIONAL_CHAT_IDS)
- Receives all notifications
- Regular user by default
- Can be promoted to admin via `/admin` panel

#### 3. **Approved Users** (via /approve command)
- Added dynamically by admin
- Regular user privileges
- Can manage personal keywords

### Admin Privileges

Admins can:
- ✅ `/approve <user_id>` - Add new users
- ✅ `/reject <user_id>` - Remove users
- ✅ `/pending` - Show approval requests
- ✅ `/addkeyword <word>` - Add global keywords
- ✅ `/removekeyword <word>` - Remove global keywords
- ✅ `/users` - List all users
- ✅ `/admins` - List admin users

Regular users can:
- ✅ `/addmykeyword <word>` - Add personal keywords
- ✅ `/removemykeyword <word>` - Remove personal keywords
- ✅ `/mykeywords` - List their personal keywords
- ✅ `/mygroups` - Manage group subscriptions
- ✅ `/ok` - Acknowledge reminders

## 📊 Complete Configuration Example

### For a Team of 5 People

**Your .env:**
```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=1022850808
TELEGRAM_ADDITIONAL_CHAT_IDS=123456789,987654321,555123456,444567890

# Email Notifications
EMAIL_ENABLED=true
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=team@gmail.com
EMAIL_SMTP_PASS=your_app_password
EMAIL_TO=admin@company.com,dev1@company.com,dev2@company.com,dev3@company.com,dev4@company.com

# Server
PORT=3000
NODE_ENV=production
```

### Result

- **5 Telegram users** receive notifications
- **5 Email addresses** receive notifications
- **Global keywords**: All 10 recipients get notified
- **Personal keywords**: Specific user gets notified (Telegram + Email + Reminders)

## 💡 Pro Tips

### Tip 1: Separate Email and Telegram
Keep them separate! Email for backup, Telegram for instant alerts.

### Tip 2: Use Admin Panel
Easily manage users via Telegram `/admin` command.

### Tip 3: Fallback Admin
Set `TELEGRAM_FALLBACK_ADMIN` for recovery:
```env
TELEGRAM_FALLBACK_ADMIN=backup_admin_id
```

### Tip 4: Test Gradually
1. Add one additional user
2. Test notifications
3. Add more users
4. Test again

### Tip 5: Monitor Status
```bash
# Check who receives notifications
/users

# Check bot statistics
/stats
```

## 🚨 Important Notes

### Email Limitations
- **Gmail**: 500 emails/day (free tier)
- **Multiple recipients**: Still counts as 1 email per keyword detection
- **Retry logic**: 3 attempts per recipient

### Telegram Limitations
- **No rate limits** for notifications
- **Bot must be running** to send notifications
- **User must authorize** via `/start` (for additional users)

### Security
- ✅ Never commit `.env` file
- ✅ Use strong app passwords for email
- ✅ Restrict bot access to authorized users only
- ✅ Monitor `/users` regularly

## ✅ Quick Setup Checklist

- [ ] Copy `env.example` to `.env`
- [ ] Add `TELEGRAM_CHAT_ID` (your ID)
- [ ] Add `TELEGRAM_ADDITIONAL_CHAT_IDS` (comma-separated)
- [ ] Configure email settings
- [ ] Add all email addresses to `EMAIL_TO`
- [ ] Test with one additional user
- [ ] Test with multiple emails
- [ ] Verify all users receive notifications
- [ ] Set up fallback admin

## 🎉 You're Ready!

Your bot now supports:
- ✅ Multiple email recipients
- ✅ Multiple Telegram users
- ✅ Admin approval system
- ✅ Personal vs global keywords
- ✅ Repeating reminders for personal keywords
- ✅ File attachment notifications
- ✅ Multi-language keyword detection

Happy monitoring! 🚀
