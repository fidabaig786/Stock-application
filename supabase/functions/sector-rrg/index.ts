// Sector RRG edge function — z-score based RS-Ratio & RS-Momentum
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const res = await fetch(url);
    if (!res.ok) { console.error(`${ticker} HTTP ${res.status}`); return null; }
    const data = await res.json();
    const results: Bar[] = data?.results || [];
    if (results.length < 30) { console.error(`${ticker} only ${results.length} bars`); return null; }
    return {
      dates: results.map(r => r.t),
      closes: results.map(r => r.c),
    };
  } catch (e) {
    console.error(`${ticker} fetch error:`, e);
    return null;
  }
}

// Rolling mean
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

// Z-score normalization centered at 100
function zscoreCenter(values: (number | null)[], scale: number): (number | null)[] {
  const valid = values.filter(v => v !== null) as number[];
  if (valid.length === 0) return values;
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const variance = valid.reduce((a, b) => a + (b - mean) ** 2, 0) / valid.length;
  const sd = Math.sqrt(variance);
  if (sd === 0) return values.map(v => v !== null ? 100 : null);
  return values.map(v => v !== null ? 100 + scale * ((v - mean) / sd) : null);
}

// Pct change with period
function pctChange(arr: (number | null)[], period: number): (number | null)[] {
  return arr.map((v, i) => {
    if (i < period || v === null || arr[i - period] === null || arr[i - period] === 0) return null;
    return (v - arr[i - period]!) / arr[i - period]!;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("POLYGON_API_KEY");
    if (!apiKey) throw new Error("POLYGON_API_KEY not configured");

    // 1) Fetch all weekly closes
    const allTickers = [BENCHMARK, ...SECTORS];
    const fetchResults = await Promise.all(allTickers.map(t => fetchWeeklyCloses(t, apiKey)));

    const closesMap: Record<string, { dates: number[]; closes: number[] }> = {};
    allTickers.forEach((t, i) => {
      if (fetchResults[i]) closesMap[t] = fetchResults[i]!;
    });

    if (!closesMap[BENCHMARK]) throw new Error("Failed to fetch SPY data");

    // 2) Align all series by timestamp intersection
    const benchDates = new Set(closesMap[BENCHMARK].dates.map(d => d));
    const availableSectors = SECTORS.filter(s => closesMap[s]);

    // Find common dates across benchmark and all available sectors
    let commonDates = [...benchDates];
    for (const s of availableSectors) {
      const sectorDates = new Set(closesMap[s].dates);
      commonDates = commonDates.filter(d => sectorDates.has(d));
    }
    commonDates.sort((a, b) => a - b);

    if (commonDates.length < 30) throw new Error("Not enough common weekly data");

    // Build aligned close arrays
    const buildAligned = (ticker: string): number[] => {
      const dateMap = new Map<number, number>();
      closesMap[ticker].dates.forEach((d, i) => dateMap.set(d, closesMap[ticker].closes[i]));
      return commonDates.map(d => dateMap.get(d)!);
    };

    const benchCloses = buildAligned(BENCHMARK);
    const latestDate = new Date(commonDates[commonDates.length - 1]).toISOString().split("T")[0];
    console.log(`[sector-rrg] ${commonDates.length} aligned weeks, latest: ${latestDate}`);

    // 3) For each sector: RS -> smooth -> z-score RS-Ratio -> momentum -> z-score RS-Momentum
    const results: Array<{
      ticker: string;
      quadrant: string;
      rsRatio: number;
      rsMomentum: number;
      trail: Array<{ rsRatio: number; rsMomentum: number; date: string }>;
    }> = [];

    for (const sector of availableSectors) {
      const sectorCloses = buildAligned(sector);

      // Relative strength
      const rs = sectorCloses.map((c, i) => c / benchCloses[i]);

      // Smooth RS with rolling mean
      const rsSmooth = rollingMean(rs, SMOOTH_W);

      // Z-score RS-Ratio
      const rsRatio = zscoreCenter(rsSmooth, RATIO_ZSCALE);

      // Momentum: pct_change of RS-Ratio
      const momRaw = pctChange(rsRatio, MOM_W);

      // Z-score RS-Momentum
      const rsMom = zscoreCenter(momRaw, MOM_ZSCALE);

      // Find valid indices (both rsRatio and rsMom not null)
      const validIndices: number[] = [];
      for (let i = 0; i < commonDates.length; i++) {
        if (rsRatio[i] !== null && rsMom[i] !== null) validIndices.push(i);
      }

      if (validIndices.length === 0) continue;

      // Take last TAIL_WEEKS
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

      results.push({
        ticker: sector,
        quadrant,
        rsRatio: latest.rsRatio,
        rsMomentum: latest.rsMomentum,
        trail,
      });
    }

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
