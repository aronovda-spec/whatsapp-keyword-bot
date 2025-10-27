# Security & Deployment Guide

## 🔐 How Data is Secured

### 1. Environment Variables (.env file)

**What's in .env:**
```env
# Telegram Credentials
TELEGRAM_BOT_TOKEN=your_token_here
TELEGRAM_CHAT_ID=your_chat_id

# Email Configuration  
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_USER=your_email@gmail.com
EMAIL_SMTP_PASS=your_app_password
EMAIL_TO=admin@company.com

# Supabase Credentials
SUPABASE_URL=https://...
SUPABASE_KEY=anon_key
SUPABASE_SERVICE_KEY=service_key

# Admin API Key
ADMIN_API_KEY=secure_random_string
```

**Security:**
- ✅ `.env` file is NOT committed to Git (in .gitignore)
- ✅ Never exposed to GitHub
- ✅ Only you have access locally

---

## 🚀 Render Deployment

### How It Works:

**Option 1: Environment Variables (Recommended)**

1. In Render Dashboard:
   - Go to your service
   - Click "Environment"
   - Add each variable manually

2. **Render stores these securely:**
   - ✅ Encrypted at rest
   - ✅ Only accessible to your Render account
   - ✅ Not visible in logs or code

**Option 2: Secret Files (Alternative)**

1. Upload `.env` as a secret file
2. Render injects it at runtime
3. Same security as environment variables

---

## 📊 Where User Data is Stored

### Supabase Database (Cloud)

**Tables:**
```sql
users               -- All user info (ID, email, role, timezone)
global_keywords     -- Keywords
personal_keywords   -- User personal keywords
active_reminders    -- Active reminders
group_subscriptions -- User → Group mappings
```

**Security:**
- ✅ Encrypted by Supabase
- ✅ Protected by API keys
- ✅ Only accessible with correct credentials
- ✅ Backed up automatically

**Who Can Access:**
- ✅ Your Render service (with SUPABASE_KEY)
- ✅ You (via Supabase Dashboard)
- ❌ Not exposed to GitHub
- ❌ Not public

---

## 🔒 What's NOT Exposed to GitHub

### ✅ Protected (Safe):

1. **`.env` file** - In .gitignore, never committed
2. **Session files** - In sessions/ folder (gitignored)
3. **Config files with real data**:
   - `config/*.json` - All gitignored
   - Only `.example` files are in Git
4. **Supabase credentials** - In .env only
5. **Telegram tokens** - In .env only
6. **Email passwords** - In .env only

### 📝 Public (Safe to Expose):

1. **Code** - Public is OK
2. **README.md** - Documentation
3. **Example files** - `*.example` files with placeholders
4. **Database schema** - SQL files (no data)

---

## 🎯 Render Deployment Checklist

### Step 1: Add Environment Variables in Render

Go to Render Dashboard → Your Service → Environment, add:

```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
EMAIL_ENABLED=true
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=...
EMAIL_SMTP_PASS=...
EMAIL_TO=...
SUPABASE_URL=...
SUPABASE_KEY=...
SUPABASE_SERVICE_KEY=...
ADMIN_API_KEY=...
```

### Step 2: Verify Git Repo

Check that `.gitignore` includes:
```
.env
config/*.json
sessions/
logs/
node_modules/
```

### Step 3: Deploy

Push to GitHub and Render auto-deploys!

---

## 🛡️ Security Summary

| Data Type | Storage | Security | GitHub Exposure |
|-----------|---------|----------|-----------------|
| **Telegram Token** | .env (Render env vars) | ✅ Secure | ❌ No |
| **Email Credentials** | .env (Render env vars) | ✅ Secure | ❌ No |
| **Supabase Keys** | .env (Render env vars) | ✅ Secure | ❌ No |
| **User Emails** | Supabase `users` table | ✅ Encrypted | ❌ No |
| **User IDs** | Supabase `users` table | ✅ Encrypted | ❌ No |
| **Keywords** | Supabase database | ✅ Encrypted | ❌ No |
| **Code** | GitHub repo | ✅ Public | ✅ Yes (OK) |
| **Documentation** | GitHub repo | ✅ Public | ✅ Yes (OK) |

---

## ⚠️ Important Notes

### Never Commit These to Git:
- ❌ `.env` file
- ❌ Real `config/*.json` files (only `.example` versions)
- ❌ Sessions folder
- ❌ Logs folder
- ❌ Real user IDs or emails

### Always Use:
- ✅ `.env` file locally
- ✅ Environment variables in Render
- ✅ `.example` files in Git (with placeholders)
- ✅ Supabase for user data

---

## 🔍 How to Verify

### Check Your Git Repo:
```bash
git status
# Should NOT show: .env, config/*.json, sessions/, logs/
```

### Check .gitignore:
```bash
cat .gitignore
# Should include: .env, config/*.json, sessions/, logs/
```

### Check Supabase:
- Go to Supabase Dashboard
- Click "Authentication" → "Users"
- Only you should see your data (secure)

---

**Your data is secure!** 🔒

- All sensitive data in .env (not in Git)
- User data encrypted in Supabase
- Render environment variables are secure
- Nothing exposed to public

