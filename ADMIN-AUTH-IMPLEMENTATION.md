# Admin Endpoint Authentication - Implementation Guide

## ✅ What Was Implemented

Protected admin endpoints from unauthorized access using API key authentication.

### Protected Endpoints:
- ✅ `/stats` - Bot statistics (requires API key)
- ✅ `/test-notification` - Test notifications (requires API key)
- ✅ `/reload-keywords` - Reload keywords (requires API key)

### Public Endpoints (Still accessible without auth):
- `/health` - Health check (public for monitoring)
- `/` - Root endpoint (public information only)

## 🔧 How to Use

### Step 1: Set API Key

**Generate a secure random key:**
```bash
# Using OpenSSL
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Add to your `.env` file:**
```env
ADMIN_API_KEY=abc123def456...
```

### Step 2: Access Protected Endpoints

**Option 1: Query string**
```bash
curl https://your-bot.onrender.com/stats?token=abc123def456
```

**Option 2: Header**
```bash
curl -H "x-api-key: abc123def456" https://your-bot.onrender.com/stats
```

**Option 3: Authorization header**
```bash
curl -H "Authorization: abc123def456" https://your-bot.onrender.com/stats
```

### Step 3: Test Authentication

**Without API key (Blocked):**
```bash
curl https://your-bot.onrender.com/stats
```

Response:
```json
{
  "error": "Unauthorized",
  "message": "API key required. Set ADMIN_API_KEY in environment variables."
}
```

**With API key (Allowed):**
```bash
curl "https://your-bot.onrender.com/stats?token=abc123def456"
```

Response:
```json
{
  "stats": { ... },
  "keywords": [ ... ],
  "phones": { ... }
}
```

## 📊 Usage Examples

### Check Bot Statistics
```bash
curl "https://your-bot.onrender.com/stats?token=YOUR_API_KEY"
```

### Send Test Notification
```bash
curl -X POST "https://your-bot.onrender.com/test-notification?token=YOUR_API_KEY"
```

### Reload Keywords
```bash
curl -X POST "https://your-bot.onrender.com/reload-keywords?token=YOUR_API_KEY"
```

## 🔒 Security Features

### API Key Validation
- Checks token from query string, `x-api-key` header, or `authorization` header
- Exact match required (case-sensitive)
- Logs unauthorized access attempts

### Backward Compatibility
- If `ADMIN_API_KEY` is not set, endpoints work without authentication
- Warning logged to remind you to set the key

### Rate Limiting
- Already implemented (100 requests/minute)
- Applies to all endpoints including protected ones

## 🚨 Important Notes

### Never Commit API Key
- Keep `ADMIN_API_KEY` in your `.env` file
- Never commit `.env` to git (already in `.gitignore`)
- Use different keys for development and production

### Generate Strong Keys
- Use at least 32 random characters
- Mix letters, numbers, and symbols
- Don't use predictable patterns

### Rotate Keys Regularly
- Change your API key every 90 days
- Update all monitoring tools when rotating
- Keep old keys active for 24 hours during transition

## 🧪 Testing

### Test Without API Key (Should Fail)
```bash
curl https://your-bot.onrender.com/stats
# Response: 401 Unauthorized
```

### Test With API Key (Should Succeed)
```bash
curl "https://your-bot.onrender.com/stats?token=YOUR_API_KEY"
# Response: 200 OK with data
```

### Test Reload Keywords
```bash
curl -X POST "https://your-bot.onrender.com/reload-keywords?token=YOUR_API_KEY"
# Response: Success message
```

## 📝 Configuration

### Set in `.env` file:
```env
ADMIN_API_KEY=your_generated_secure_key_here
```

### Set in Render Dashboard:
1. Go to your Render service
2. Click "Environment"
3. Add variable: `ADMIN_API_KEY`
4. Paste your generated key
5. Save

### Set in Terminal:
```bash
export ADMIN_API_KEY=your_generated_secure_key_here
```

## 🎯 Benefits

✅ **Security**: Protected admin endpoints  
✅ **Control**: Only you can access bot stats  
✅ **Privacy**: Keyword counts not publicly visible  
✅ **Safety**: Test notifications require authentication  
✅ **Compliance**: Professional security practices  

## ⚠️ Troubleshooting

### "Unauthorized" error
- Check that `ADMIN_API_KEY` is set in `.env`
- Verify you're using the correct API key
- Check for typos in the key

### Endpoints work without auth
- Check if `ADMIN_API_KEY` is set
- Restart bot after setting the key
- Check logs for warning messages

### Can't generate API key
```bash
# Try this on your computer:
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Or online:
https://randomkeygen.com/
```

## ✅ Implementation Complete!

Your admin endpoints are now protected! 🔒

**Next Steps:**
1. Set `ADMIN_API_KEY` in your `.env` file
2. Deploy to Render
3. Test with your API key
4. Monitor access logs

**Status:** ✅ **PRODUCTION READY**

