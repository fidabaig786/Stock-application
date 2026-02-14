
-- Add type and maturity_date fields to portfolio_positions
ALTER TABLE public.portfolio_positions
  ADD COLUMN IF NOT EXISTS position_type text NOT NULL DEFAULT 'Stocks',
  ADD COLUMN IF NOT EXISTS maturity_date date;

-- Add constraint for position_type values
ALTER TABLE public.portfolio_positions
  ADD CONSTRAINT portfolio_positions_type_check CHECK (position_type IN ('Stocks', 'Options'));
