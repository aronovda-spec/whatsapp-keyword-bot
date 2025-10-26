# Email Notifications - Setup Guide

## ✅ What Was Added

Email notifications are now supported alongside Telegram! When a keyword is detected, notifications will be sent to both Telegram and Email.

## 📧 How to Configure Email

### Step 1: Choose Your Email Provider

#### Option A: Gmail (Recommended, Free)
- **SMTP Host**: `smtp.gmail.com`
- **Port**: `587`
- **Free Limit**: 500 emails/day
- **Setup**: Requires App Password

#### Option B: SendGrid (Free Tier)
- **SMTP Host**: `smtp.sendgrid.net`
- **Port**: `587`
- **Free Limit**: 100 emails/day
- **Setup**: Free account at sendgrid.com

#### Option C: Any SMTP Server
- Use your existing email server's SMTP settings

### Step 2: Get Your SMTP Credentials

#### For Gmail:
1. Go to your Google Account settings
2. Enable 2-Factor Authentication
3. Go to "App passwords"
4. Generate a new app password for "Mail"
5. Copy the 16-character password

#### For SendGrid:
1. Sign up at sendgrid.com
2. Go to Settings → API Keys
3. Create an API key with "Mail Send" permission
4. Use your SendGrid username and API key

### Step 3: Configure Environment Variables

Edit your `.env` file:

```env
# Enable Email Notifications
EMAIL_ENABLED=true

# SMTP Settings
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your_email@gmail.com
EMAIL_SMTP_PASS=your_app_password_here

# Recipients (comma-separated)
EMAIL_TO=user1@example.com,user2@example.com
```

### Step 4: Restart the Bot

After configuring, restart your bot:
```bash
npm start
```

You should see:
```
✅ Email notifications enabled
📧 Email will be sent to 2 recipients
```

## 🎨 Email Format

### HTML Email
Emails include:
- ✅ Beautiful HTML formatting
- ✅ Keyword highlighted
- ✅ Sender, Group, Time info
- ✅ Message preview (500 chars)
- ✅ Attachment information
- ✅ Match type (exact/fuzzy)
- ✅ Plain text fallback

### Example Email
```
Subject: 🚨 Keyword Alert: urgent

🚨 Keyword Alert

Keyword: urgent
Sender: John Doe
Group: Family Chat
Time: 1/15/2025, 2:30:25 PM
Attachment: document - report.pdf (125 KB)

Message:
This is an urgent message requiring immediate attention...
```

## 🧪 Testing

### Test Email Setup

Send a test message with a keyword to see if email is received.

### Check Logs

Look for these messages:
```
✅ Email notifications enabled
📧 Email will be sent to X recipients
📧 Email sent to 1/1 recipients
```

### Troubleshooting

#### Email not sent
1. Check `EMAIL_ENABLED=true`
2. Verify SMTP credentials are correct
3. Check logs for error messages
4. Test SMTP settings manually

#### Gmail Issues
1. Make sure 2FA is enabled
2. Use App Password, not regular password
3. Check Gmail isn't blocking the login

#### SendGrid Issues
1. Verify API key has "Mail Send" permission
2. Check SendGrid dashboard for errors
3. Verify sender email is verified

## 📊 Free Tier Compatibility

### On Free Render
- ✅ **RAM**: +2 MB (very low)
- ✅ **CPU**: Minimal impact
- ✅ **Network**: Low bandwidth
- ✅ **Cost**: Free

### Limits
- **Gmail**: 500 emails/day free
- **SendGrid**: 100 emails/day free
- **Processing**: < 2 seconds per email

## 🔧 Configuration Options

### Disable Email
Set in `.env`:
```env
EMAIL_ENABLED=false
```

### Change SMTP Settings
```env
EMAIL_SMTP_HOST=your_smtp_host
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your_email
EMAIL_SMTP_PASS=your_password
```

### Add More Recipients
```env
EMAIL_TO=user1@example.com,user2@example.com,user3@example.com
```

## 🎯 How It Works

1. **Keyword Detected** in WhatsApp message
2. **Parallel Notification**:
   - Telegram → Sent immediately
   - Email → Sent immediately
3. **Both channels** work independently
4. **If one fails**, the other still sends

## 📝 Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `EMAIL_ENABLED` | Yes | Enable/disable email | `true` |
| `EMAIL_SMTP_HOST` | Yes | SMTP server | `smtp.gmail.com` |
| `EMAIL_SMTP_PORT` | Yes | SMTP port | `587` |
| `EMAIL_SMTP_USER` | Yes | SMTP username | `user@gmail.com` |
| `EMAIL_SMTP_PASS` | Yes | SMTP password | `app_password` |
| `EMAIL_TO` | Yes | Recipients | `user1@mail.com,user2@mail.com` |

## 🚀 Production Deployment

### Render (Free Tier)
1. Add environment variables in Render dashboard
2. Deploy your bot
3. Email will work automatically!

### Other Platforms
1. Set environment variables
2. Start bot
3. Done!

## ✅ Features

- ✅ Multi-recipient support
- ✅ HTML formatted emails
- ✅ Plain text fallback
- ✅ Retry mechanism (3 attempts)
- ✅ Error handling
- ✅ Attachment info included
- ✅ Free tier compatible
- ✅ Works alongside Telegram

## 🎉 Done!

Your bot now sends notifications to:
- ✅ **Telegram** (instant messaging)
- ✅ **Email** (reliable, permanent record)

Both channels are independent - if one fails, the other still works!

