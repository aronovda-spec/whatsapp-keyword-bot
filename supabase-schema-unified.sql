-- WhatsApp Keyword Bot - Unified Database Schema
-- Run this in your Supabase SQL Editor

-- ===================================================
-- 1. UNIFIED USERS TABLE (All user info in one place)
-- ===================================================
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    email TEXT,
    notification_channels JSONB DEFAULT '["telegram"]', -- ['telegram', 'email', 'both']
    timezone TEXT DEFAULT 'UTC',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_admin ON users(is_admin) WHERE is_admin = true;
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active) WHERE active = true;

-- ===================================================
-- 2. GLOBAL KEYWORDS TABLE
-- ===================================================
CREATE TABLE IF NOT EXISTS global_keywords (
    keyword TEXT PRIMARY KEY,
    enabled BOOLEAN DEFAULT TRUE,
    match_type TEXT DEFAULT 'exact',
    fuzzy_threshold INTEGER DEFAULT 2,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    added_by TEXT
);

-- ===================================================
-- 3. PERSONAL KEYWORDS TABLE
-- ===================================================
CREATE TABLE IF NOT EXISTS personal_keywords (
    user_id TEXT PRIMARY KEY,
    keywords JSONB DEFAULT '[]',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================
-- 4. GROUP SUBSCRIPTIONS TABLE
-- ===================================================
CREATE TABLE IF NOT EXISTS group_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    group_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, group_name)
);

CREATE INDEX IF NOT EXISTS idx_group_subscriptions_user_id ON group_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_group_subscriptions_group_name ON group_subscriptions(group_name);

-- ===================================================
-- 5. ACTIVE REMINDERS TABLE
-- ===================================================
CREATE TABLE IF NOT EXISTS active_reminders (
    user_id TEXT PRIMARY KEY,
    keyword TEXT NOT NULL,
    message TEXT,
    sender TEXT,
    group_name TEXT,
    first_detected_at TIMESTAMPTZ,
    next_reminder_at TIMESTAMPTZ,
    reminder_count INTEGER DEFAULT 0,
    acknowledged BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_active_reminders_user_id ON active_reminders(user_id);

-- ===================================================
-- COMMENTS (Documentation)
-- ===================================================
COMMENT ON TABLE users IS 'Unified users table with all user information';
COMMENT ON TABLE global_keywords IS 'Global keywords for all users';
COMMENT ON TABLE personal_keywords IS 'Personal keywords per user';
COMMENT ON TABLE group_subscriptions IS 'User subscriptions to WhatsApp groups';
COMMENT ON TABLE active_reminders IS 'Active reminder notifications';

-- ===================================================
-- MIGRATION NOTES
-- ===================================================
-- Old tables (authorized_users, user_preferences) can be dropped after migration:
-- DROP TABLE IF EXISTS authorized_users;
-- DROP TABLE IF EXISTS user_preferences;
-- 
-- But keep them as backup for now!

