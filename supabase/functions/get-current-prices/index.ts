import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tickers } = await req.json();
    const apiKey = Deno.env.get('POLYGON_API_KEY');

    if (!apiKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    const prices: Record<string, number> = {};
    const lows: Record<string, number> = {};
    
    // Fetch snapshot data (current price and intraday low) for all tickers
    for (const ticker of tickers) {
      try {
        // 1) Try Polygon Last Trade (most up-to-date)
        const lastTradeRes = await fetch(
          `https://api.polygon.io/v2/last/trade/${ticker}?apiKey=${apiKey}`
        );

        let havePrice = false;
        if (lastTradeRes.ok) {
          const lastTrade = await lastTradeRes.json();
          const p = lastTrade?.results?.p;
          if (typeof p === 'number' && !Number.isNaN(p)) {
            prices[ticker] = p;
            havePrice = true;
          }
        }

        // 2) Fetch snapshot for intraday low (and price if still missing)
        const snapshotRes = await fetch(
          `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${apiKey}`
        );

        if (snapshotRes.ok) {
          const snap = await snapshotRes.json();
          const lastPrice = snap?.ticker?.lastTrade?.p ?? snap?.ticker?.prevDay?.c ?? undefined;
          const dayLow = snap?.ticker?.day?.l ?? snap?.ticker?.prevDay?.l ?? undefined;

          if (!havePrice && typeof lastPrice === 'number' && !Number.isNaN(lastPrice)) {
            prices[ticker] = lastPrice;
            havePrice = true;
          }
          if (typeof dayLow === 'number' && !Number.isNaN(dayLow)) {
            lows[ticker] = dayLow;
          }
        }

        // 3) Final fallback: previous aggregate endpoint
        if (!havePrice || typeof lows[ticker] !== 'number') {
          const response = await fetch(
            `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?apiKey=${apiKey}`
          );
          if (response.ok) {
            const data = await response.json();
            if (data?.results && data.results.length > 0) {
              const r = data.results[0];
              if (!havePrice && typeof r.c === 'number') prices[ticker] = r.c; // close
              if (typeof lows[ticker] !== 'number' && typeof r.l === 'number') lows[ticker] = r.l;   // low
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching price for ${ticker}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ prices, lows }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in get-current-prices:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
