# 🔍 QR Code Data Storage Location in Supabase

## 📦 Storage Type: **Supabase Storage** (File Storage)

QR authentication data is stored in Supabase **Storage**, NOT in database tables.

## 📁 Storage Structure

```
Supabase Storage
└── whatsapp-sessions (bucket)
    └── sessions/
        └── phone1/ (or your phone identifier)
            ├── creds.json ⭐ REQUIRED - Contains QR authentication
            ├── device-list-XXXXXXXXXXX.json
            ├── lid-mapping-YYYYYYYYYYY.json
            └── [other session files...]
```

## 🔑 Key File: `creds.json`

This file contains the QR code authentication data. Without it, WhatsApp requires a new QR scan.

## 📊 Database Tables Used

Supabase Database tables are used for:
- `global_keywords` - Keywords
- `active_reminders` - Reminder notifications
- `authorized_users` - User authorization

**NOT for QR/session data!**

## 🛠️ How to Check/Verify

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **"Storage"** in the left sidebar
4. Select bucket: `whatsapp-sessions`
5. Navigate to folder: `sessions/phone1/`
6. Check if `creds.json` exists

## ✅ If `creds.json` exists:
- QR code should NOT be required on restart
- Session should restore automatically

## ❌ If `creds.json` is missing:
- QR code will be required on every restart
- Sessions are NOT being backed up properly

## 🔍 Debugging Commands

Check Render logs for:
```
📋 Session files found for phone1: X
```

If X = 0, no session files in Supabase Storage!

## 📝 Environment Variables Needed

Make sure these are set in Render:
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key (IMPORTANT!)
```

