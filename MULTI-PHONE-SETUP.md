# Multi-Phone WhatsApp Bot Setup Guide

## 🎯 **Current Configuration**

Your bot is now configured to support multiple phones:

### **✅ Currently Enabled:**
- **Phone 1:** `+972523784909` (Primary monitoring phone)
- **Session:** `./sessions/phone1`

### **⏸️ Ready to Enable:**
- **Phone 2:** `+1234567890` (Replace with your second phone number)
- **Phone 3:** `+9876543210` (Replace with your third phone number)

## 📱 **How to Add More Phones**

### **Step 1: Edit Configuration**
Edit `config/multi-phone.json`:

```json
{
  "phones": [
    {
      "number": "+972523784909",
      "sessionPath": "./sessions/phone1",
      "enabled": true,
      "description": "Primary monitoring phone"
    },
    {
      "number": "+YOUR_SECOND_PHONE",
      "sessionPath": "./sessions/phone2", 
      "enabled": true,
      "description": "Secondary monitoring phone"
    },
    {
      "number": "+YOUR_THIRD_PHONE",
      "sessionPath": "./sessions/phone3",
      "enabled": true,
      "description": "Backup monitoring phone"
    }
  ]
}
```

### **Step 2: Start Bot**
```bash
npm start
```

### **Step 3: Scan QR Codes**
- **First QR code** → Scan with Phone 1
- **Second QR code** → Scan with Phone 2  
- **Third QR code** → Scan with Phone 3

## 🔍 **How It Works**

### **Multi-Phone Monitoring:**
1. **One bot instance** monitors all phones
2. **Each phone** has its own session folder
3. **All phones** send alerts to same Telegram
4. **Alerts include** which phone detected the keyword

### **Example Alert:**
```
🚨 Keyword Alert!

🔍 Keyword: urgent
👤 Sender: John Doe
👥 Group: Work Team
📱 Detected by: +972523784909
🕐 Time: 2025-10-23 11:15:30

💬 Message:
This is urgent! Please respond ASAP.
```

## 📊 **Monitoring Dashboard**

### **Health Check:** `http://localhost:3000/health`
```json
{
  "status": "healthy",
  "phones": {
    "+972523784909": true,
    "+1234567890": true,
    "+9876543210": false
  },
  "telegram": true,
  "stats": {...}
}
```

### **Statistics:** `http://localhost:3000/stats`
- Total messages processed from all phones
- Keywords detected across all phones
- Connection status of each phone

## 🎯 **Benefits**

- ✅ **Centralized monitoring** - One bot, multiple phones
- ✅ **Unified notifications** - All alerts in one Telegram
- ✅ **Scalable** - Add/remove phones easily
- ✅ **Redundant monitoring** - If one phone fails, others continue
- ✅ **Cost effective** - One server deployment

## 🔧 **Troubleshooting**

### **Phone Not Connecting:**
1. Check if phone number is correct in config
2. Verify session folder exists
3. Clear session folder and rescan QR code

### **No Alerts:**
1. Verify Telegram credentials
2. Check if keywords are configured
3. Test with `/test-notification` endpoint

### **Multiple QR Codes:**
- Each phone gets its own QR code
- Scan each QR code with the corresponding phone
- Wait for "Phone X connected successfully!" message

## 🚀 **Ready to Use**

Your multi-phone WhatsApp bot is ready! Just:
1. **Edit phone numbers** in `config/multi-phone.json`
2. **Start the bot** with `npm start`
3. **Scan QR codes** for each phone
4. **Start monitoring** multiple phones simultaneously!

**All phones will send keyword alerts to your Telegram! 🎉**
