# Per-User Email Setup Guide

## 🎯 What Problem Does This Solve?

By default, ALL email addresses in `EMAIL_TO` receive ALL notifications (global AND personal keywords).

**Example Problem:**
```
EMAIL_TO=admin@company.com,user2@company.com,user3@company.com

Result: ALL 3 people get EVERY notification!
```

**Solution:** Per-user email mapping allows each user to receive personal keyword alerts at their own email.

## ✅ Two Configuration Options

### Option 1: Global Email (Default - Everyone Gets Everything)

**Your .env:**
```env
EMAIL_TO=admin@company.com,user2@company.com,user3@company.com
```

**Behavior:**
- Global keywords → All 3 emails get notification
- Personal keywords → All 3 emails get notification
- Simple setup, but everyone sees everything

### Option 2: Per-User Email Mapping (Recommended)

**Your .env:**
```env
EMAIL_TO=admin@company.com  # Only for global keywords fallback
```

**Create `config/user-emails.json`:**
```json
{
  "1022850808": "admin@company.com",
  "123456789": "user2@company.com",
  "987654321": "user3@company.com"
}
```

**Behavior:**
- Global keywords → All emails in `EMAIL_TO` get notification
- Personal keywords → ONLY that user's email gets notification
- Privacy preserved!

## 📝 How to Set Up Per-User Emails

### Step 1: Find User IDs

Find each user's Telegram ID:
1. User chats with [@userinfobot](https://t.me/userinfobot)
2. Bot replies with their ID
3. Copy the ID number

### Step 2: Create Mapping File

Create `config/user-emails.json`:

```json
{
  "1022850808": "dani@company.com",
  "123456789": "alice@company.com",
  "987654321": "bob@company.com",
  "555123456": ["primary@gmail.com", "backup@company.com"]
}
```

**Format:**
- Key: Telegram user ID (as string)
- Value: Email address as string (single email) OR array (multiple emails)
- **Multiple emails**: Use array `["email1", "email2"]` to send to multiple addresses

### Step 3: Update .env (Optional)

You can still keep `EMAIL_TO` for global keyword fallback:

```env
# Global keywords go to everyone here
EMAIL_TO=admin@company.com,supervisor@company.com

# Per-user emails in config/user-emails.json override for personal keywords
```

### Step 4: Restart Bot

```bash
npm start
```

You should see:
```
✅ Email notifications enabled
📧 Email will be sent to 2 global recipients
📧 Per-user email mapping: 3 users
```

## 🎯 How It Works

### Global Keywords

**Keywords:** cake, urgent, meeting (admin-managed)

**With EMAIL_TO only:**
```
EMAIL_TO=admin@company.com,user2@company.com,user3@company.com

Result: ALL 3 people get email
```

**With per-user mapping:**
```
EMAIL_TO=admin@company.com
config/user-emails.json: { "1022850808": "admin@company.com" }

Result: Only admin gets email
```

### Personal Keywords

**User 1022850808 adds:** `/addmykeyword budget`

**With EMAIL_TO only:**
```
EMAIL_TO=admin@company.com,user2@company.com,user3@company.com

Result: ALL 3 people get email (privacy issue!)
```

**With per-user mapping:**
```
config/user-emails.json: { "1022850808": "admin@company.com" }

Result: ONLY admin gets email ✅
```

## 📊 Complete Example

### Scenario: 3-User Team

**Telegram Users:**
- Admin (1022850808)
- Dev1 (123456789)
- Dev2 (987654321)

**Email Addresses:**
- Admin: admin@company.com
- Dev1: dev1@gmail.com
- Dev2: dev2@gmail.com

### Configuration

**`.env`:**
```env
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=1022850808
TELEGRAM_ADDITIONAL_CHAT_IDS=123456789,987654321

EMAIL_ENABLED=true
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=bot@company.com
EMAIL_SMTP_PASS=your_app_password

# Global keywords go to supervisor
EMAIL_TO=supervisor@company.com
```

**`config/user-emails.json`:**
```json
{
  "1022850808": "admin@company.com",
  "123456789": "dev1@gmail.com",
  "987654321": "dev2@gmail.com",
  "555123456": ["work@company.com", "personal@gmail.com"]
}
```

**Note:** User 555123456 receives notifications at BOTH work and personal email!

### Result

**Global keywords (cake, urgent, meeting):**
- ✅ Telegram: All 3 users
- ✅ Email: supervisor@company.com

**Personal keywords:**
- Admin's keyword → admin@company.com (email) + Telegram
- Dev1's keyword → dev1@gmail.com (email) + Telegram
- Dev2's keyword → dev2@gmail.com (email) + Telegram

## 🔐 Security Notes

### File Protection

Add to `.gitignore`:
```
config/user-emails.json
```

Already done! ✅

### Best Practices

1. **Don't commit** `config/user-emails.json` to git
2. **Use strong emails** for admin users
3. **Test with one user first** before adding all
4. **Keep `EMAIL_TO`** as fallback for global keywords
5. **Monitor logs** to ensure emails are sent correctly

## 🧪 Testing

### Test 1: Global Keyword
1. Someone sends WhatsApp message with global keyword
2. Check logs:
   ```
   📧 Email sent to 1/1 recipients
   ```
3. Only supervisor@company.com receives email

### Test 2: Personal Keyword
1. Admin adds: `/addmykeyword urgent`
2. Someone sends WhatsApp message with "urgent"
3. Check logs:
   ```
   📧 Personal keyword alert sent to admin@company.com
   ```
4. Only admin@company.com receives email

### Test 3: Multiple Users
1. Dev1 adds: `/addmykeyword budget`
2. Dev2 adds: `/addmykeyword deadline`
3. WhatsApp messages received
4. Check logs:
   ```
   📧 Personal keyword alert sent to dev1@gmail.com
   📧 Personal keyword alert sent to dev2@gmail.com
   ```
5. Each user receives only their email

## ✅ Quick Checklist

- [ ] Create `config/user-emails.json`
- [ ] Add user IDs and emails
- [ ] Update `.env` EMAIL_TO (optional)
- [ ] Add file to `.gitignore` (already done)
- [ ] Restart bot
- [ ] Test with one user
- [ ] Verify emails go to correct addresses
- [ ] Test with multiple users
- [ ] Monitor logs for success

## 🎉 Benefits

✅ **Privacy**: Personal keywords stay personal  
✅ **Security**: Each user gets own email  
✅ **Scalability**: Add unlimited users  
✅ **Flexibility**: Mix global and personal emails  
✅ **Backward Compatible**: Still works without mapping file  

Enjoy personalized email notifications! 📧✨

