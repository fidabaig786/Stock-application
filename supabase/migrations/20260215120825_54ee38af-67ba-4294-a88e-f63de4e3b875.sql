
-- watchlist_items table
CREATE TABLE public.watchlist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ticker TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'Stock',
  current_price NUMERIC,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  company_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own watchlist" ON public.watchlist_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own watchlist" ON public.watchlist_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own watchlist" ON public.watchlist_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own watchlist" ON public.watchlist_items FOR DELETE USING (auth.uid() = user_id);

-- user_settings table
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT,
  email_notifications_enabled BOOLEAN DEFAULT false,
  notification_criteria JSONB,
  cash_balance NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- portfolio_positions table
CREATE TABLE public.portfolio_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ticker TEXT NOT NULL,
  shares NUMERIC NOT NULL,
  buy_price NUMERIC NOT NULL,
  buy_date TEXT NOT NULL,
  index_ticker TEXT NOT NULL DEFAULT 'SPY',
  index_buy_price NUMERIC NOT NULL DEFAULT 0,
  stop_loss_price NUMERIC,
  holding INTEGER NOT NULL DEFAULT 1,
  comments TEXT,
  current_price NUMERIC,
  index_current_price NUMERIC,
  position_type TEXT NOT NULL DEFAULT 'Stocks',
  maturity_date TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own positions" ON public.portfolio_positions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own positions" ON public.portfolio_positions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own positions" ON public.portfolio_positions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own positions" ON public.portfolio_positions FOR DELETE USING (auth.uid() = user_id);
