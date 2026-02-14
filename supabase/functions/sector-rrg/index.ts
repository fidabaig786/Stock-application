import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BENCHMARK = "SPY";
const SECTORS = ["XLB","XLE","XLF","XLI","XLK","XLP","XLY","XLV","XLU","XLRE","XLC"];
const TAIL_WEEKS = 12;
const SMOOTH_W = 10;
const MOM_W = 4;
const RATIO_ZSCALE = 10;
const MOM_ZSCALE = 10;

interface Bar { t: number; c: number }

async function fetchWeeklyCloses(ticker: string, apiKey: string): Promise<{ dates: number[]; closes: number[] } | null> {
  const start = "2023-01-01";
  const end = new Date().toISOString().split("T")[0];
  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/week/${start}/${end}?adjusted=true&sort=asc&limit=50000&apiKey=${apiKey}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      console.error(`${ticker} HTTP ${res.status}: ${text.substring(0, 200)}`);
      return null;
    }
    const data = await res.json();
    const results: Bar[] = data?.results || [];
    if (results.length < 20) {
      console.error(`${ticker} only ${results.length} bars`);
      return null;
    }
    console.log(`${ticker}: ${results.length} bars, latest: ${new Date(results[results.length-1].t).toISOString().split("T")[0]}`);
    return {
      dates: results.map(r => r.t),
      closes: results.map(r => r.c),
    };
  } catch (e) {
    console.error(`${ticker} fetch error:`, e);
    return null;
  }
}

function rollingMean(arr: number[], window: number): (number | null)[] {
  const minPeriods = Math.max(3, Math.floor(window / 2));
  const result: (number | null)[] = [];
  for (let i = 0; i < arr.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = arr.slice(start, i + 1);
    if (slice.length >= minPeriods) {
      result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
    } else {
      result.push(null);
    }
  }
  return result;
}

function zscoreCenter(values: (number | null)[], scale: number): (number | null)[] {
  const valid = values.filter(v => v !== null) as number[];
  if (valid.length === 0) return values;
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const variance = valid.reduce((a, b) => a + (b - mean) ** 2, 0) / valid.length;
  const sd = Math.sqrt(variance);
  if (sd === 0) return values.map(v => v !== null ? 100 : null);
  return values.map(v => v !== null ? 100 + scale * ((v - mean) / sd) : null);
}

function pctChange(arr: (number | null)[], period: number): (number | null)[] {
  return arr.map((v, i) => {
    if (i < period || v === null || arr[i - period] === null || arr[i - period] === 0) return null;
    return (v - arr[i - period]!) / arr[i - period]!;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("POLYGON_API_KEY");
    if (!apiKey) throw new Error("POLYGON_API_KEY not configured");

    console.log(`[sector-rrg] Starting parallel fetch at ${new Date().toISOString()}`);

    // Fetch ALL tickers in parallel — no batching, no delays
    const allTickers = [BENCHMARK, ...SECTORS];
    const fetchResults = await Promise.all(allTickers.map(t => fetchWeeklyCloses(t, apiKey)));
    
    const closesMap: Record<string, { dates: number[]; closes: number[] }> = {};
    allTickers.forEach((t, i) => {
      if (fetchResults[i]) closesMap[t] = fetchResults[i]!;
    });

    if (!closesMap[BENCHMARK]) throw new Error("Failed to fetch SPY data");

    const availableSectors = SECTORS.filter(s => closesMap[s]);
    console.log(`[sector-rrg] Got ${Object.keys(closesMap).length} tickers, ${availableSectors.length} sectors`);

    // Find common dates
    let commonDates = [...closesMap[BENCHMARK].dates];
    for (const s of availableSectors) {
      const sectorDates = new Set(closesMap[s].dates);
      commonDates = commonDates.filter(d => sectorDates.has(d));
    }
    commonDates.sort((a, b) => a - b);

    if (commonDates.length < 20) throw new Error(`Only ${commonDates.length} common weeks`);

    const buildAligned = (ticker: string): number[] => {
      const dateMap = new Map<number, number>();
      closesMap[ticker].dates.forEach((d, i) => dateMap.set(d, closesMap[ticker].closes[i]));
      return commonDates.map(d => dateMap.get(d)!);
    };

    const benchCloses = buildAligned(BENCHMARK);
    const latestDate = new Date(commonDates[commonDates.length - 1]).toISOString().split("T")[0];
    console.log(`[sector-rrg] ${commonDates.length} aligned weeks, latest: ${latestDate}`);

    // Check for stale data
    const latestYear = new Date(commonDates[commonDates.length - 1]).getFullYear();
    const currentYear = new Date().getFullYear();
    if (latestYear < currentYear) {
      console.warn(`[sector-rrg] WARNING: Latest data is from ${latestYear}, current year is ${currentYear}`);
    }

    const results: Array<{
      ticker: string;
      quadrant: string;
      rsRatio: number;
      rsMomentum: number;
      trail: Array<{ rsRatio: number; rsMomentum: number; date: string }>;
    }> = [];

    for (const sector of availableSectors) {
      const sectorCloses = buildAligned(sector);
      const rs = sectorCloses.map((c, i) => c / benchCloses[i]);
      const rsSmooth = rollingMean(rs, SMOOTH_W);
      const rsRatio = zscoreCenter(rsSmooth, RATIO_ZSCALE);
      const momRaw = pctChange(rsRatio, MOM_W);
      const rsMom = zscoreCenter(momRaw, MOM_ZSCALE);

      const validIndices: number[] = [];
      for (let i = 0; i < commonDates.length; i++) {
        if (rsRatio[i] !== null && rsMom[i] !== null) validIndices.push(i);
      }
      if (validIndices.length === 0) continue;

      const tailIndices = validIndices.slice(-TAIL_WEEKS);
      const trail = tailIndices.map(i => ({
        rsRatio: Math.round(rsRatio[i]! * 100) / 100,
        rsMomentum: Math.round(rsMom[i]! * 100) / 100,
        date: new Date(commonDates[i]).toISOString().split("T")[0],
      }));

      const latest = trail[trail.length - 1];
      let quadrant = "Lagging";
      if (latest.rsRatio >= 100 && latest.rsMomentum >= 100) quadrant = "Leading";
      else if (latest.rsRatio >= 100 && latest.rsMomentum < 100) quadrant = "Weakening";
      else if (latest.rsRatio < 100 && latest.rsMomentum >= 100) quadrant = "Improving";

      results.push({ ticker: sector, quadrant, rsRatio: latest.rsRatio, rsMomentum: latest.rsMomentum, trail });
    }

    console.log(`[sector-rrg] Done. ${results.length} sectors computed.`);

    return new Response(
      JSON.stringify({ results, latestDate, benchmark: BENCHMARK }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("sector-rrg error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
