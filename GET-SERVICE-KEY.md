# Get Supabase Service Key (Easiest Solution)

## Why?
Storage backup needs elevated permissions. The service key bypasses Row Level Security (RLS).

## How to Get It (30 seconds)

1. **Go to Supabase Dashboard**
2. **Click "Project Settings"** (gear icon)
3. **Click "API"** in the left menu
4. **Scroll down** to find "Project API keys"
5. **Copy the `service_role` key** (it's the secret one)
6. **Add to your `.env` file:**
   ```env
   SUPABASE_SERVICE_KEY=your-service-role-key-here
   ```

⚠️ **Important:** This is a SECRET key - never commit it to Git!

---

## After Adding

Restart your bot:
```bash
npm start
```

You should see:
```
💾 Session backed up to cloud storage ✅
```

---

## Why This Works

- **Anon key:** Limited permissions, subject to RLS
- **Service key:** Full access, bypasses RLS (perfect for automated backups)

This is the recommended approach for bots and automated systems!

