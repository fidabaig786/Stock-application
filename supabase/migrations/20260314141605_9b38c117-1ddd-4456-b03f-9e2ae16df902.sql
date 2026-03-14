CREATE TABLE public.earnings_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL UNIQUE,
  fetched_at date NOT NULL DEFAULT CURRENT_DATE,
  earnings_date text,
  eps_estimate numeric,
  revenue_estimate numeric,
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.earnings_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read earnings cache"
  ON public.earnings_cache FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Service role can manage earnings cache"
  ON public.earnings_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);