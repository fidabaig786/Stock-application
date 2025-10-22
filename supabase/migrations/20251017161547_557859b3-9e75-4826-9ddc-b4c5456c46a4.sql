-- Add cash_balance column to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS cash_balance numeric DEFAULT 0;

-- Add a comment to the column
COMMENT ON COLUMN public.user_settings.cash_balance IS 'Available cash balance in the trading account';