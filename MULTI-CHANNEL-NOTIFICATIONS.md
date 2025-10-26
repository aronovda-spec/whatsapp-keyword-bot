# Multiple Notification Channels - Implementation Analysis

## Current Status

### ✅ Currently Supported
- **Telegram**: Fully implemented and working
- Multiple Telegram users (via `TELEGRAM_ADDITIONAL_CHAT_IDS`)
- Authorization system
- HTML formatted messages
- Retry mechanism

### ❌ Not Currently Supported
- Email notifications
- SMS/WhatsApp messages
- Discord webhooks
- Slack webhooks
- Push notifications
- Database logging

## Proposed Multi-Channel Architecture

### Option 1: Channel Abstraction (Recommended)

Create a plugin system where each channel is independent:

```javascript
// Multiple channels, configured separately
const notificationChannels = {
    telegram: { enabled: true, config: {...} },
    email: { enabled: true, config: {...} },
    discord: { enabled: false, config: {...} }
};
```

### Option 2: Unified Notifier with Providers

Single notifier that routes to multiple channels:

```javascript
class MultiChannelNotifier {
    constructor() {
        this.channels = [];
        this.loadChannels();
    }
    
    async notify(keyword, message, ...) {
        // Send to all enabled channels
        for (const channel of this.channels) {
            await channel.send(keyword, message, ...);
        }
    }
}
```

## Free Render Compatible Channels

### ✅ Easy to Implement (Low Resource)

#### 1. **Email (SMTP)** ✅
**Compatibility**: Free Render ✅

**Requirements**:
- Nodemailer library (already lightweight)
- SMTP credentials (Gmail, SendGrid, etc.)
- No extra memory/CPU

**Implementation**:
```javascript
// Simple email channel
const nodemailer = require('nodemailer');

class EmailChannel {
    async send(keyword, message, ...) {
        // Send email via SMTP
    }
}
```

**Free Options**:
- Gmail SMTP (free, 500/day limit)
- SendGrid (100 emails/day free)
- Mailgun (100 emails/day free)

#### 2. **Discord Webhooks** ✅
**Compatibility**: Free Render ✅

**Requirements**:
- Simple HTTP POST
- Webhook URL
- No libraries needed (use fetch)

**Implementation**:
```javascript
class DiscordChannel {
    async send(keyword, message, ...) {
        await fetch(webhookUrl, {
            method: 'POST',
            body: JSON.stringify({ content: alertMessage })
        });
    }
}
```

**Free**: Discord webhooks are free!

#### 3. **Slack Webhooks** ✅
**Compatibility**: Free Render ✅

**Requirements**:
- HTTP POST to Slack API
- Webhook URL or OAuth token

**Implementation**:
Similar to Discord - simple HTTP calls.

**Free**: Slack free tier works great!

### ⚠️ Challenging (More Resources)

#### 4. **SMS/Push Notifications** ⚠️
**Compatibility**: Free Render ✅ (with external services)

**Requirements**:
- Twilio API (paid, ~$0.0075/SMS)
- OneSignal (free for basic)
- Firebase Cloud Messaging (free)

**Cost**: 
- SMS: ~$0.01 per message (expensive for frequent use)
- Push: Free but requires app setup

#### 5. **Database Logging** ✅
**Compatibility**: Free Render ✅

**Requirements**:
- MongoDB Atlas (free tier)
- Or SQLite (lightweight)
- Or PostgreSQL (Render free tier)

**Implementation**:
```javascript
class DatabaseChannel {
    async log(keyword, message, ...) {
        await db.insert('alerts', {
            keyword, message, timestamp: Date.now()
        });
    }
}
```

**Free Options**:
- MongoDB Atlas (512 MB free)
- Supabase (500 MB free)
- Render PostgreSQL (add-on)

### ❌ Not Recommended on Free Render

#### 6. **WhatsApp Messages** ❌
**Why**: Would require another WhatsApp connection (double the resources)

#### 7. **Internal Queue System** ⚠️
**Why**: Adds memory/CPU overhead

## Recommended Implementation

### Phase 1: Add Email & Discord (Easiest) ✅

These require minimal resources and are free to use:

#### Email Channel
```javascript
// config/notifier-channels.json
{
  "email": {
    "enabled": true,
    "smtp": {
      "host": "smtp.gmail.com",
      "port": 587,
      "secure": false,
      "auth": {
        "user": "you@gmail.com",
        "pass": "your_app_password"
      }
    },
    "to": ["user1@example.com", "user2@example.com"]
  }
}
```

#### Discord Channel
```javascript
{
  "discord": {
    "enabled": true,
    "webhookUrl": "https://discord.com/api/webhooks/..."
  }
}
```

#### Slack Channel
```javascript
{
  "slack": {
    "enabled": true,
    "webhookUrl": "https://hooks.slack.com/services/..."
  }
}
```

### Resource Usage

| Channel | RAM | Time | Cost | Free Tier |
|---------|-----|------|------|-----------|
| **Telegram** | ~5 MB | <1s | Free | ✅ |
| **Email** | ~2 MB | <2s | Free* | ✅ |
| **Discord** | ~1 MB | <1s | Free | ✅ |
| **Slack** | ~1 MB | <1s | Free | ✅ |
| **Database** | ~10 MB | <1s | Free* | ✅ |
| **SMS** | ~1 MB | <2s | $0.01/msg | ⚠️ |

*Free with limits (Gmail: 500/day, SendGrid: 100/day)

## Implementation Plan

### Option A: Extend Current Notifier (Simplest) ✅

Add channels to existing `notifier.js`:

```javascript
class Notifier {
    constructor() {
        this.telegram = new TelegramChannel();
        this.email = new EmailChannel();      // New
        this.discord = new DiscordChannel();  // New
    }
    
    async sendKeywordAlert(...) {
        // Send to all enabled channels
        await Promise.all([
            this.telegram.send(...),
            this.email.send(...),      // Parallel
            this.discord.send(...)
        ]);
    }
}
```

**Pros**: Quick to implement, minimal changes  
**Cons**: All-in-one file, harder to maintain

### Option B: Plugin System (Better) ✅

Create separate channel modules:

```
src/
  notifiers/
    telegram.js
    email.js
    discord.js
    slack.js
    database.js
  notifier.js  (orchestrator)
```

**Pros**: Clean separation, easy to add/remove  
**Cons**: More files, slightly more complex

### Option C: Unified Interface (Best) ✅

```javascript
// src/notifiers/base.js
class NotificationChannel {
    async send(keyword, message, sender, ...) {
        throw new Error('Must implement send()');
    }
}

// src/notifiers/email.js
class EmailChannel extends NotificationChannel {
    async send(keyword, message, ...) {
        // Email implementation
    }
}

// src/notifiers/discord.js
class DiscordChannel extends NotificationChannel {
    async send(keyword, message, ...) {
        // Discord implementation
    }
}

// src/notifier.js
class MultiChannelNotifier {
    constructor() {
        this.channels = [
            new TelegramChannel(),
            new EmailChannel(),
            new DiscordChannel()
        ].filter(c => c.enabled);
    }
    
    async notify(...) {
        await Promise.all(
            this.channels.map(c => c.send(...))
        );
    }
}
```

**Pros**: Clean, extensible, maintainable  
**Cons**: More initial work

## Quick Start: Email & Discord

Want me to implement email and Discord webhooks? 

### They're:
- ✅ Free to use
- ✅ Low resource usage
- ✅ Easy to configure
- ✅ Fast implementation

### Setup Required:

**Email**:
```env
EMAIL_ENABLED=true
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=you@gmail.com
EMAIL_SMTP_PASS=app_password
EMAIL_TO=user1@example.com,user2@example.com
```

**Discord**:
```env
DISCORD_ENABLED=true
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

## Cost Analysis

### Free Tier Limits

| Service | Free Tier | Limit |
|---------|-----------|-------|
| Telegram | Free | Unlimited |
| Gmail SMTP | Free | 500/day |
| SendGrid | Free | 100/day |
| Discord | Free | Unlimited |
| Slack | Free | Unlimited |
| Twilio SMS | Paid | $0.0075/msg |
| Database | Free* | Various |

*MongoDB Atlas: 512 MB, Supabase: 500 MB

## Recommendation

### For Free Render: ✅ Email + Discord

**Why these two:**
- ✅ **Free**: No cost
- ✅ **Lightweight**: <5 MB RAM total
- ✅ **Fast**: <2 seconds per notification
- ✅ **Reliable**: High success rate
- ✅ **Easy**: Simple API/webhook integration

**Skip for now:**
- ❌ SMS (too expensive)
- ❌ Database logging (can add later if needed)
- ❌ WhatsApp (double resources)

### Implementation Priority

1. **Discord** (easiest, 5 minutes)
2. **Email** (10 minutes, SMTP setup)
3. **Database** (20 minutes, optional)
4. **SMS** (not recommended due to cost)

## Conclusion

**Multi-channel notifications are feasible on free Render!**

**Easiest to add:**
- ✅ Discord webhooks (free, instant)
- ✅ Email (free, simple)
- ✅ Slack webhooks (free, easy)

**Would you like me to implement Discord and Email notifications?**

