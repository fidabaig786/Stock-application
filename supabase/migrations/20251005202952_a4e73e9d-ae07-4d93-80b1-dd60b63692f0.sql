-- Add stop_loss_price column to portfolio_positions table
ALTER TABLE public.portfolio_positions
ADD COLUMN stop_loss_price NUMERIC;