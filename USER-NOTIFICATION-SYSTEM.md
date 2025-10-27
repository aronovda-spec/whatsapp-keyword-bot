# User & Notification System Explained

## 🎯 Quick Overview

This document explains who can use the bot, who gets notifications, and where all data is stored.

---

## 1️⃣ WHO CAN USE THE BOT?

### Authorized Users (in Supabase `authorized_users` table)
Users who can interact with the bot via Telegram commands like `/start`, `/help`, etc.

**Storage:** 
- ✅ Supabase database (`authorized_users` table)
- 📁 Fallback: `config qualifying-telegram-auth.json`

**How they get access:**
1. Hardcoded: Your user ID (1022850808) - always admin
2. Environment variable: `KNOWN_USERS_OR_IDS` - comma-separated user IDs
3. Admin approval: When admin uses `/approve <userId>`
4. Database: Loaded from Supabase `authorized_users` table on startup

**Admin Users:**
- Same table, but with `is_admin = true`
- Can use admin commands: `/approve`, `/reject`, `/makeadmin`, etc.
- Currently: Only you (1022850808) is admin

---

## 2️⃣ WHO GETS TELEGRAM NOTIFICATIONS?

### Global Keywords → ALL Authorized Users
When a global keyword is detected (like "urgent", "חשוב", etc.):

**Who receives:** ALL users in `authorized_users` table
**How many:** Everyone who can use the bot
**Channel:** Telegram only

### Personal Keywords → SPECIFIC User
When a personal keyword is detected (user's own keywords):

**Who receives:** ONLY that specific user
**How many:** Just 1 person
**Channel:** Telegram + Email (if configured for that user)

---

## 3️⃣ WHO GETS EMAIL NOTIFICATIONS?

### Global Keywords → Global Email List
**Recipients:** `EMAIL_TO` environment variable (comma-separated)
**Example:** `EMAIL_TO=admin@company.com,team@company.com`
**When:** Every global keyword detection

### Personal Keywords → Per-User Email
**Recipients:** Defined in `config/user-emails.json`
**Format:**
```json
{
  "TELEGRAM_USER_ID": "user@email.com",
  "123456789": "john@gmail.com",
  "987654321": ["work@df.com", "personal@gmail.com"]  
}
```
**When:** Only when that user's personal keyword is detected
**Fallback:** If no per-user email, uses global `EMAIL_TO`

---

## 4️⃣ WHERE IS ALL DATA STORED?

### 🗄️ Supabase Database (Primary)

#### Table: `authorized_users`
- Stores: User IDs and admin status
- Fields: `user_id`, `is_admin`, `created_at`
- Who: All users who can use the bot

#### Table: `global_keywords`
- Stores: All global keywords (52 currently)
- Fields: `keyword`, `enabled`, `match_type`, `fuzzy_threshold`, `added_at`
- Who: Keywords detected for everyone

#### Table: `personal_keywords`
- Stores: Each user's personal keywords
- Fields: `user_id`, `keywords` (JSON array), `updated_at`
- Who: Individual user preferences

#### Table: `group_subscriptions`
- Stores: Which users are subscribed to which groups
- Fields: `user_id`, `group_name`, `created_at`
- Who: User → Group relationships

#### Table: `user_preferences`
- Stores: User settings (timezone, etc.)
- Fields: `user_id`, `timezone`, `updated_at`
- Who: Individual user preferences

#### Table: `active_reminders`
- Stores: Active reminder notifications
- Fields: `user_id`, `keyword`, `message`, `first_detected_at`, `reminder_count`
- Who: Only for users with active personal keyword reminders

### 📦 Supabase Storage (Cloud Backup)

#### Bucket: `whatsapp-sessions`
- Stores: WhatsApp session files (cloud backup)
- What: Prevents QR rescan on deploy/restart
- When: After every connection/credential update

---

## 5️⃣ FALLBACK STORAGE (Local Files)

If Supabase is not configured or fails, falls back to:

### 📁 Local JSON Files

#### `config/telegram-auth.json`
- Stores: Authorized users and admins
- Fields: `authorizedUsers`, `adminUsers`, `userNames`

#### `config/personal-keywords.json`
- Stores: Personal keywords per user
- Format: `{ "userId": ["keyword1", "keyword2"] }`

#### `config/keywords.json`
- Stores: Global keywords (fallback only now)
- Note: Now loads from Supabase first

#### `config/group-subscriptions.json`
- Stores: User → Group subscriptions
- Format: `{ "groupName": ["userId1", "userId2"] }`

#### `config/user-preferences.json`
- Stores: User preferences
- Format: `{ "userId": { "timezone": "UTC" } }`

#### `config/reminders.json`
- Stores: Active reminders
- Format: `{ "userId": { ...reminder data... } }`

#### `sessions/`
- Stores: WhatsApp session files locally
- Note: Also backed up to Supabase Storage

---

## 6️⃣ FLOW DIAGRAM

### Global Keyword Detected:
```
WhatsApp Message → Bot Detects "urgent"
    ↓
Notification Sent To:
    ├─ ALL Users (Telegram) via authorized_users table
    └─ Global Email List (Email) via EMAIL_TO env var
```

### Personal Keyword Detected:
```
WhatsApp Message → Bot Detects User's Personal Keyword
    ↓
Notification Sent To:
    ├─ THAT User Only (Telegram)
    └─ THAT User's Email (from user-emails.json) OR Global EMAIL_TO
```

---

## 7️⃣ SUMMARY TABLE

| Data Type | Primary Storage | Backup Storage | Notes |
|-----------|----------------|----------------|-------|
| **Authorized Users** | Supabase `authorized_users` | `telegram-auth.json` | Includes admin status |
| **Global Keywords** | Supabase `global_keywords` | `keywords.json` | 52 keywords |
| **Personal Keywords** | Supabase `personal_keywords` | `personal-keywords.json` | Per user |
| **Group Subscriptions** | Supabase `group_subscriptions` | `group-subscriptions.json` | User → Group |
| **User Preferences** | Supabase `user_preferences` | `user-preferences.json` | Timezone, etc. |
| **Active Reminders** | Supabase `active_reminders` | `reminders.json` | Only for users with reminders |
| **WhatsApp Sessions** | Supabase Storage | `sessions/` folder | Cloud backup |

---

## 8️⃣ CURRENT STATUS

✅ **Supabase Enabled:** YES
- All data is in Supabase database
- Fallback to local files if Supabase unavailable

✅ **Admin User:** You (1022850808)
- Stored in Supabase as admin

✅ **Global Keywords:** 52 keywords
- Loaded from Supabase database

✅ **Session Backup:** Working
- Backed up to Supabase Storage after every connection

---

## 💡 TO ADD A NEW USER

1. They send `/start` to your bot
2. Admin gets notified
3. Admin uses `/approve <userId>` 
4. User is added to Supabase `authorized_users` table
5. They can now use the bot and receive notifications

## 👑 TO MAKE A USER ADMIN

1. Admin uses `/makeadmin <userId>` command
2. User's `is_admin` is set to `true` in Supabase
3. They can now use admin commands

---

## 📧 TO ADD EMAIL FOR A USER

1. Edit `config/user-emails.json`
2. Add: `{ "userId": "email@example.com" }`
3. For multiple emails: `{ "userId": ["email1@example.com", "email2@example.com"] }`
4. Restart bot (or it will auto-load next time)

---

**That's it! This is how the entire system works.**

