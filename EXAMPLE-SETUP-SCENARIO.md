# Example Setup: Admin + 2 Users with Multiple Emails

## Scenario Setup

You want to set up the bot with:
- **1 Admin user** (you) - Can manage everything
- **2 Regular users** - Can receive notifications and manage personal keywords

---

## 📱 Telegram Configuration

### Your `.env` file:
```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Primary Admin (you)
TELEGRAM_CHAT_ID=123456789

# Additional users (will be approved and added to database)
TELEGRAM_ADDITIONAL_CHAT_IDS=987654321,111222333

# Fallback admin (for recovery)
TELEGRAM_FALLBACK_ADMIN=999888777
```

**User IDs:**
- `123456789` - Admin (you)
- `987654321` - User 2
- `111222333` - User 3

---

## 📧 Email Configuration

### Global Emails (in `.env`):
```env
EMAIL_ENABLED=true
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=admin@company.com
EMAIL_SMTP_PASS=your_app_password

# Global keyword alerts sent to ALL these emails
EMAIL_TO=admin@company.com troublesome backup@company.com
```

### Per-User Emails (in `config/user-emails.json`):
```json
{
  "// Admin (1 email for simplicity)": "null",
  "123456789": "admin@company.com",
  
  "// User 2 (receives at 2 different emails)": "null",
  "987654321": [
    "alice.work@company.com",
    "alice.personal@gmail.com"
  ],
  
  "// User 3 (1 email)": "null",
  "111222333": "bob@company.com"
}
```

---

## 🗄️ Database Setup

### After running migration, your `users` table will look like:

| user_id    | username | is_admin | email                 | created_at |
|------------|----------|----------|-----------------------|------------|
| 123456789  | admin    | true     | admin@company.com     | 2025-01-01 |
| 987654321  | alice    | false    | alice.work@...        | 2025-01-02 |
| 111222333  | bob      | false    | bob@company.com       | 2025-01-02 |

### Email Storage:

Emails are stored in TWO places:

1. **`users` table** (primary email per user)
   - One email per user
   - Used for database queries

2. **`config/user-emails.json`** (multiple emails per user)
   - Can have multiple emails for same user
   - Used for sending notifications

---

## 📬 How Notifications Work

### Scenario 1: Global Keyword Detected

**Message contains:** "urgent meeting"

**Notification sent to:**
- **Telegram:** ALL 3 users (123456789, 987654321, 111222333)
- **Email:** ALL emails in `EMAIL_TO` (admin@company.com, backup@company.com)

---

### Scenario 2: Alice's Personal Keyword Detected

**User 2 (Alice) has personal keyword:** "vacation"

**Message contains:** "vacation request"

**Notification sent to:**
- **Telegram:** Only Alice (987654321)
- **Email:** 
  - `alice.work@company.com` (from user-emails.json)
  - `alice.personal@gmail.com` (from user-emails.json)

---

### Scenario 3: Bob's Personal Keyword Detected

**User 3 (Bob) has personal keyword:** "project"

**Message contains:** "project deadline"

**Notification sent to:**
- **Telegram:** Only Bob (111222333)
- **Email:** Only `bob@company.com` (from user-emails.json)

---

## 🎯 Complete Setup Steps

### 1. Create `.env` file:
```env
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=123456789
EMAIL_ENABLED=true
EMAIL_SMTP_USER=admin@company.com
EMAIL_SMTP_PASS=app_password
EMAIL_TO=admin@company.com,backup@company.com
SUPABASE_URL=https://...
SUPABASE_KEY=...
SUPABASE_SERVICE_KEY=...
```

### 2. Create `config/user-emails.json`:
```json
{
  "123456789": "admin@company.com",
  "987654321": ["alice.work@company.com", "alice.personal@gmail.com"],
  "111222333": "bob@company.com"
}
```

### 3. Run Migration:
```bash
node migrate-to-unified-schema.js
node update-user-email.js
```

### 4. Approve Users:
When User 2 and User 3 send `/start` to your bot:
- You receive notification
- You use `/approve 987654321` to approve Alice
- You use `/approve 111222333` to approve Bob

### 5. Users Add Personal Keywords:
- Alice: `/addmykeyword vacation`
- Bob: `/addmykeyword project`

---

## 📊 Database State After Setup

### `users` table:
```
✅ user_id: 123456789, is_admin: true, email: admin@company.com
✅ user_id: 987654321, is_admin: false, email: alice.work@company.com  
✅ user_id: 111222333, is_admin: false, email: bob@company.com
```

### Multiple emails handled via:
- Primary email in `users` table (for database operations)
- Additional emails in `config/user-emails.json` (for notifications)

---

## ✅ Result

**3 users with email notifications:**
- ✅ Admin: Receives at 1 email
- ✅ Alice: Receives at 2 emails (work + personal)
- ✅ Bob: Receives at 1 email

**All notifications work correctly!** 🎉

