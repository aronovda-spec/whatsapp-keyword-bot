# Migrate Global Keywords to Supabase

## Steps to Complete

### Step 1: Create Table in Supabase
1. Go to Supabase Dashboard → SQL Editor
2. Run this SQL:

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

### Step 2: Migrate Existing Keywords
Run this migration script to copy keywords from JSON to database:

```bash
node migrate-keywords.js
```

Or manually insert them in SQL Editor:

```sql
INSERT INTO global_keywords (keyword) VALUES
('urgent'), ('emergency'), ('important'), ('deadline'), ('meeting'),
('event'), ('help'), ('asap'), ('message'), ('critical'), ...
```

### Step 3: Test
Restart bot and check logs:
```
📊 Loaded X keywords from Supabase database
```

---

## Status

✅ Database schema created
✅ Supabase methods implemented
✅ KeywordDetector loads from Supabase first
⏳ Admin commands (/addkeyword, /removekeyword) - Coming next
⏳ Migration script needed

---

## Next

See GLOBAL-KEYWORDS-DATABASE.md for full details.

