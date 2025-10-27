# Database Schema - Current vs Improved

## Current Problem

Your database schema is **fragmented across multiple tables**:

1. `authorized_users` - Just user_id and is_admin
2. `user_preferences` - Just user_id and timezone
3. `user-emails.json` (file) - Email addresses

**This is confusing and inefficient!** 

---

## Proposed Unified Schema

### Better: Single `users` Table

```sql
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    email TEXT,
    timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**This one table includes:**
- ✅ User ID
- ✅ Username
- ✅ Role (admin/user)
- ✅ Email address
- ✅ Timezone
- ✅ Metadata

---

## Complete Improved Schema

### 1. Users Table (Unified)
```sql
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    email TEXT,
    notification_channels JSONB DEFAULT '["telegram"]', -- ['telegram', 'email']
    timezone TEXT DEFAULT 'UTC',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Global Keywords (Existing)
```sql
CREATE TABLE global_keywords (
    keyword TEXT PRIMARY KEY,
    enabled BOOLEAN DEFAULT TRUE,
    match_type TEXT DEFAULT 'exact',
    fuzzy_threshold INTEGER DEFAULT 2,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    added_by TEXT
);
```

### 3. Personal Keywords (Existing)
```sql
CREATE TABLE personal_keywords (
    user_id TEXT PRIMARY KEY,
    keywords JSONB DEFAULT '[]',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. Reminders (Existing)
```sql
CREATE TABLE active_reminders (
    user_id TEXT PRIMARY KEY,
    keyword TEXT NOT NULL,
    message TEXT,
    sender TEXT,
    group_name TEXT,
    first_detected_at TIMESTAMPTZ,
    next_reminder_at TIMESTAMPTZ,
    reminder_count INTEGER DEFAULT 0,
    acknowledged BOOLEAN DEFAULT FALSE
);
```

---

## Should I Migrate?

**Options:**

### Option A: Migrate to Unified Schema (Recommended)
1. Create new `users` table with all fields
2. Migrate data from 3 sources to 1 table
3. Update code to use unified table
4. **Pros:** Clean, efficient, all user data in one place
5. **Time:** ~30 minutes

### Option B: Keep Current (Quick & Dirty)
- Keep 3 separate tables
- Just document it better
- **Pros:** No changes needed
- **Cons:** Still fragmented

---

## Recommendation

**Go with Option A** - Unified users table.

Benefits:
- ✅ All user info in one place
- ✅ Single source of truth
- ✅ Easier to query: `SELECT * FROM users`
- ✅ Email addresses in database (not JSON file)
- ✅ Better for future features

Should I migrate to the unified schema?

