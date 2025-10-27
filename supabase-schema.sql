-- WhatsApp Keyword Bot - Supabase Database Schema
-- Run this in your Supabase SQL Editor

-- Authorized Users Table
CREATE TABLE IF NOT EXISTS authorized_users (
    user_id TEXT PRIMARY KEY,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Global Keywords Table
CREATE TABLE IF NOT EXISTS global_keywords (
    keyword TEXT PRIMARY KEY,
    enabled BOOLEAN DEFAULT TRUE,
    match_type TEXT DEFAULT 'exact',
    fuzzy_threshold INTEGER DEFAULT 2,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    added_by TEXT
);

-- Personal Keywords Table
CREATE TABLE IF NOT EXISTS personal_keywords (
    user_id TEXT PRIMARY KEY,
    keywords JSONB DEFAULT '[]',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group Subscriptions Table
CREATE TABLE IF NOT EXISTS group_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    group_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, group_name)
);

-- User Preferences Table
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY,
    timezone TEXT DEFAULT 'UTC',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active Reminders Table
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_group_subscriptions_user_id ON group_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_group_subscriptions_group_name ON group_subscriptions(group_name);
CREATE INDEX IF NOT EXISTS idx_active_reminders_user_id ON active_reminders(user_id);

-- Enable Row Level Security (RLS) if needed
-- Uncomment these if you want RLS:
-- ALTER TABLE authorized_users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE personal_keywords ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE group_subscriptions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE active_reminders ENABLE ROW LEVEL SECURITY;

-- Note: For testing, it's easier to leave RLS disabled
-- You can enable it later for production security

COMMENT ON TABLE authorized_users IS 'Telegram users authorized to use the bot';
COMMENT ON TABLE personal_keywords IS 'Personal keywords for each user';
COMMENT ON TABLE group_subscriptions IS 'User subscriptions to WhatsApp groups';
COMMENT ON TABLE user_preferences IS 'User preferences and settings';
COMMENT ON TABLE active_reminders IS 'Active reminder notifications';

