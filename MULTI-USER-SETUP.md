# Multi-User Notification Setup

## 🎯 Single Virtual Number → Multiple Users

### **How It Works:**
- **1 Virtual Number** = 1 WhatsApp Bot Account
- **Multiple Users** = Multiple Telegram Chat IDs
- **Bot monitors groups** → Sends alerts to ALL users

## 📱 Configuration Options:

### **Option 1: Multiple Telegram Users (Recommended)**

#### **1. Get Telegram Chat IDs:**
```bash
# Each user needs to:
# 1. Start chat with your bot
# 2. Send /start command
# 3. Get their chat ID from bot logs
```

#### **2. Configure .env:**
```bash
# Primary user (you)
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN_HERE
TELEGRAM_CHAT_ID=YOUR_TELEGRAM_CHAT_ID_HERE

# Additional users (comma-separated)
TELEGRAM_ADDITIONAL_CHAT_IDS=USER2_CHAT_ID,USER3_CHAT_ID,USER4_CHAT_ID
```

#### **3. Example Setup:**
```bash
# User 1 (You): YOUR_CHAT_ID
# User 2 (Spouse): USER2_CHAT_ID  
# User 3 (Child): USER3_CHAT_ID
# User 4 (Parent): USER4_CHAT_ID

TELEGRAM_ADDITIONAL_CHAT_IDS=USER2_CHAT_ID,USER3_CHAT_ID,USER4_CHAT_ID
```

### **Option 2: Telegram Group Notifications**

#### **1. Create Telegram Group:**
```bash
# Create group: "Family Alerts"
# Add all family members
# Add your bot to the group
# Get group chat ID
```

#### **2. Configure .env:**
```bash
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN_HERE
TELEGRAM_CHAT_ID=YOUR_GROUP_CHAT_ID_HERE  # Group chat ID (negative number)
```

## 🚀 Real-World Example:

### **Scenario: Family Monitoring**
- **Virtual Number**: +1-555-123-4567 (Bot WhatsApp)
- **Groups Monitored**: "Family Chat", "School Parents", "Neighborhood"
- **Users Notified**: You, Spouse, Child, Parents

### **Configuration:**
```bash
# .env file
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN_HERE
TELEGRAM_CHAT_ID=YOUR_TELEGRAM_CHAT_ID_HERE
TELEGRAM_ADDITIONAL_CHAT_IDS=USER2_CHAT_ID,USER3_CHAT_ID,USER4_CHAT_ID
```

### **Process:**
1. **Bot joins groups** using +1-555-123-4567
2. **Bot detects keywords** in group messages
3. **Bot sends alerts** to all 4 users
4. **Everyone gets notified** instantly

## 📊 Benefits:

### **✅ Cost Effective:**
- **1 virtual number** = $0-10/month
- **Multiple users** = No additional cost
- **Shared monitoring** = Efficient resource use

### **✅ Easy Management:**
- **Single bot instance** = Easy maintenance
- **Centralized configuration** = Simple setup
- **Unified logging** = Easy troubleshooting

### **✅ Flexible:**
- **Add/remove users** = Just update .env
- **Different groups** = Same bot monitors all
- **Custom keywords** = Shared across all users

## 🔧 Setup Steps:

### **1. Get Virtual Number:**
```bash
# Google Voice: +1-555-123-4567
# This becomes bot's WhatsApp account
```

### **2. Configure Bot:**
```json
// config/multi-phone.json
{
  "phones": [
    {
      "number": "+15551234567",
      "sessionPath": "./sessions/bot1",
      "enabled": true,
      "description": "Family monitoring bot"
    }
  ]
}
```

### **3. Configure Users:**
```bash
# .env
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN_HERE
TELEGRAM_CHAT_ID=YOUR_TELEGRAM_CHAT_ID_HERE
TELEGRAM_ADDITIONAL_CHAT_IDS=USER2_CHAT_ID,USER3_CHAT_ID,USER4_CHAT_ID
```

### **4. Start Bot:**
```bash
npm start
# Bot shows QR code
# Scan with virtual number's WhatsApp
# Add bot to groups you want monitored
```

## 💡 Pro Tips:

### **✅ Best Practices:**
- **Use Telegram groups** for family notifications
- **Individual chats** for personal alerts
- **Test with small group** first
- **Monitor bot logs** for delivery status

### **✅ Troubleshooting:**
- **Check chat IDs** are correct
- **Verify bot permissions** in groups
- **Test notifications** before going live
- **Monitor delivery rates** in logs

## 🎉 Result:

**✅ Single virtual number monitors multiple groups**
**✅ All family members get instant alerts**
**✅ Cost-effective shared monitoring**
**✅ Easy to manage and maintain**

**Perfect for family, team, or community monitoring! 🚀**
