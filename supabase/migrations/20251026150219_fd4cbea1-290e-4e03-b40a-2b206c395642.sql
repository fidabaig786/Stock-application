-- Add email notification preferences to user_settings
ALTER TABLE user_settings 
ADD COLUMN email TEXT,
ADD COLUMN email_notifications_enabled BOOLEAN DEFAULT false,
ADD COLUMN notification_criteria JSONB DEFAULT '{}'::jsonb;