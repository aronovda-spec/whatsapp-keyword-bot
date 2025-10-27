# 🚀 Supabase Quick Start Guide

Follow these steps to set up Supabase in 5 minutes!

---

## Step 1: Create Supabase Account & Project

1. **Go to [supabase.com](https://supabase.com)**
2. **Click "Start your project"** (or Sign Up if needed)
3. **Sign in** with GitHub, Google, or email
4. **Click "New Project"**
5. **Fill in details:**
   - Organization: Choose or create one
   - Name: `whatsapp-keyword-bot`
   - Database Password: **Create a strong password** (save it!)
   - Region: Choose closest to you
   - Pricing Plan: **Free**
6. **Click "Create new project"**
7. **Wait 2-3 minutes** for setup to complete

---

## Step 2: Get Your API Credentials

1. **Wait for project to be ready** (green notification)
2. **Click on "Project Settings"** (gear icon in left sidebar)
3. **Click on "API"** in the settings menu
4. **Copy these values:**
   ```
   Project URL: https://xxxxxxxxxxxxxxx.supabase.co
   anon public key: eyJhbGc...
   ```

---

## Step 3: Create Database Tables

1. **Go to "SQL Editor"** (left sidebar)
2. **Click "New query"**
3. **Open** `supabase-schema.sql` file from your project
4. **Copy the entire contents**
5. **Paste into the SQL Editor**
6. **Click "Run"** (or press Ctrl+Enter)
7. **Wait for success message** ✅

You should see: `Success. No rows returned`

---

## Step 4: Create Storage Bucket

1. **Go to "Storage"** (left sidebar)
2. **Click "New bucket"**
3. **Name:** `whatsapp-sessions`
4. **Public bucket:** NO (unchecked) ✅ Important!
5. **Click "Create bucket"**

---

## Step 5: Update Your .env File

Add these lines to your `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://xxxxxxxxxxxxxxx.supabase.co
SUPABASE_KEY=eyJhbGc...
```

Replace with your actual values from Step 2.

---

## Step 6: Test It!

1. **Restart your bot:**
   ```bash
   npm start
   ```

2. **Look for this in the logs:**
   ```
   ✅ Supabase: Connected to cloud database
   ```

3. **If you see:** `📊 Supabase: Not configured (optional)`  
   → Check your .env file credentials

---

## ✅ Done!

Your bot now has:
- ✅ Cloud session backup (no more QR re-scan!)
- ✅ Database storage
- ✅ Multi-server support
- ✅ Automatic backups

---

## 🐛 Troubleshooting

### "Supabase initialization failed"
- Check `.env` file has correct values
- Make sure project is active in Supabase dashboard

### "relation does not exist"
- You forgot to run the SQL script
- Go back to Step 3 and run it

### "permission denied"
- The bucket might have wrong permissions
- Delete and recreate the bucket

### "invalid api key"
- Copy the **anon key**, not the service_role key
- Get it from Project Settings → API

---

## 💡 Pro Tips

1. **Keep your Supabase URL and key secure** - never commit to GitHub
2. **Test locally first** before deploying to Render
3. **Check your Supabase dashboard** - you can see all data there
4. **Free tier is generous** - 500MB database, 1GB storage

---

## 📚 Next Steps

After Supabase is working:
1. Deploy to Render
2. Add Supabase credentials to Render environment variables
3. Your bot will automatically use the cloud session backup

**No more QR re-scans!** 🎉

