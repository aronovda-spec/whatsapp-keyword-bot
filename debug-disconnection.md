# Debug WhatsApp Disconnection

## What Happened:
- Bot ran for 3 minutes
- Then QR code appeared again
- Old "YOUR_PRIMARY_PHONE_NUMBER" message appeared

## Possible Causes:

### 1. WhatsApp Disconnected
Common reasons:
- Connection timeout
- Network issue
- Another device connected
- Session invalid

### 2. Render Restarted with Old Code
Check in Render:
- Go to **Events** tab
- Look for latest deployment time
- Check if it's running latest commit: `48a7cea Fix session restore to use correct phone identifier`

### 3. Multiple Instances
- Check if there are multiple services in Render
- Check if old deployment is still running

## What to Check in Render Logs:

Look for these messages:
```
❌ Connection closed
🔄 Reconnecting to WhatsApp...
⚠️ Disconnected from WhatsApp
💾 Session backed up to cloud
```

## Solutions:

### If Render is using old code:
1. Manually trigger a new deployment
2. Or wait for auto-deploy (should happen in ~1 minute)

### If connection dropped:
- This is normal on Render free tier
- Bot will auto-reconnect
- Session should restore

### To avoid old messages:
- Make sure Render is running latest code
- Check deployment time matches your latest push

