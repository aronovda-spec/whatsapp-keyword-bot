# 🚀 Render Deployment Checklist

## ✅ Pre-Deployment Checklist

- [x] Bot stopped locally
- [x] All code committed to GitHub
- [x] All changes pushed to main branch
- [x] No hardcoded sensitive data
- [x] render.yaml configured
- [x] package.json has start script

---

## 📝 Step-by-Step Deployment

### Step 1: Push to GitHub
```bash
git status  # Verify clean working tree
git push origin main  # Push latest changes
```

### Step 2: Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up/Login with **GitHub**
3. Authorize Render to access your repositories

### Step 3: Deploy Web Service
1. Click **"New +"** → **"Web Service"**
2. Select your repository: `aronovda-spec/whatsapp-keyword-bot`
3. Click **"Connect"**

### Step 4: Configure Service
**Settings:**
- **Name:** `whatsapp-keyword-bot` (or any name you like)
- **Environment:** `Node`
- **Region:** aws (or closest to you)
- **Branch:** `main`
- **Plan:** `Free`

**Auto-Deploy:** ✅ Enabled

### Step 5: Environment Variables (CRITICAL!)

Add these in Render dashboard under **"Environment"** section:

#### Required
```
NODE_ENV=production
PORT=10000
TELEGRAM_BOT_TOKEN=your_actual_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here
```

#### Email Configuration
```
EMAIL_ENABLED=true
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your_email@gmail.com
EMAIL_SMTP_PASS=your_app_password
EMAIL_TO=your@email.com
```

#### Supabase (Optional but Recommended)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
```

#### Security
```
ADMIN_API_KEY=generate_random_key_here
TELEGRAM_FALLBACK_ADMIN=999888777 (optional)
```

#### Logging
```
LOG_LEVEL=info
LOG_FILE=./logs/bot.log
```

#### WhatsApp
```
WHATSAPP_SESSION_PATH=./sessions
```

### Step 6: Deploy!
Click **"Create Web Service"**

---

## 🔍 After Deployment

### 1. Check Logs
- Go to **"Logs"** tab in Render dashboard
- Look for WhatsApp QR code
- QR code appears like:
```
QR code:
https://s.whatsapp.net/...

Scan the QR code with WhatsApp!
```

### 2. Scan QR Code
1. Open WhatsApp on your phone
2. Go to Settings → Linked Devices
3. Tap "Link a Device"
4. Scan the QR code from Render logs

### 3. Verify Connection
- Bot should say: `✅ WhatsApp connected successfully!`
- Bot should discover your groups
- Session backs up to Supabase

### 4. Test Commands
Send to your Telegram bot:
```
/start
/help
/status
```

---

## 🔧 Important Notes

### ⚠️ Free Tier Limitations
- **Sleeps after 15 minutes** of inactivity
- **No persistent disk** (use Supabase!)
- **500 hours/month** free
- Session backup to Supabase is **critical**

### 🔐 Security Checklist
- [x] All credentials in environment variables
- [x] No hardcoded IDs
- [x] `.env` file NOT committed
- [x] `ADMIN_API_KEY` set
- [x] Supabase configured

### 📊 Monitoring
Set up [UptimeRobot](https://uptimerobot.com):
- URL: `https://your-app.onrender.com/health`
- Interval: Every 5 minutes
- Keeps bot awake!

---

## 🆘 Troubleshooting

### Bot not connecting?
1. Check logs for QR code
2. Re-scan QR code
3. Check if session expired

### Session keeps resetting?
- **Solution:** Configure Supabase session backup
- Add `SUPABASE_SERVICE_KEY` to environment variables

### Bot sleeping?
- Use UptimeRobot to ping `/health` endpoint
- Or upgrade to paid plan

### Commands not working?
- Check `TELEGRAM_BOT_TOKEN` is correct
- Verify bot is started (not pending)
- Check logs for errors

---

## ✅ Success Indicators

When deployed successfully, you'll see:
```
✅ WhatsApp connected successfully!
📊 Server running on port 10000
🔗 Health check: https://your-app.onrender.com/health
📈 Stats: https://your-app.onrender.com/stats?token=YOUR_KEY
```

---

## 🎉 You're Ready!

Your bot is now deployed to Render cloud!

