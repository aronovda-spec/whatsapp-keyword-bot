# Global Keywords in Database - Implementation Plan

## Current Status

**Global keywords** are stored in `config/keywords.json` file and **NOT in Supabase database**.

**What's working:**
- ✅ Session backup to Supabase Storage
- ✅ User authorization in Supabase
- ✅ Personal keywords in Supabase
- ✅ Active reminders in Supabase

**What's NOT in database:**
- ❌ Global keywords (still in local JSON file)

---

## The Problem

You're absolutely right! Global keywords should be in the database because:

1. **No remote management** - Can't add/remove keywords without code changes
2. **Requires redeployment** - Every keyword change needs GitHub push + Render redeploy
3. **No admin commands** - `/addkeyword` and `/removekeyword` won't work with database
4. **Not backed up** - Keywords are lost if the JSON file is deleted

---

## Solution Options

### Option A: Full Implementation (Recommended)
Add global keywords table to Supabase and implement full CRUD operations.

**Database Table:**
```sql
CREATE TABLE IF NOT EXISTS global_keywords (
    keyword TEXT PRIMARY KEY,
    enabled BOOLEAN DEFAULT TRUE,
    match_type TEXT DEFAULT 'exact',
    fuzzy_threshold INTEGER DEFAULT 2,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    added_by TEXT
);
```

**Changes needed:**
1. Update `SupabaseManager` to handle global keywords ✅ (already added)
2. Update `KeywordDetector` to load from Supabase (instead of JSON)
3. Add Telegram commands `/addkeyword` and `/removekeyword` to modify database
4. Migration script to copy existing keywords from JSON to Supabase

**Pros:**
- ✅ Full remote management via Telegram
- ✅ No redeployment needed
- ✅ Keywords backed up in cloud
- ✅ Admin can manage from anywhere

**Cons:**
- ⏱️ ~30 minutes to implement
- 🧪 Needs testing

---

### Option B: Keep JSON + Sync to Supabase (Hybrid)
Load from JSON but sync to Supabase for backup.

**Pros:**
- ✅ Fast to implement (~5 minutes)
- ✅ Keywords backed up
- ✅ Local file as fallback

**Cons:**
- ❌ Still requires redeployment to change keywords
- ❌ `/addkeyword` doesn't work
- ❌ Not truly dynamic

---

### Option C: Keep Current (Status Quo)
Leave global keywords in JSON file as is.

**Pros:**
- ✅ Already working
- ✅ No changes needed

**Cons:**
- ❌ All the problems you identified
- ❌ Not scalable

---

## Recommendation

**Choose Option A** - Full implementation with Supabase.

This makes the bot truly production-ready:
- Admins can add keywords via Telegram
- No more code changes for keyword updates
- Keywords are stored and backed up properly

---

## Next Steps

If you want Option A implemented:
1. ✅ Database schema is ready
2. ✅ Supabase methods are added
3. ⏳ Need to update `KeywordDetector.loadConfig()` to check Supabase first
4. ⏳ Need to implement `/addkeyword` and `/removekeyword` commands
5. ⏳ Create migration script to copy existing keywords

**Estimated time:** 30 minutes

Should I implement Option A now?

