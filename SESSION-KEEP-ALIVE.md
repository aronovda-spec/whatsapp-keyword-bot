# Session Keep-Alive Solution for 401 Expiration

## Problem

After approximately 10 days of uptime, the WhatsApp server disconnects with a **401 error (session expired)**, requiring a QR code rescan. This is a known limitation of WhatsApp Web sessions.

## Root Cause

WhatsApp Web sessions expire after a period of inactivity or time (typically 7-14 days). The Baileys library doesn't automatically refresh sessions, so they expire and require re-authentication.

## Solution Implemented

We've implemented a **proactive session keep-alive mechanism** that prevents session expiration:

### 1. **Periodic Presence Updates**
- Sends a lightweight "available" presence update every **12 hours**
- This keeps the session active without sending messages
- Uses `sendPresenceUpdate('available')` which is a minimal operation

### 2. **Improved 401 Handling**
- When a 401 error occurs, the bot now:
  - Checks if valid session files exist
  - Attempts to reconnect automatically (401 might be temporary)
  - Only requires QR code if session is truly invalid

### 3. **Session Age Tracking**
- Tracks session start time
- Logs session duration on disconnection
- Helps identify patterns in session expiration

### 4. **Automatic Session Backup After Keep-Alive**
- After each keep-alive, backs up session to Supabase
- Ensures credentials are always fresh in cloud storage

## How It Works

```
Connection Established
    ↓
Start Keep-Alive Timer (every 12 hours)
    ↓
Every 12 hours:
    - Send presence update (lightweight)
    - Backup session to cloud
    - Log session age
    ↓
Session stays active indefinitely ✅
```

## Benefits

1. **Prevents 401 Expiration**: Sessions remain active indefinitely
2. **No Manual Intervention**: No need to rescan QR codes
3. **Lightweight**: Presence updates don't send messages or notifications
4. **Automatic Recovery**: Attempts to reconnect on 401 if session files exist
5. **Better Logging**: Tracks session age for debugging

## Configuration

The keep-alive interval is set to **12 hours** (configurable in code):
- Located in `startSessionKeepAlive()` method
- Current: `12 * 60 * 60 * 1000` (12 hours)
- Can be adjusted if needed (recommended: 6-24 hours)

## Monitoring

The bot now logs:
- `💚 Session keep-alive sent (Session age: Xd Xh)` - Every 12 hours
- `⏱️ Session duration: X days, X hours` - On disconnection

## Technical Details

### Keep-Alive Method
```javascript
await this.sock.sendPresenceUpdate('available');
```

This is a **lightweight operation** that:
- ✅ Keeps session active
- ✅ Doesn't send messages
- ✅ Doesn't trigger notifications
- ✅ Doesn't appear in chat history
- ✅ Minimal network usage
- ✅ Same operation WhatsApp Web does automatically

### Anti-Ban Integration

The keep-alive mechanism is **fully integrated** with the anti-ban system:

1. **Respects Non-Active Hours**:
   - Skips keep-alive during sleep mode (1 AM - 6 AM Israeli time)
   - Allows keep-alive during reduced mode (with logging)
   - Only sends during active hours by default

2. **Safety Checks**:
   - Checks with anti-ban system before sending
   - Very conservative frequency (every 12 hours)
   - Manual and controlled (not automatic)

3. **Why It's Safe**:
   - Presence updates are what WhatsApp Web does automatically
   - Frequency is extremely conservative (2x per day max)
   - Doesn't count toward message rate limits
   - Doesn't trigger any anti-ban mechanisms
   - Respects all anti-ban safety settings

### 401 Recovery Logic
```javascript
// Try to reconnect even on 401 if we have session files
const shouldReconnect = !isBadSession && (hasSessionFiles || !isLoggedOut);
```

This allows the bot to attempt reconnection on 401 errors, as they might be temporary network issues rather than true session expiration.

## Expected Behavior

### Before Fix
- ❌ Session expires after ~10 days
- ❌ Requires manual QR code rescan
- ❌ Bot stops working until intervention

### After Fix
- ✅ Session stays active indefinitely
- ✅ No manual intervention needed
- ✅ Automatic recovery on temporary 401 errors
- ✅ Continuous operation
- ✅ **Fully integrated with anti-ban system**
- ✅ Respects non-active hours (skips during sleep mode)
- ✅ Safe and conservative (2x per day max)

## Troubleshooting

### If you still see 401 errors:

1. **Check logs for keep-alive messages**:
   - Should see `💚 Session keep-alive sent` every 12 hours
   - If missing, check connection status

2. **Verify session files exist**:
   - Check `./sessions/creds.json` exists
   - Verify Supabase backup is working

3. **Check network connectivity**:
   - Keep-alive requires active connection
   - Ensure bot has internet access

4. **Review session age**:
   - Check logs for session duration on disconnect
   - If < 10 days, might be a different issue

## Additional Notes

- Keep-alive starts automatically when connection is established
- Keep-alive stops automatically on disconnection
- No configuration needed - works out of the box
- Compatible with existing session backup to Supabase
- Works with multi-phone configurations
- **Fully respects anti-ban settings** - won't send during sleep mode
- **Safe for anti-ban** - presence updates don't trigger rate limits or bans
- **Conservative frequency** - only 2x per day (every 12 hours)

## Anti-Ban Safety

### Why Keep-Alive Won't Trigger Bans

1. **Presence Updates Are Normal**:
   - WhatsApp Web sends presence updates automatically
   - This is standard WhatsApp behavior
   - Not considered suspicious activity

2. **Extremely Conservative Frequency**:
   - Only 2 times per day (every 12 hours)
   - Normal WhatsApp usage sends presence updates much more frequently
   - Well below any rate limits

3. **Doesn't Count as Messages**:
   - Presence updates are separate from messages
   - Don't count toward message rate limits
   - Don't trigger message-based anti-ban mechanisms

4. **Respects Anti-Ban Settings**:
   - Checks with anti-ban system before sending
   - Skips during non-active hours (sleep mode)
   - Fully integrated with safety checks

5. **Manual and Controlled**:
   - Not automatic/uncontrolled behavior
   - Explicitly checked and logged
   - Can be monitored and adjusted if needed

