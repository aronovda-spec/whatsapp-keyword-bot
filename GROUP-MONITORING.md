# Group-Specific Monitoring Setup

## 🎯 Overview
The WhatsApp Keyword Bot can monitor **specific groups only**, rather than all WhatsApp activity. This provides:
- **Targeted monitoring** of relevant groups
- **Better privacy** (ignores personal chats)
- **Improved performance** (less data processing)
- **Reduced detection risk** (focused activity)

## 📱 How to Set Up Group Monitoring

### Step 1: Add Bot to Groups
1. **Add your bot phone number** to the WhatsApp groups you want to monitor
2. **Make sure bot is active** in those groups
3. **Test by sending a message** in the group

### Step 2: Get Group IDs
1. **Send any message** in the group
2. **Check bot logs** for group ID (looks like `120363123456789012@g.us`)
3. **Copy the group ID** for configuration

### Step 3: Configure Monitored Groups
Edit `config/monitored-groups.json`:

```json
{
  "monitoredGroups": [
    {
      "groupId": "120363123456789012@g.us",
      "name": "Work Team",
      "enabled": true,
      "description": "Work-related discussions"
    },
    {
      "groupId": "120363987654321098@g.us", 
      "name": "Family Events",
      "enabled": true,
      "description": "Family gatherings"
    }
  ],
  "settings": {
    "ignorePrivateChats": true,
    "ignoreBroadcastLists": true,
    "onlyMonitoredGroups": true,
    "logIgnoredMessages": false
  }
}
```

### Step 4: Restart Bot
```bash
npm start
```

## 🔍 Finding Group IDs

### Method 1: Bot Logs
1. Send message in group
2. Check terminal output for:
```
📱 Message from: John in group: 120363123456789012@g.us
```

### Method 2: WhatsApp Web
1. Open group in WhatsApp Web
2. Look at URL: `web.whatsapp.com/send?phone=120363123456789012@g.us`

### Method 3: Bot Command
Send `/groups` to your Telegram bot for instructions.

## ⚙️ Configuration Options

### Group Settings
- **`enabled: true`** - Monitor this group
- **`enabled: false`** - Skip this group
- **`name`** - Human-readable group name
- **`description`** - What this group is for

### Global Settings
- **`ignorePrivateChats: true`** - Never monitor 1-on-1 chats
- **`ignoreBroadcastLists: true`** - Skip broadcast lists
- **`onlyMonitoredGroups: true`** - Only monitor configured groups
- **`logIgnoredMessages: false`** - Don't log skipped messages

## 🚀 Benefits of Group-Specific Monitoring

### Privacy
- **Personal chats remain private**
- **Only relevant groups monitored**
- **Transparent to group members**

### Performance
- **Faster keyword detection**
- **Lower resource usage**
- **More stable bot operation**

### Compliance
- **Respects group privacy**
- **Clear monitoring scope**
- **Reduced detection risk**

## 📋 Example Use Cases

### Work Monitoring
- **Team chat groups**
- **Project discussions**
- **Meeting notifications**

### Family Events
- **Family group chats**
- **Event planning groups**
- **Important announcements**

### Community
- **Neighborhood groups**
- **Local events**
- **Community announcements**

## 🔧 Troubleshooting

### Bot Not Detecting Groups
1. **Check group ID format** (must end with `@g.us`)
2. **Verify bot is in group**
3. **Restart bot after config changes**
4. **Check bot logs for errors**

### Missing Messages
1. **Confirm group is enabled** in config
2. **Check group ID is correct**
3. **Verify bot has read permissions**
4. **Test with simple keywords**

### Performance Issues
1. **Reduce number of monitored groups**
2. **Enable `logIgnoredMessages: false`**
3. **Check for duplicate group IDs**
4. **Monitor bot resource usage**

## 📱 Telegram Commands

- **`/groups`** - Show group monitoring info
- **`/status`** - Check bot status
- **`/help`** - Show all commands

## 🎯 Best Practices

1. **Start with 1-2 groups** for testing
2. **Use descriptive group names**
3. **Keep group list manageable** (< 10 groups)
4. **Regularly review monitored groups**
5. **Test keyword detection** in each group
6. **Monitor bot performance** and adjust as needed

---

**Group-specific monitoring makes your bot more focused, private, and efficient!** 🎉
