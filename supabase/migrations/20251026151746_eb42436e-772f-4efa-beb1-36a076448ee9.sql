-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule the analysis to run every day at 9 AM EST (2 PM UTC)
SELECT cron.schedule(
  'daily-stock-analysis',
  '0 14 * * *', -- 2 PM UTC = 9 AM EST
  $$
  SELECT
    net.http_post(
        url:='https://ewvdjypgzfpoldttblhs.supabase.co/functions/v1/scheduled-analysis',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dmRqeXBnemZwb2xkdHRibGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0ODU3MzYsImV4cCI6MjA3MDA2MTczNn0.y8SJZzRVAzuBm9WP6tES9Lvp97f7ewumpjISdI1TTV8"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);