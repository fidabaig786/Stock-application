-- Add holding column to portfolio_positions table
ALTER TABLE public.portfolio_positions
ADD COLUMN holding INTEGER NOT NULL DEFAULT 1;

-- Add check constraint to ensure holding is either 0 or 1
ALTER TABLE public.portfolio_positions
ADD CONSTRAINT holding_check CHECK (holding IN (0, 1));