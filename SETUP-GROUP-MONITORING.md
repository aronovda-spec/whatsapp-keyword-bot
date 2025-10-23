# 🎯 Group Monitoring Setup Guide

## 📋 Step-by-Step Instructions

### **Phase 1: Initial Setup (Current Status)**
✅ **Bot is running** with group monitoring capability
✅ **Configuration file** created (`config/monitored-groups.json`)
✅ **All groups disabled** by default (safe mode)
✅ **Bot monitors all groups** until you configure specific ones

### **Phase 2: Find Group IDs**

#### **Step 1: Add Bot to WhatsApp Groups**
1. **Use your real phone number** or **virtual number** for the bot
2. **Add the bot phone** to WhatsApp groups you want to monitor
3. **Make sure bot is active** in those groups

#### **Step 2: Send Test Messages**
1. **Send any message** in each group (like "test" or "hello")
2. **Check bot terminal** for group ID logs
3. **Look for lines like:**
   ```
   📱 Message from: John in group: 120363123456789012@g.us
   ```

#### **Step 3: Copy Group IDs**
1. **Copy the group ID** (the part ending with `@g.us`)
2. **Example:** `120363123456789012@g.us`

### **Phase 3: Configure Groups**

#### **Step 1: Update Configuration**
Edit `config/monitored-groups.json`:

```json
{
  "monitoredGroups": [
    {
      "groupId": "120363123456789012@g.us",
      "name": "Work Team",
      "enabled": true,
      "description": "Work discussions"
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

#### **Step 2: Restart Bot**
```bash
npm start
```

### **Phase 4: Test Group Monitoring**

#### **Step 1: Test Keywords**
1. **Send messages with keywords** in monitored groups
2. **Examples:** "urgent meeting", "help needed", "cake party"
3. **Check Telegram** for notifications

#### **Step 2: Test Non-Monitored Groups**
1. **Send messages** in groups NOT in your config
2. **Should NOT trigger** notifications
3. **Bot should ignore** those messages

## 🔧 Current Configuration Status

### **Safe Mode (Current)**
- **All groups monitored** (until you configure specific ones)
- **No groups disabled** in config yet
- **Bot logs all group IDs** for easy copying
- **Ready for group ID collection**

### **Target Mode (After Configuration)**
- **Only specified groups** monitored
- **Personal chats ignored**
- **Better privacy and performance**
- **Focused keyword detection**

## 📱 Telegram Commands Available

- **`/groups`** - Show group monitoring info
- **`/status`** - Check bot status  
- **`/keywords`** - Show monitored keywords
- **`/help`** - Show all commands

## 🎯 What to Do Right Now

### **Immediate Actions:**
1. **Add bot phone to 1-2 WhatsApp groups**
2. **Send test messages** in those groups
3. **Check bot logs** for group IDs
4. **Copy the group IDs**
5. **Update config file**
6. **Restart bot**

### **Testing Plan:**
1. **Start with 1 group** for testing
2. **Use simple keywords** like "urgent", "help", "meeting"
3. **Verify notifications** work in that group
4. **Add more groups** gradually
5. **Test that other groups** are ignored

## ⚠️ Important Notes

### **Privacy:**
- **Personal chats** will be ignored automatically
- **Only group messages** are monitored
- **Group members** should know bot is monitoring

### **Performance:**
- **Fewer groups** = better performance
- **Start small** and expand gradually
- **Monitor bot resources** and adjust

### **Compliance:**
- **Respect group rules**
- **Transparent monitoring**
- **Follow WhatsApp ToS**

## 🚀 Next Steps

1. **Get your bot phone number** (real or virtual)
2. **Add bot to 1 WhatsApp group**
3. **Send test message** in group
4. **Check bot logs** for group ID
5. **Update config** with real group ID
6. **Test keyword detection**

**Ready to start? Let me know when you have a group ID!** 🎉
