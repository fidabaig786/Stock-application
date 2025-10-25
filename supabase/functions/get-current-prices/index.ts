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
        // Use previous day's close as "current price" to match requested logic
        const prevRes = await fetch(
          `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${apiKey}`
        );
        if (prevRes.ok) {
          const data = await prevRes.json();
          if (data?.results && data.results.length > 0) {
            const r = data.results[0];
            if (typeof r.c === 'number' && !Number.isNaN(r.c)) {
              prices[ticker] = r.c; // previous close
            }
          }
        }

        // Fetch snapshot for intraday low (for stop-loss logic)
        const snapshotRes = await fetch(
          `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${apiKey}`
        );

        if (snapshotRes.ok) {
          const snap = await snapshotRes.json();
          const dayLow = snap?.ticker?.day?.l ?? snap?.ticker?.prevDay?.l ?? undefined;
          if (typeof dayLow === 'number' && !Number.isNaN(dayLow)) {
            lows[ticker] = dayLow;
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
