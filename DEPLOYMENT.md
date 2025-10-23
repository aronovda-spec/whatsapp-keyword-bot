# WhatsApp Keyword Bot - Deployment Guide

## Quick Start (Local Development)

1. **Clone and setup:**
   ```bash
   git clone <your-repo>
   cd whatsapp-keyword-bot
   chmod +x setup.sh
   ./setup.sh
   ```

2. **Configure Telegram Bot:**
   - Message @BotFather on Telegram
   - Create new bot with `/newbot`
   - Get your bot token
   - Message @userinfobot to get your chat ID
   - Add both to `.env` file

3. **Customize keywords:**
   - Edit `config/keywords.json`
   - Add your target keywords

4. **Run the bot:**
   ```bash
   npm start
   ```

5. **Scan QR code** with WhatsApp to connect

## Cloud Deployment (Render)

### Step 1: Prepare Repository
```bash
git add .
git commit -m "Initial WhatsApp keyword bot setup"
git push origin main
```

### Step 2: Deploy to Render
1. Go to [render.com](https://render.com)
2. Sign up/login with GitHub
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Use these settings:
   - **Name:** whatsapp-keyword-bot
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free

### Step 3: Configure Environment Variables
In Render dashboard, add these environment variables:
```
NODE_ENV=production
PORT=10000
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
LOG_LEVEL=info
WHATSAPP_SESSION_PATH=./sessions
LOG_FILE=./logs/bot.log
```

### Step 4: Deploy
- Click "Create Web Service"
- Wait for deployment to complete
- Your bot will be available at `https://your-app-name.onrender.com`

### Step 5: Connect WhatsApp
1. Visit your app URL
2. Check logs in Render dashboard
3. Look for QR code in logs
4. Scan with WhatsApp

## Monitoring & Maintenance

### Health Monitoring
- **Health Check:** `https://your-app.onrender.com/health`
- **Stats:** `https://your-app.onrender.com/stats`
- **Test Notification:** `POST https://your-app.onrender.com/test-notification`

### Uptime Monitoring
1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Create new monitor
3. Set URL to your app's `/health` endpoint
4. Set monitoring interval to 5 minutes

### Log Monitoring
- Check Render logs regularly
- Monitor for connection issues
- Watch for keyword detection patterns

## Troubleshooting

### Common Issues

**Bot not connecting to WhatsApp:**
- Check if QR code is being generated
- Ensure session files are persisted
- Verify no firewall blocking WhatsApp Web

**Telegram notifications not working:**
- Verify bot token and chat ID
- Test with `/test-notification` endpoint
- Check if bot is blocked by user

**Keywords not detected:**
- Check `config/keywords.json` syntax
- Verify case sensitivity settings
- Test with `/reload-keywords` endpoint

**Bot disconnects frequently:**
- Check Render logs for errors
- Verify stable internet connection
- Consider upgrading to paid Render plan

### Debug Commands
```bash
# Check bot status
curl https://your-app.onrender.com/health

# Get current stats
curl https://your-app.onrender.com/stats

# Test notifications
curl -X POST https://your-app.onrender.com/test-notification

# Reload keywords
curl -X POST https://your-app.onrender.com/reload-keywords
```

## Security Notes

- Keep your `.env` file secure and never commit it
- Use strong, unique bot tokens
- Regularly rotate credentials
- Monitor for unauthorized access
- Consider IP whitelisting for admin endpoints

## Scaling Considerations

For production use:
- Upgrade to Render paid plan for better reliability
- Add database for persistent logging
- Implement rate limiting
- Add authentication for admin endpoints
- Set up proper monitoring and alerting
