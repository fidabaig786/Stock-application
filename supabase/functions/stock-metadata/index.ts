import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Sector → ETF Mapping ───

const SECTOR_TO_ETF: Record<string, string> = {
  'Technology': 'XLK',
  'Financial Services': 'XLF',
  'Financials': 'XLF',
  'Healthcare': 'XLV',
  'Energy': 'XLE',
  'Consumer Cyclical': 'XLY',
  'Consumer Discretionary': 'XLY',
  'Industrials': 'XLI',
  'Consumer Defensive': 'XLP',
  'Consumer Staples': 'XLP',
  'Utilities': 'XLU',
  'Basic Materials': 'XLB',
  'Materials': 'XLB',
  'Communication Services': 'XLC',
  'Real Estate': 'XLRE',
};

const ALL_SECTOR_ETFS = ['XLK', 'XLF', 'XLV', 'XLE', 'XLY', 'XLI', 'XLP', 'XLU', 'XLB', 'XLC', 'XLRE'];

// ─── Yahoo Finance Fetch ───

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function getYahooCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  try {
    // yfinance uses fc.yahoo.com to get initial cookies
    const initRes = await fetch('https://fc.yahoo.com/', {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'manual',
    });
    const cookie = initRes.headers.get('set-cookie') || '';

    // Then fetch crumb with those cookies
    const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': USER_AGENT, 'Cookie': cookie },
    });
    if (!crumbRes.ok) {
      console.error('Crumb fetch failed:', crumbRes.status);
      return null;
    }
    const crumb = await crumbRes.text();
    if (!crumb || crumb.includes('<')) {
      console.error('Invalid crumb response');
      return null;
    }
    return { crumb: crumb.trim(), cookie };
  } catch (e) {
    console.error('getYahooCrumb error:', e);
    return null;
  }
}

async function fetchYahooMetadata(
  ticker: string,
  auth: { crumb: string; cookie: string } | null
): Promise<{ sector: string | null; earningsDates: string[] }> {
  if (!auth) return { sector: null, earningsDates: [] };

  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=assetProfile,calendarEvents&crumb=${encodeURIComponent(auth.crumb)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Cookie': auth.cookie },
    });

    if (!res.ok) {
      console.error(`Yahoo error for ${ticker}: ${res.status}`);
      return { sector: null, earningsDates: [] };
    }

    const data = await res.json();
    const result = data?.quoteSummary?.result?.[0];

    const sector = result?.assetProfile?.sector || null;

    const earningsRaw = result?.calendarEvents?.earnings?.earningsDate || [];
    const earningsDates = earningsRaw.map((d: any) => {
      if (d?.fmt) return d.fmt;
      if (d?.raw) return new Date(d.raw * 1000).toISOString().split('T')[0];
      return null;
    }).filter(Boolean) as string[];

    return { sector, earningsDates };
  } catch (e) {
    console.error(`Error fetching metadata for ${ticker}:`, e);
    return { sector: null, earningsDates: [] };
  }
}

// ─── RRG Helpers ───

function calcEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calcRSRatio(tickerCloses: number[], benchmarkCloses: number[], period = 10): number[] {
  const rs = tickerCloses.map((v, i) => (v / benchmarkCloses[i]) * 100);
  const rsRatio = calcEMA(rs, period);
  const mean = rsRatio.reduce((a, b) => a + b, 0) / rsRatio.length;
  return rsRatio.map(v => (v / mean) * 100);
}

function calcRSMomentum(rsRatio: number[], period = 10): number[] {
  const momentum: number[] = new Array(rsRatio.length).fill(100);
  for (let i = period; i < rsRatio.length; i++) {
    if (rsRatio[i - period] !== 0) {
      momentum[i] = (rsRatio[i] / rsRatio[i - period]) * 100;
    }
  }
  return momentum;
}

function getRRGQuadrant(rsRatio: number, rsMomentum: number): string {
  if (rsRatio >= 100 && rsMomentum >= 100) return 'Leading';
  if (rsRatio >= 100 && rsMomentum < 100) return 'Weakening';
  if (rsRatio < 100 && rsMomentum < 100) return 'Lagging';
  return 'Improving';
}

async function fetchWeeklyCloses(ticker: string, apiKey: string): Promise<number[] | null> {
  const to = new Date();
  const from = new Date();
  from.setFullYear(from.getFullYear() - 2);

  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/week/${from.toISOString().split('T')[0]}/${to.toISOString().split('T')[0]}?adjusted=true&sort=asc&limit=200&apiKey=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.results || data.results.length < 30) return null;
    return data.results.map((r: any) => r.c);
  } catch {
    return null;
  }
}

// ─── Main Handler ───

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tickers } = await req.json();
    const apiKey = Deno.env.get('POLYGON_API_KEY');

    if (!apiKey) throw new Error('POLYGON_API_KEY not configured');
    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      throw new Error('tickers array is required');
    }

    const upperTickers = tickers.map((t: string) => t.toUpperCase());

    // Step 1: Get Yahoo crumb once, then fetch metadata for all tickers
    const auth = await getYahooCrumb();
    if (!auth) console.warn('Yahoo crumb unavailable - earnings/sector data will be empty');

    const yahooResults = await Promise.all(
      upperTickers.map(async (ticker) => {
        const meta = await fetchYahooMetadata(ticker, auth);
        return { ticker, ...meta };
      })
    );

    // Step 2: Determine which sector ETFs we need to compute quadrants for
    const neededETFs = new Set<string>();
    yahooResults.forEach(r => {
      if (r.sector) {
        const etf = SECTOR_TO_ETF[r.sector];
        if (etf) neededETFs.add(etf);
      }
    });

    // Step 3: Fetch weekly closes for SPY + needed sector ETFs
    const etfsToFetch = ['SPY', ...Array.from(neededETFs)];
    const closesMap: Record<string, number[] | null> = {};
    await Promise.all(
      etfsToFetch.map(async (etf) => {
        closesMap[etf] = await fetchWeeklyCloses(etf, apiKey);
      })
    );

    // Step 4: Compute RRG quadrant for each sector ETF
    const sectorQuadrants: Record<string, string> = {};
    const spyCloses = closesMap['SPY'];

    if (spyCloses) {
      for (const etf of Array.from(neededETFs)) {
        const etfCloses = closesMap[etf];
        if (!etfCloses) {
          sectorQuadrants[etf] = 'N/A';
          continue;
        }
        const minLen = Math.min(etfCloses.length, spyCloses.length);
        const etfSlice = etfCloses.slice(-minLen);
        const spySlice = spyCloses.slice(-minLen);

        const rsRatio = calcRSRatio(etfSlice, spySlice, 10);
        const rsMomentum = calcRSMomentum(rsRatio, 10);

        sectorQuadrants[etf] = getRRGQuadrant(
          rsRatio[rsRatio.length - 1],
          rsMomentum[rsMomentum.length - 1]
        );
      }
    }

    // Step 5: Build results
    const results = yahooResults.map(r => {
      const sectorETF = r.sector ? (SECTOR_TO_ETF[r.sector] || null) : null;
      const sectorQuadrant = sectorETF ? (sectorQuadrants[sectorETF] || 'N/A') : 'N/A';
      const sectorColor = (sectorQuadrant === 'Weakening' || sectorQuadrant === 'Lagging') 
        ? 'red' 
        : (sectorQuadrant === 'Leading' || sectorQuadrant === 'Improving') 
          ? 'green' 
          : null;

      return {
        ticker: r.ticker,
        sector: r.sector,
        sectorETF,
        sectorQuadrant,
        sectorColor,
        earningsDates: r.earningsDates.length > 0 ? r.earningsDates : null,
      };
    });

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in stock-metadata:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
