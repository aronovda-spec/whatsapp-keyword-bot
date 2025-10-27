# Fix Supabase Storage Permissions

## The Issue
Your WhatsApp session backup failed with: "new row violates row-level security policy"

## Quick Fix (Choose Option 1 or 2)

---

## Option 1: Disable RLS on Storage (Easiest - Recommended)

1. Go to your Supabase Dashboard
2. Click on **"Storage"** in the left sidebar
3. Click on your bucket **`whatsapp-sessions`**
4. Look for **"RLS Policies"** section
5. Toggle **"RLS Enabled"** to **OFF** (disable it)
6. Your bot will work immediately! ✅

**Note:** This is safe because:
- The bucket is already private (not public)
- Only your app with the API key can access it
- RLS is extra security that's not needed for your use case

---

## Option 2: Add Storage Policy (Advanced)

If you want to keep RLS enabled, add this policy:

1. Go to **Storage** → **`whatsapp-sessions`** bucket
2. Click **"New Policy"**
3. Select **"For full customization"**
4. Paste this policy:

```sql
-- Allow authenticated inserts
CREATE POLICY "Allow authenticated inserts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-sessions');

-- Allow authenticated selects
CREATE POLICY "Allow authenticated selects"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'whatsapp-sessions');

-- Allow authenticated updates
CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'whatsapp-sessions');

-- Allow authenticated deletes
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'whatsapp-sessions');
```

---

## After Fixing

1. **Restart your bot:**
   ```bash
   npm start
   ```

2. **Look for:**
   ```
   💾 Session backed up to cloud storage
   ```
   (WITHOUT the error message)

3. **Check Supabase Dashboard:**
   - Go to **Storage** → **`whatsapp-sessions`** bucket
   - You should see your session files there!

---

## Done! 🎉

Your WhatsApp session is now backed up to the cloud, and you'll never need to scan the QR code again!

