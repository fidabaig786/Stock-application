-- Drop existing cron job
SELECT cron.unschedule('daily-stock-analysis');

-- Create notification tracking table to prevent duplicate emails
CREATE TABLE IF NOT EXISTS public.notification_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ticker TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  criteria_met BOOLEAN NOT NULL DEFAULT false,
  last_email_sent_at TIMESTAMP WITH TIME ZONE,
  last_checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, ticker, asset_type)
);

-- Enable RLS
ALTER TABLE public.notification_status ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own notification status"
  ON public.notification_status
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage notification status"
  ON public.notification_status
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add index for faster lookups
CREATE INDEX idx_notification_status_user_ticker 
  ON public.notification_status(user_id, ticker, asset_type);

-- Schedule the analysis to run every 20 minutes
SELECT cron.schedule(
  'frequent-stock-analysis',
  '*/20 * * * *', -- Every 20 minutes
  $$
  SELECT
    net.http_post(
        url:='https://ewvdjypgzfpoldttblhs.supabase.co/functions/v1/scheduled-analysis',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dmRqeXBnemZwb2xkdHRibGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0ODU3MzYsImV4cCI6MjA3MDA2MTczNn0.y8SJZzRVAzuBm9WP6tES9Lvp97f7ewumpjISdI1TTV8"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);