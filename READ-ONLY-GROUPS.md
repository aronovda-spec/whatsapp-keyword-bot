# 🔍 How to Get WhatsApp Group IDs (Read-Only Groups)

## 📱 **Perfect for School Groups & Read-Only Chats!**

### **Method 1: Bot Logs (Easiest)**
**✅ Works even if you can't send messages!**

1. **Add bot to the WhatsApp group**
2. **Anyone in the group sends ANY message** (you don't need to send anything!)
3. **Bot automatically logs the group ID**
4. **Check bot terminal** for output like:
   ```
   📱 Group Message Detected:
      Group ID: 120363123456789012@g.us
      Sender: +972501234567@s.whatsapp.net
      Message: Hello everyone...
      Time: 10/23/2025, 2:30:15 PM
   ```

### **Method 2: WhatsApp Web URL**
**✅ Works for any group you can access!**

1. **Open WhatsApp Web** in your browser
2. **Navigate to the group** you want to monitor
3. **Look at the URL** in the address bar
4. **Group ID is in the URL:**
   ```
   https://web.whatsapp.com/send?phone=120363123456789012@g.us
   ```
5. **Copy the part:** `120363123456789012@g.us`

### **Method 3: Group Info (Mobile)**
**✅ Works on mobile WhatsApp!**

1. **Open the group** in WhatsApp mobile
2. **Tap group name** at the top
3. **Scroll down** to find group information
4. **Look for group link** or invite link
5. **Group ID might be visible** in the link

### **Method 4: Group Settings**
**✅ Alternative mobile method!**

1. **Open group** in WhatsApp
2. **Tap three dots** (⋮) in top right
3. **Select "Group Info"**
4. **Look for group details**
5. **Group ID might be shown** in settings

## 🎯 **For School Groups Specifically:**

### **Scenario: School Announcement Group**
- **You can't send messages** ✅
- **Bot can still monitor** ✅
- **Anyone else sends message** → Bot logs group ID ✅
- **Perfect for read-only monitoring** ✅

### **Scenario: Parent-Teacher Group**
- **Limited messaging** ✅
- **Bot monitors announcements** ✅
- **Keywords detected** → Telegram notification ✅
- **No need to send messages** ✅

### **Scenario: Class Group**
- **Students can't always message** ✅
- **Bot monitors teacher announcements** ✅
- **Important keywords** → Instant alerts ✅
- **Works with any group activity** ✅

## 📋 **Step-by-Step for Read-Only Groups:**

### **Step 1: Add Bot to Group**
1. **Get bot phone number** (real or virtual)
2. **Add bot to the school group**
3. **Make sure bot is active** in group

### **Step 2: Wait for Group Activity**
1. **Anyone sends message** in group
2. **Bot automatically detects** group
3. **Group ID logged** in terminal
4. **No action needed** from you!

### **Step 3: Copy Group ID**
1. **Check bot terminal** for group ID
2. **Copy the ID** (ending with `@g.us`)
3. **Update config** file
4. **Restart bot**

## 🔧 **Bot Configuration:**

### **Update `config/monitored-groups.json`:**
```json
{
  "monitoredGroups": [
    {
      "groupId": "120363123456789012@g.us",
      "name": "School Announcements",
      "enabled": true,
      "description": "Important school updates and events"
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

## 🎉 **Benefits for School Groups:**

### **Perfect for:**
- **School announcement groups**
- **Parent-teacher groups**
- **Class groups with limited messaging**
- **Administrative groups**
- **Event notification groups**

### **Keywords to Monitor:**
- **English:** urgent, important, meeting, event, deadline, help
- **Hebrew:** דחוף, חשוב, מפגש, אירוע, מועד אחרון, עזרה
- **Russian:** срочно, важно, встреча, событие, крайний срок, помощь

## 🚀 **Ready to Test:**

1. **Add bot to school group**
2. **Wait for any message** in group
3. **Check bot logs** for group ID
4. **Configure monitoring**
5. **Test keyword detection**

**Perfect solution for read-only groups!** 🎯
