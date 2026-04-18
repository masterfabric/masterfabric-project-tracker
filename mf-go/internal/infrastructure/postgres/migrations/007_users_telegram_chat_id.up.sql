-- 007: Telegram OTP delivery — store linked Telegram chat_id per user (set via profile).
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT NOT NULL DEFAULT '';
