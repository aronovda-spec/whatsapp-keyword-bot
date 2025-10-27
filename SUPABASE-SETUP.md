# Supabase Setup Guide

## ✅ Full Integration Complete!

The bot now fully supports Supabase for:
- ✅ User authorization management
- ✅ Personal keywords storage
- ✅ Group subscriptions
- ✅ Active reminders
- ✅ WhatsApp session backup

**Backward Compatible:** The bot works perfectly without Supabase using local file storage.

---

## Quick Setup (5 Minutes)

### Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Sign up for free account
3. Click "New Project"
4. Choose your organization
5. Project details:
   - **Name:** whatsapp-keyword-bot
   - **Database Password:** (save this securely)
   - **Region:** Choose closest to you
   - **Pricing:** Free Plan
6. Click "Create new project"
7. Wait 2 minutes for setup

### Step 2: Get API Credentials
1. Go to Project Settings → API
2. Copy:
   - **Project URL** (SUPABASE_URL)
   - **anon public key** (SUPABASE_KEY)

### Step 3: Create Database Tables
Go to SQL Editor and run this script:

```sql
-- Authorized Users
CREATE TABLE IF NOT EXISTS authorized_users (
    user_id TEXT PRIMARY KEY,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Personal Keywords
CREATE TABLE IF NOT EXISTS personal_keywords (
    user_id TEXT PRIMARY KEY,
    keywords JSONB DEFAULT '[]',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group Subscriptions
CREATE TABLE IF NOT EXISTS group_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    group_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, group_name)
);

-- User Preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY,
    timezone TEXT DEFAULT 'UTC',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active Reminders
CREATE TABLE IF NOT EXISTS active_reminders (
    user_id TEXT PRIMARY KEY,
    keyword TEXT NOT NULL,
    message TEXT,
    sender TEXT,
    group_name TEXT,
    first_detected_at TIMESTAMPTZ,
    next_reminder_at TIMESTAMPTZ,
    reminder_count INTEGER DEFAULT 0,
    acknowledged BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_group_subscriptions_user_id ON group_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_group_subscriptions_group_name ON group_subscriptions(group_name);
CREATE INDEX IF NOT EXISTS idx_active_reminders_user_id ON active_reminders(user_id);
```

### Step 4: Create Storage Bucket
1. Go to Storage
2. Click "New bucket"
3. Name: `whatsapp-sessions`
4. Public: NO (private)
5. Click "Create bucket"

### Step 5: Add Environment Variables
Add to your `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key-here
```

### Step 6: Test Connection
```bash
npm start
```

You should see:
```
✅ Supabase: Connected to cloud database
```

---

## What Data Is Stored in Supabase

### Database Tables:
- **authorized_users** - User access control
- **personal_keywords** - User personal keywords
- **group_subscriptions** - Group subscriptions
- **user_preferences** - Timezone and settings
- **active_reminders** - Active reminder tracking

### Storage:
- **whatsapp-sessions** - WhatsApp session files (cloud backup)

---

## Benefits

✅ **Never lose session** - Cloud backup  
✅ **Database backup** - Automatic by Supabase  
✅ **Better analytics** - Query your data  
✅ **Multi-server support** - Run multiple instances  
✅ **Free tier** - 500MB database, 1GB storage  

---

## Free Tier Limits

- **Database:** 500MB
- **Storage:** 1GB
- **API requests:** Unlimited (reasonable usage)
- **Bandwidth:** 5GB/month

**This is enough for:**
- 1000+ users
- 10,000+ keywords
- 1000+ active reminders
- Multiple WhatsApp sessions

---

## Troubleshooting

### "Supabase initialization failed"
- Check SUPABASE_URL and FOLLOW_KEY in `.env`
- Verify project is active in Supabase dashboard

### "relation does not exist"
- Run the SQL script in SQL Editor
- Make sure tables were created successfully

### "permission denied"
- Check RLS (Row Level Security) policies
- For testing, you can disable RLS on tables

---

## Done! 🎉

Your bot now has cloud database + session backup!

