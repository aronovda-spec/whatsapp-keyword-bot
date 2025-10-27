# WhatsApp Disconnection Troubleshooting Guide

## Common Disconnect Reasons & Solutions

### 1. Connection Closed (402)
**What it means:** Network issue or server closed the connection

**Solutions:**
- Check internet connection
- Render free tier might have network issues
- Wait for auto-reconnect (5 seconds)
- Session will be restored from Supabase

### 2. Connection Lost (408)
**What it means:** Internet connection dropped

**Solutions:**
- Usually auto-recovers
- Bot will reconnect automatically
- Check Render service status
- No action needed - wait for reconnect

### 3. Connection Replaced (440)
**What it means:** Another device connected to this WhatsApp account

**Solutions:**
- Open WhatsApp on your phone
- Go to Settings → Linked Devices
- Check if another session is active
- Disconnect the unwanted session
- Bot will auto-reconnect after a few seconds

### 4. Logged Out (401)
**What it means:** Session expired or invalid

**Solutions:**
- This requires scanning QR code again
- Check if virtual number expired
- Verify WhatsApp account is active
- The bot will show new QR code
- Scan with WhatsApp → Linked Devices

### 5. Bad Session (500)
**What it means:** Session file is corrupted or invalid

**Solutions:**
- Delete old session in Supabase Storage
- Delete local `sessions` folder
- Restart bot to get fresh QR code
- Scan QR code again

### 6. Timed Out (504)
**What it means:** Connection took too long to establish

**Solutions:**
- Check internet connection
- Try again (bot will auto-retry)
- Increase timeout in code if needed

### 7. Restart Required
**What it means:** WhatsApp forced a restart

**Solutions:**
- Bot will auto-restore from Supabase
- Wait for reconnection
- No QR code needed if session is valid

---

## How to Debug Disconnections

### Check Bot Logs:
Look for this detailed output:
```
🔍 === DISCONNECT DETAILED DEBUG ===
Last Disconnect Object: {...}
Error Output: {...}
Error Message: "..."
🔍 Detected Disconnect Reason Code: 402
📱 Message: Connection closed (402) - Network issue...
🔄 Should Reconnect: true
```

### Common Patterns:

#### Pattern 1: Frequent 408 (Connection Lost)
- **Cause:** Unstable internet or Render sleeping
- **Fix:** Check Render logs, ensure uptime monitoring is active

#### Pattern 2: 440 (Connection Replaced)
- **Cause:** Multiple devices/sessions connected
- **Fix:** Go to WhatsApp → Linked Devices, remove duplicates

#### Pattern 3: 401 (Logged Out) after bot restart
- **Cause:** Session wasn't backed up to Supabase
- **Fix:** Make sure Supabase storage bucket exists and is configured

#### Pattern 4: Frequent 402 (Connection Closed)
- **Cause:** Rate limiting or too aggressive connection attempts
- **Fix:** Increase reconnect delay in anti-ban config

---

## Auto-Reconnect Behavior

The bot will automatically reconnect for these reasons:
- ✅ Connection closed (402)
- ✅ Connection lost (408)
- ✅ Timed out (504)
- ✅ Restart required
- ✅ Network issues

The bot will NOT auto-reconnect for:
- ❌ Logged out (401) - needs QR code
- ❌ Bad session (500) - session corrupted

---

## Session Persistence

**How it works:**
1. Session files saved to local `./sessions` folder
2. Session backed up to Supabase Storage on connection
3. On restart: Bot tries to restore from Supabase
4. If found: No QR code needed ✅
5. If not found: Shows QR code ⚠️

**To ensure session persists:**
- ✅ Supabase URL configured
- ✅ SUPABASE_SERVICE_KEY set in .env
- ✅ `whatsapp-sessions` bucket created in Supabase dashboard

---

## Quick Fixes

### If bot keeps disconnecting:
1. Check the disconnect reason code in logs
2. Match it to the solutions above
3. Apply the recommended fix
4. Restart bot if needed

### If you see QR code after restart:
1. Check if session exists in Supabase Storage
2. Verify `whatsapp-sessions` bucket is accessible
3. Check SUPABASE_SERVICE_KEY is set correctly
4. If missing, re-scan QR code (should work better now)

### If "Connection Replaced" keeps happening:
1. Go to WhatsApp on your phone
2. Settings → Linked Devices
3. Remove all bot sessions
4. Wait for bot to reconnect with fresh session

---

## Monitoring Setup

**To prevent disconnections on Render:**

1. **Set up UptimeRobot** (free):
   - URL: `https://your-app.onrender.com/health`
   - Interval: 5 minutes
   - This keeps your Render service awake

2. **Check Service Health:**
   ```bash
   curl https://your-app.onrender.com/health
   ```

3. **Monitor Session Backups:**
   - Check Supabase Storage → `whatsapp-sessions` bucket
   - Verify session files are being uploaded

---

## Need More Help?

Check these logs for diagnosis:
- Render logs: Shows disconnect reason and error details
- Supabase Storage: Verify session backup files exist
- Bot console: Shows detailed debug information

The new logging will show EXACTLY why the bot is disconnecting!

