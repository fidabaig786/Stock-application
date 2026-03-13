CREATE TABLE public.sector_score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL,
  score numeric NOT NULL,
  recorded_at date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticker, recorded_at)
);

ALTER TABLE public.sector_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sector scores"
ON public.sector_score_history
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Service role can insert scores"
ON public.sector_score_history
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update scores"
ON public.sector_score_history
FOR UPDATE
TO service_role
USING (true);