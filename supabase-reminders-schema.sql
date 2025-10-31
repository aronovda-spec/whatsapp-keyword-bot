-- WhatsApp Keyword Bot - Reminders Table Schema
-- Run this in your Supabase SQL Editor
-- This table supports reminder persistence across bot restarts

CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    keyword TEXT NOT NULL,
    message TEXT,
    sender TEXT,
    "group" TEXT,
    message_id TEXT,
    phone_number TEXT,
    attachment JSONB,
    is_global BOOLEAN DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'acknowledged', 'cancelled', 'completed'
    reminder_count INTEGER DEFAULT 0,
    first_detected_at TIMESTAMPTZ DEFAULT NOW(),
    next_reminder_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
CREATE INDEX IF NOT EXISTS idx_reminders_is_global ON reminders(is_global);
CREATE INDEX IF NOT EXISTS idx_reminders_user_status ON reminders(user_id, status);

-- Comments
COMMENT ON TABLE reminders IS 'Persistent reminders for global and personal keywords';
COMMENT ON COLUMN reminders.id IS 'UUID primary key for reminder';
COMMENT ON COLUMN reminders.user_id IS 'Telegram user ID';
COMMENT ON COLUMN reminders.is_global IS 'True for global keyword reminders, false for personal';
COMMENT ON COLUMN reminders.status IS 'Reminder status: active, acknowledged, cancelled, completed';

