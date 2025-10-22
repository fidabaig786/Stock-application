-- Create portfolio_positions table
CREATE TABLE public.portfolio_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ticker TEXT NOT NULL,
  shares NUMERIC NOT NULL,
  buy_price NUMERIC NOT NULL,
  buy_date DATE NOT NULL,
  index_ticker TEXT NOT NULL DEFAULT 'SPY',
  index_buy_price NUMERIC NOT NULL,
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.portfolio_positions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own positions"
ON public.portfolio_positions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own positions"
ON public.portfolio_positions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own positions"
ON public.portfolio_positions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own positions"
ON public.portfolio_positions
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_portfolio_positions_updated_at
BEFORE UPDATE ON public.portfolio_positions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();