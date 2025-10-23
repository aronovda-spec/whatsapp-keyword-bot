# 🌍 Timezone & 24/7 Mode Quick Reference

## **🚀 Quick Commands**

### **📱 Telegram Commands (Easiest)**
```
/sleep          - Check current sleep status
/timezone Asia/Jerusalem    - Set Israeli timezone
/timezone America/New_York  - Set New York timezone  
/timezone Europe/London     - Set London timezone
/timezone Asia/Tokyo        - Set Tokyo timezone
/24h           - Show 24/7 mode instructions
```

### **🔧 Environment Variables**
```bash
# Change timezone
export WHATSAPP_TIMEZONE="America/New_York"

# Enable 24/7 mode (disable sleep)
export WHATSAPP_NON_ACTIVE_HOURS_ENABLED=false

# Back to default (Israeli sleep mode)
export WHATSAPP_TIMEZONE="Asia/Jerusalem"
export WHATSAPP_NON_ACTIVE_HOURS_ENABLED=true
```

### **📝 Config File Changes**
Edit `config/non-active-hours.json`:

```json
{
  "nonActiveHours": {
    "enabled": false,  // false = 24/7 mode
    "timezone": "America/New_York"  // Change timezone
  }
}
```

## **🌍 Supported Timezones**

| Timezone | Code | Description |
|----------|------|-------------|
| 🇮🇱 Israel | `Asia/Jerusalem` | Default Israeli timezone |
| 🇺🇸 New York | `America/New_York` | US Eastern Time |
| 🇬🇧 London | `Europe/London` | GMT/BST |
| 🇯🇵 Tokyo | `Asia/Tokyo` | Japan Standard Time |
| 🇦🇺 Sydney | `Australia/Sydney` | Australian Eastern Time |
| 🌍 Universal | `UTC` | Universal Coordinated Time |

## **⚙️ Common Scenarios**

### **🏠 Default Setup (Israeli Sleep)**
```bash
export WHATSAPP_TIMEZONE="Asia/Jerusalem"
export WHATSAPP_NON_ACTIVE_HOURS_ENABLED=true
```
**Result**: Sleep 1 AM - 6 AM Israeli time

### **✈️ Travel to New York**
```bash
export WHATSAPP_TIMEZONE="America/New_York"
export WHATSAPP_NON_ACTIVE_HOURS_ENABLED=true
```
**Result**: Sleep 1 AM - 6 AM New York time

### **🌍 24/7 Mode (No Sleep)**
```bash
export WHATSAPP_NON_ACTIVE_HOURS_ENABLED=false
```
**Result**: No sleep, 24/7 operation

### **🔄 Back to Default**
```bash
export WHATSAPP_TIMEZONE="Asia/Jerusalem"
export WHATSAPP_NON_ACTIVE_HOURS_ENABLED=true
```
**Result**: Back to Israeli sleep mode

## **📊 Sleep Schedule**

### **Default (Israeli Time)**
- **Sleep**: 01:00 - 06:00 (5 hours)
- **Active**: 06:00 - 01:00 (19 hours)
- **Behavior**: Complete sleep (no activity)

### **24/7 Mode**
- **Sleep**: None
- **Active**: 00:00 - 23:59 (24 hours)
- **Behavior**: Full activity

## **🔄 How to Apply Changes**

### **Method 1: Restart Bot**
1. Stop the bot (`Ctrl+C`)
2. Set environment variables
3. Start the bot (`npm start`)

### **Method 2: Edit Config File**
1. Edit `config/non-active-hours.json`
2. Restart the bot
3. Changes take effect immediately

### **Method 3: Telegram Commands**
1. Send `/sleep` to check status
2. Send `/timezone <timezone>` to change
3. Send `/24h` for 24/7 instructions
4. Restart bot for changes to take effect

## **✅ Verification**

### **Check Current Status**
```bash
# Check environment variables
echo $WHATSAPP_TIMEZONE
echo $WHATSAPP_NON_ACTIVE_HOURS_ENABLED

# Or use Telegram command
/sleep
```

### **Expected Output**
```
😴 Sleep Status

🌍 Israeli Time: 10/23/2025, 4:30:15 PM
⏰ Current Time: 16:30
📊 Status: ☀️ Active hours: Normal operation

💡 Sleep Schedule:
• Sleep: 01:00 - 06:00 Israeli time
• Active: 06:00 - 01:00 Israeli time
```

## **🚨 Troubleshooting**

### **Problem**: Changes not taking effect
**Solution**: Restart the bot after making changes

### **Problem**: Wrong timezone
**Solution**: Check timezone code spelling (case-sensitive)

### **Problem**: Still sleeping in 24/7 mode
**Solution**: Verify `enabled: false` in config file

### **Problem**: Telegram commands not working
**Solution**: Ensure you're authorized user (`/start` first)

## **💡 Pro Tips**

1. **Test timezone changes** with `/sleep` command
2. **Use environment variables** for quick changes
3. **Edit config file** for permanent changes
4. **Always restart** after timezone changes
5. **Check logs** for timezone confirmation
