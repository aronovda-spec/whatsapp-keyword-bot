# WhatsApp Bot Number Setup Guide

## 🚨 CRITICAL: Use Dedicated Bot Numbers Only

**NEVER use your personal WhatsApp number for the bot!**

## 📱 How to Get Dedicated Bot Numbers

### 1. Virtual Phone Number Services

#### ✅ **Google Voice (Recommended - US)**
- **Cost**: Free
- **Setup**: 
  1. Go to voice.google.com
  2. Sign up with Google account
  3. Choose a phone number
  4. Verify with existing phone
- **Pros**: Free, reliable, good for testing
- **Cons**: US numbers only

#### ✅ **TextNow (US/Canada)**
- **Cost**: Free tier available
- **Setup**:
  1. Download TextNow app
  2. Sign up for free account
  3. Choose phone number
  4. Verify with email
- **Pros**: Free tier, easy setup
- **Cons**: May have limitations

#### ✅ **Twilio (Professional)**
- **Cost**: $1/month + usage
- **Setup**:
  1. Sign up at twilio.com
  2. Purchase phone number
  3. Configure for WhatsApp
- **Pros**: Professional, reliable, global
- **Cons**: Paid service

#### ✅ **Local VoIP Providers**
- **Cost**: Varies by country
- **Setup**: Contact local telecom providers
- **Pros**: Local numbers, often cheaper
- **Cons**: Varies by provider

### 2. Prepaid SIM Cards

#### ✅ **Dedicated SIM Card**
- **Cost**: $10-30/month
- **Setup**:
  1. Buy prepaid SIM card
  2. Register with provider
  3. Use only for bot
- **Pros**: Real phone number, reliable
- **Cons**: Monthly cost, physical card

## 🛡️ Anti-Ban Best Practices

### 1. Bot Behavior Settings

```javascript
// Configure in config/settings.json
{
  "antiBan": {
    "maxMessagesPerMinute": 5,
    "maxMessagesPerHour": 20,
    "maxMessagesPerDay": 100,
    "humanLikeBehavior": true,
    "randomDelayMin": 2000,
    "randomDelayMax": 8000,
    "enableReadReceipts": false,
    "enableTypingIndicator": false
  }
}
```

### 2. Connection Settings

```javascript
// Optimized Baileys configuration
{
  "browser": ["WhatsApp Bot", "Chrome", "1.0.0"],
  "connectTimeoutMs": 60000,
  "keepAliveIntervalMs": 30000,
  "retryRequestDelayMs": 250,
  "markOnlineOnConnect": false,
  "syncFullHistory": false
}
```

### 3. Monitoring-Only Mode

```javascript
// Bot should ONLY monitor, never send messages
{
  "readOnly": true,
  "noMessageSending": true,
  "noGroupCreation": true,
  "noContactAddition": true,
  "noStatusUpdates": true
}
```

## 📋 Setup Checklist

### ✅ **Phone Number Requirements**
- [ ] Dedicated number (not personal)
- [ ] Virtual or prepaid SIM
- [ ] Can receive SMS verification
- [ ] Stable internet connection
- [ ] Not used for personal WhatsApp

### ✅ **Bot Configuration**
- [ ] Anti-ban settings enabled
- [ ] Rate limiting configured
- [ ] Human-like delays enabled
- [ ] Read-only mode enabled
- [ ] Session persistence enabled

### ✅ **Safety Measures**
- [ ] No automated message sending
- [ ] No group creation
- [ ] No contact addition
- [ ] No status updates
- [ ] Monitoring only

## 🚀 Quick Setup Steps

### 1. Get Virtual Number
```bash
# Option 1: Google Voice (US)
# 1. Go to voice.google.com
# 2. Sign up and get number
# 3. Verify with existing phone

# Option 2: TextNow (US/Canada)
# 1. Download TextNow app
# 2. Sign up for free account
# 3. Choose phone number
```

### 2. Configure Bot
```bash
# Edit config/multi-phone.json
{
  "phones": [
    {
      "number": "+1XXXXXXXXXX",  # Your virtual number
      "sessionPath": "./sessions/bot1",
      "enabled": true,
      "description": "Dedicated bot number"
    }
  ]
}
```

### 3. Start Bot
```bash
npm start
# Scan QR code with virtual number
# Bot will monitor only (no sending)
```

## ⚠️ Important Warnings

### ❌ **NEVER Do These:**
- Use personal WhatsApp number
- Send automated messages
- Create groups automatically
- Add contacts automatically
- Spam or send bulk messages
- Use for commercial purposes without permission

### ✅ **ALWAYS Do These:**
- Use dedicated bot numbers
- Monitor only (read-only)
- Respect rate limits
- Use human-like delays
- Keep sessions persistent
- Follow WhatsApp ToS

## 🔧 Troubleshooting

### Common Issues:

#### **QR Code Not Appearing**
- Clear session files: `rm -rf sessions/*`
- Restart bot: `npm start`
- Check internet connection

#### **Connection Drops**
- Check anti-ban settings
- Reduce connection frequency
- Use stable internet

#### **Account Banned**
- Stop using immediately
- Get new virtual number
- Review bot behavior
- Implement stricter rate limiting

## 📞 Support

If you need help setting up dedicated bot numbers:
1. Check your country's VoIP providers
2. Look for prepaid SIM options
3. Consider professional services like Twilio
4. Always prioritize compliance and safety

Remember: **Better to be safe than banned!** 🛡️
