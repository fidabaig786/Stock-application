-- Drop the existing unique constraint that only considers user_id and ticker
ALTER TABLE public.watchlist_items DROP CONSTRAINT IF EXISTS watchlist_items_user_id_ticker_key;

-- Create a new unique constraint that includes asset_type
ALTER TABLE public.watchlist_items ADD CONSTRAINT watchlist_items_user_id_ticker_asset_type_key 
UNIQUE (user_id, ticker, asset_type);