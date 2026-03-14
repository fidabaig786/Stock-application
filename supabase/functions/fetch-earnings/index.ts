import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CACHE_EXPIRY_DAYS = 45;
const FORWARD_DAYS = 90;
const RATE_LIMIT_MS = 500; // 500ms between Finnhub calls

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FINNHUB_API_KEY = Deno.env.get('FINNHUB_API_KEY');
    if (!FINNHUB_API_KEY) {
      throw new Error('FINNHUB_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tickers } = await req.json() as { tickers: string[] };
    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      throw new Error('tickers array is required');
    }

    const upperTickers = tickers.map(t => t.toUpperCase());
    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - CACHE_EXPIRY_DAYS);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    // Fetch all cached entries for these tickers
    const { data: cachedRows, error: cacheError } = await supabase
      .from('earnings_cache')
      .select('*')
      .in('ticker', upperTickers);

    if (cacheError) {
      console.error('Cache read error:', cacheError);
    }

    const cacheMap = new Map<string, any>();
    for (const row of (cachedRows || [])) {
      cacheMap.set(row.ticker, row);
    }

    // Determine which tickers need fresh API calls
    const stale: string[] = [];
    const results: Record<string, { date: string | null; days_to: number | null; eps_estimate: number | null; revenue_estimate: number | null }> = {};

    for (const ticker of upperTickers) {
      const cached = cacheMap.get(ticker);
      if (cached && cached.fetched_at >= cutoffStr) {
        // Cache is valid
        if (cached.earnings_date) {
          const earningsDate = new Date(cached.earnings_date);
          const daysTo = Math.ceil((earningsDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          results[ticker] = {
            date: cached.earnings_date,
            days_to: daysTo,
            eps_estimate: cached.eps_estimate,
            revenue_estimate: cached.revenue_estimate,
          };
        } else {
          results[ticker] = { date: null, days_to: null, eps_estimate: null, revenue_estimate: null };
        }
      } else {
        stale.push(ticker);
      }
    }

    // Fetch from Finnhub for stale tickers
    const todayStr = today.toISOString().split('T')[0];
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + FORWARD_DAYS);
    const endStr = endDate.toISOString().split('T')[0];

    for (const ticker of stale) {
      try {
        const url = `https://finnhub.io/api/v1/calendar/earnings?symbol=${ticker}&from=${todayStr}&to=${endStr}&token=${FINNHUB_API_KEY}`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
        
        if (!resp.ok) {
          console.error(`Finnhub error for ${ticker}: ${resp.status}`);
          results[ticker] = { date: null, days_to: null, eps_estimate: null, revenue_estimate: null };
          await sleep(RATE_LIMIT_MS);
          continue;
        }

        const data = await resp.json();
        const events = (data.earningsCalendar || [])
          .filter((e: any) => e.date >= todayStr)
          .sort((a: any, b: any) => a.date.localeCompare(b.date));

        const next = events[0] || null;
        const earningsDate = next?.date || null;
        const epsEst = next?.epsEstimate ?? null;
        const revEst = next?.revenueEstimate ?? null;

        // Upsert cache
        const { error: upsertError } = await supabase
          .from('earnings_cache')
          .upsert({
            ticker,
            fetched_at: todayStr,
            earnings_date: earningsDate,
            eps_estimate: epsEst,
            revenue_estimate: revEst,
            raw_data: data,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'ticker' });

        if (upsertError) {
          console.error(`Cache upsert error for ${ticker}:`, upsertError);
        }

        if (earningsDate) {
          const daysTo = Math.ceil((new Date(earningsDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          results[ticker] = { date: earningsDate, days_to: daysTo, eps_estimate: epsEst, revenue_estimate: revEst };
        } else {
          results[ticker] = { date: null, days_to: null, eps_estimate: null, revenue_estimate: null };
        }

        await sleep(RATE_LIMIT_MS);
      } catch (err) {
        console.error(`Error fetching earnings for ${ticker}:`, err);
        results[ticker] = { date: null, days_to: null, eps_estimate: null, revenue_estimate: null };
      }
    }

    // Also update the watchlist_items table with the fetched earnings dates
    for (const ticker of upperTickers) {
      const result = results[ticker];
      if (result?.date) {
        await supabase
          .from('watchlist_items')
          .update({ next_earning_date: result.date })
          .eq('ticker', ticker);
      }
    }

    return new Response(JSON.stringify({ results, fetched_from_api: stale.length, from_cache: upperTickers.length - stale.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('fetch-earnings error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
