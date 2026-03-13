// Sector Rotation Dashboard — institutional-grade composite scoring + RRG (v3)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ─── Constants ───

const BENCHMARK = "SPY";

const SECTORS: Record<string, string> = {
  "XLC":  "Comm. Services",
  "XLY":  "Consumer Disc.",
  "XLP":  "Consumer Staples",
  "XLE":  "Energy",
  "XLF":  "Financials",
  "XLV":  "Healthcare",
  "XLI":  "Industrials",
  "XLB":  "Materials",
  "XLRE": "Real Estate",
  "XLK":  "Technology",
  "XLU":  "Utilities",
};

const SECTOR_STOCKS: Record<string, string[]> = {
  "XLC":  ["META", "GOOGL", "GOOG", "NFLX", "DIS"],
  "XLY":  ["AMZN", "TSLA", "HD", "MCD", "NKE"],
  "XLP":  ["PG", "KO", "PEP", "COST", "WMT"],
  "XLE":  ["XOM", "CVX", "COP", "EOG", "SLB"],
  "XLF":  ["BRK-B", "JPM", "V", "MA", "BAC"],
  "XLV":  ["LLY", "UNH", "JNJ", "ABBV", "MRK"],
  "XLI":  ["GE", "CAT", "RTX", "HON", "UNP"],
  "XLB":  ["LIN", "APD", "SHW", "FCX", "NEM"],
  "XLRE": ["PLD", "AMT", "EQIX", "CCI", "PSA"],
  "XLK":  ["NVDA", "AAPL", "MSFT", "AVGO", "AMD"],
  "XLU":  ["NEE", "SO", "DUK", "AEP", "D"],
};

const TF_BARS: Record<string, number> = { "1W": 5, "1M": 21, "3M": 63, "6M": 126, "1Y": 252 };

const BS_MIN_SCORE = 60;
const BS_MIN_MOMENTUM = 45;
const BS_MIN_BREADTH = 50;

// RRG params (kept for chart)
const TAIL_WEEKS = 12;
const SMOOTH_W = 10;
const MOM_W = 4;
const RATIO_ZSCALE = 10;
const MOM_ZSCALE = 10;

// ─── Utilities ───

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url: string, retries = 3, backoffMs = 300): Promise<Response> {
  let attempt = 0;
  let lastErr: any;
  while (attempt <= retries) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt === retries) throw err;
      const wait = backoffMs * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
      console.log(`Retrying (${attempt + 1}/${retries}): ${err}`);
      await sleep(wait);
      attempt++;
    }
  }
  throw lastErr;
}

interface Bar { t: number; o: number; h: number; l: number; c: number; v: number }

async function fetchDailyBars(ticker: string, apiKey: string, daysBack = 400): Promise<Bar[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack - 10);
  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${start.toISOString().split('T')[0]}/${end.toISOString().split('T')[0]}?adjusted=true&sort=asc&limit=500&apiKey=${apiKey}`;
  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      console.error(`${ticker} HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    return data?.results || [];
  } catch (e) {
    console.error(`${ticker} fetch error:`, e);
    return [];
  }
}

async function fetchWeeklyBars(ticker: string, apiKey: string): Promise<Bar[]> {
  const start = "2023-01-01";
  const end = new Date().toISOString().split("T")[0];
  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/week/${start}/${end}?adjusted=true&sort=asc&limit=50000&apiKey=${apiKey}`;
  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data?.results || [];
  } catch (e) {
    console.error(`${ticker} weekly fetch error:`, e);
    return [];
  }
}

// ─── Return Calculations ───

function pctReturn(closes: number[], nBars: number): number | null {
  if (closes.length < nBars + 1) return null;
  const end = closes[closes.length - 1];
  const start = closes[closes.length - nBars - 1];
  if (start === 0) return null;
  return Math.round((end - start) / start * 10000) / 100;
}

function ytdReturn(bars: Bar[]): number | null {
  if (!bars || bars.length < 2) return null;
  const today = new Date();
  const ytdCutoff = new Date(today.getFullYear(), 0, 2).getTime();
  const ytdBars = bars.filter(b => b.t >= ytdCutoff);
  if (ytdBars.length < 2) return null;
  const anchor = ytdBars[0].c;
  const latest = ytdBars[ytdBars.length - 1].c;
  if (anchor === 0) return null;
  return Math.round((latest - anchor) / anchor * 10000) / 100;
}

// ─── Momentum Score ───

function momentumScore(closes: number[]): number | null {
  if (closes.length < 130) return null;
  const r1m = pctReturn(closes, 21);
  const r3m = pctReturn(closes, 63);
  const r6m = pctReturn(closes, 126);
  if (r1m === null || r3m === null || r6m === null) return null;

  const accelShort = r1m - (r3m / 3);
  const accelMed = r3m - (r6m / 2);

  // Slope of last 20 days
  const y = closes.slice(-20);
  const n = y.length;
  const xMean = (n - 1) / 2;
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (y[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const slopePct = (slope / closes[closes.length - 21]) * 100;

  const raw = (accelShort * 0.40) + (accelMed * 0.30) + (slopePct * 20 * 0.30);
  return Math.round(Math.max(0, Math.min(100, 50 + (raw / 10) * 50)) * 10) / 10;
}

// ─── RS Trend ───

function rsTrend(sectorCloses: number[], spyCloses: number[]): number | null {
  const n = Math.min(sectorCloses.length, spyCloses.length, 63);
  if (n < 10) return null;
  const sSector = sectorCloses.slice(-n);
  const sSpy = spyCloses.slice(-n);
  const rs = sSector.map((v, i) => v / sSpy[i]);

  // Linear regression slope
  const xMean = (n - 1) / 2;
  const yMean = rs.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (rs[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const norm = (slope / rs[0]) * 100;

  if (norm > 0.02) return 1;
  if (norm < -0.02) return -1;
  return 0;
}

function rsLabel(dir: number | null): string {
  if (dir === null) return "N/A";
  return { 1: "Rising", 0: "Flat", [-1]: "Falling" }[dir] || "N/A";
}

// ─── Breadth Score ───

function aboveSMA(closes: number[], period: number): boolean | null {
  if (closes.length < period) return null;
  const sma = closes.slice(-period).reduce((a, b) => a + b, 0) / period;
  return closes[closes.length - 1] > sma;
}

async function breadthScore(sectorKey: string, apiKey: string): Promise<number | null> {
  const stocks = SECTOR_STOCKS[sectorKey] || [];
  const above50: number[] = [];
  const above200: number[] = [];

  for (const stock of stocks) {
    const bars = await fetchDailyBars(stock, apiKey, 250);
    await sleep(150);
    if (!bars.length) continue;
    const closes = bars.map(b => b.c);

    const r50 = aboveSMA(closes, 50);
    const r200 = aboveSMA(closes, 200);
    if (r50 !== null) above50.push(r50 ? 1 : 0);
    if (r200 !== null) above200.push(r200 ? 1 : 0);
  }

  if (!above50.length && !above200.length) return null;
  const pct50 = above50.length ? (above50.reduce((a, b) => a + b, 0) / above50.length * 100) : 50;
  const pct200 = above200.length ? (above200.reduce((a, b) => a + b, 0) / above200.length * 100) : 50;
  return Math.round((pct50 * 0.60 + pct200 * 0.40) * 10) / 10;
}

// ─── Composite Score ───

function clip(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function compositeScore(
  rel1m: number | null, rel3m: number | null,
  mom: number | null, breadth: number | null, rsDir: number | null
): number | null {
  const components: [number, number][] = [];
  if (rel1m !== null) components.push([clip(50 + rel1m * 5, 0, 100), 0.25]);
  if (rel3m !== null) components.push([clip(50 + rel3m * 3, 0, 100), 0.25]);
  if (mom !== null) components.push([mom, 0.25]);
  if (breadth !== null) components.push([breadth, 0.15]);
  if (rsDir !== null) components.push([{ 1: 75, 0: 50, [-1]: 25 }[rsDir] || 50, 0.10]);
  if (!components.length) return null;
  const totalW = components.reduce((a, [, w]) => a + w, 0);
  return Math.round(components.reduce((a, [v, w]) => a + v * w, 0) / totalW * 10) / 10;
}

function compositeLabel(score: number | null): string {
  if (score === null) return "N/A";
  if (score >= 75) return "Strong buy";
  if (score >= 60) return "Buy";
  if (score >= 45) return "Neutral";
  if (score >= 30) return "Sell";
  return "Strong sell";
}

// ─── Score History ───

interface ScoreEntry { date: string; score: number }

async function loadHistory(supabaseAdmin: any): Promise<Record<string, ScoreEntry[]>> {
  const { data, error } = await supabaseAdmin
    .from('sector_score_history')
    .select('ticker, score, recorded_at')
    .order('recorded_at', { ascending: true });

  if (error) {
    console.error('Error loading history:', error);
    return {};
  }

  const history: Record<string, ScoreEntry[]> = {};
  for (const row of (data || [])) {
    if (!history[row.ticker]) history[row.ticker] = [];
    history[row.ticker].push({ date: row.recorded_at, score: Number(row.score) });
  }
  return history;
}

async function saveScore(supabaseAdmin: any, ticker: string, score: number): Promise<void> {
  const todayStr = new Date().toISOString().split('T')[0];
  const { error } = await supabaseAdmin
    .from('sector_score_history')
    .upsert(
      { ticker, score, recorded_at: todayStr },
      { onConflict: 'ticker,recorded_at' }
    );
  if (error) console.error(`Error saving score for ${ticker}:`, error);
}

function trajectoryArrow(scores: number[]): { arrow: string; delta: number } {
  if (scores.length < 2) return { arrow: "—", delta: 0 };
  const delta = Math.round((scores[scores.length - 1] - scores[scores.length - 2]) * 10) / 10;
  let arrow: string;
  if (delta >= 5) arrow = "↑↑";
  else if (delta >= 2) arrow = "↑";
  else if (delta > -2) arrow = "→";
  else if (delta > -5) arrow = "↓";
  else arrow = "↓↓";
  return { arrow, delta };
}

// ─── Bull Spread Filter ───

interface BullSpreadResult {
  passes: boolean;
  reason: string;
  trajectorySignal: string;
  entryQuality: string;
}

function bullSpreadFilter(
  row: any,
  history: Record<string, ScoreEntry[]>
): BullSpreadResult {
  const { composite, rsTrendDir, momentum, breadth, ticker } = row;
  const failures: string[] = [];

  if (composite === null || composite < BS_MIN_SCORE) failures.push(`Score ${composite?.toFixed(0) ?? 'N/A'} < ${BS_MIN_SCORE}`);
  if (rsTrendDir !== 1) failures.push(`RS ${rsLabel(rsTrendDir)}`);
  if (momentum === null || momentum <= BS_MIN_MOMENTUM) failures.push(`Mom ${momentum?.toFixed(0) ?? 'N/A'} <= ${BS_MIN_MOMENTUM}`);
  if (breadth === null || breadth <= BS_MIN_BREADTH) failures.push(`Breadth ${breadth?.toFixed(0) ?? 'N/A'}% <= ${BS_MIN_BREADTH}%`);

  const passes = failures.length === 0;
  const entries = history[ticker] || [];
  const scores = entries.map(e => e.score);
  const { arrow, delta } = trajectoryArrow(scores);
  const trajectorySignal = scores.length >= 2 ? `${arrow} (${delta >= 0 ? '+' : ''}${delta.toFixed(1)})` : "new";

  let entryQuality: string;
  if (passes) {
    if (delta >= 3) entryQuality = "EARLY/ACCELERATING";
    else if (delta >= 0) entryQuality = "CONFIRMED";
    else if (delta >= -3) entryQuality = "PLATEAUING — caution";
    else entryQuality = "FADING — skip";
  } else {
    entryQuality = "FILTERED OUT";
  }

  return { passes, reason: failures.length ? failures.join(", ") : "All filters passed", trajectorySignal, entryQuality };
}

// ─── RRG Calculations (kept for chart) ───

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

function pctChangeArr(arr: (number | null)[], period: number): (number | null)[] {
  return arr.map((v, i) => {
    if (i < period || v === null || arr[i - period] === null || arr[i - period] === 0) return null;
    return (v - arr[i - period]!) / arr[i - period]!;
  });
}

// ─── Main Handler ───

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("POLYGON_API_KEY");
    if (!apiKey) throw new Error("POLYGON_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    console.log(`[sector-rrg v3] Starting at ${new Date().toISOString()}`);

    // ─── Step 1: Fetch ETF daily data ───
    console.log("[1/4] Fetching ETF price history...");
    const sectorTickers = Object.keys(SECTORS);
    const allETFTickers = [BENCHMARK, ...sectorTickers];

    const etfBars: Record<string, Bar[]> = {};
    const etfCloses: Record<string, number[]> = {};

    for (const ticker of allETFTickers) {
      const bars = await fetchDailyBars(ticker, apiKey, 400);
      etfBars[ticker] = bars;
      etfCloses[ticker] = bars.map(b => b.c);
      await sleep(150);
    }

    const spyBars = etfBars[BENCHMARK];
    const spyCloses = etfCloses[BENCHMARK];

    if (!spyCloses.length) throw new Error("Failed to fetch SPY data");

    // ─── Step 2: Fetch breadth data ───
    console.log("[2/4] Fetching breadth data (top 5 per sector)...");
    const breadthScores: Record<string, number | null> = {};
    for (const ticker of sectorTickers) {
      breadthScores[ticker] = await breadthScore(ticker, apiKey);
    }

    // ─── Step 3: Compute scores ───
    console.log("[3/4] Computing scores...");
    const spyReturns: Record<string, number | null> = {};
    for (const [tf, n] of Object.entries(TF_BARS)) {
      spyReturns[tf] = pctReturn(spyCloses, n);
    }
    spyReturns["YTD"] = ytdReturn(spyBars);

    // Load history
    const history = await loadHistory(supabaseAdmin);

    const records: any[] = [];
    for (const ticker of sectorTickers) {
      const closes = etfCloses[ticker];
      const bars = etfBars[ticker];

      const rets: Record<string, number | null> = {};
      for (const [tf, n] of Object.entries(TF_BARS)) {
        rets[tf] = pctReturn(closes, n);
      }
      rets["YTD"] = ytdReturn(bars);

      const vs: Record<string, number | null> = {};
      for (const tf of Object.keys(rets)) {
        vs[tf] = (rets[tf] !== null && spyReturns[tf] !== null)
          ? Math.round((rets[tf]! - spyReturns[tf]!) * 100) / 100
          : null;
      }

      const mom = momentumScore(closes);
      const rsDir = rsTrend(closes, spyCloses);
      const brd = breadthScores[ticker] ?? null;
      const comp = compositeScore(vs["1M"], vs["3M"], mom, brd, rsDir);

      // Save score to history
      if (comp !== null) {
        await saveScore(supabaseAdmin, ticker, comp);
      }

      records.push({
        ticker,
        sector: SECTORS[ticker],
        returns: rets,
        vsSpy: vs,
        momentum: mom,
        breadth: brd,
        rsTrendLabel: rsLabel(rsDir),
        rsTrendDir: rsDir,
        composite: comp,
        compositeLabel: compositeLabel(comp),
      });
    }

    // Refresh history after saves
    const updatedHistory = await loadHistory(supabaseAdmin);

    // Add trajectory info to each record
    for (const rec of records) {
      const entries = updatedHistory[rec.ticker] || [];
      const scores = entries.map((e: ScoreEntry) => e.score);
      const { arrow, delta } = trajectoryArrow(scores);
      rec.trajectory = { arrow, delta, history: entries.slice(-4) };
    }

    // Sort by composite descending
    records.sort((a, b) => (b.composite ?? -999) - (a.composite ?? -999));

    // ─── Bull Spread Filter ───
    const bullSpread = records.map(rec => {
      const result = bullSpreadFilter(rec, updatedHistory);
      return { ticker: rec.ticker, sector: rec.sector, ...result, composite: rec.composite, momentum: rec.momentum, breadth: rec.breadth, rsTrendLabel: rec.rsTrendLabel };
    });

    // ─── Step 4: RRG chart data (weekly) ───
    console.log("[4/4] Computing RRG chart data...");

    // Fetch weekly data for RRG
    const weeklyClosesMap: Record<string, { dates: number[]; closes: number[] }> = {};
    for (const ticker of allETFTickers) {
      const bars = await fetchWeeklyBars(ticker, apiKey);
      if (bars.length >= 20) {
        weeklyClosesMap[ticker] = { dates: bars.map(b => b.t), closes: bars.map(b => b.c) };
      }
      await sleep(150);
    }

    let rrgResults: any[] = [];
    let latestDate = "";

    if (weeklyClosesMap[BENCHMARK]) {
      // Find common dates
      let commonDates = [...weeklyClosesMap[BENCHMARK].dates];
      const availableSectors = sectorTickers.filter(s => weeklyClosesMap[s]);

      for (const s of availableSectors) {
        const sectorDates = new Set(weeklyClosesMap[s].dates);
        commonDates = commonDates.filter(d => sectorDates.has(d));
      }
      commonDates.sort((a, b) => a - b);

      if (commonDates.length >= 20) {
        const buildAligned = (ticker: string): number[] => {
          const dateMap = new Map<number, number>();
          weeklyClosesMap[ticker].dates.forEach((d, i) => dateMap.set(d, weeklyClosesMap[ticker].closes[i]));
          return commonDates.map(d => dateMap.get(d)!);
        };

        const benchCloses = buildAligned(BENCHMARK);
        latestDate = new Date(commonDates[commonDates.length - 1]).toISOString().split("T")[0];

        for (const sector of availableSectors) {
          const sectorCloses = buildAligned(sector);
          const rs = sectorCloses.map((c, i) => c / benchCloses[i]);
          const rsSmooth = rollingMean(rs, SMOOTH_W);
          const rsRatio = zscoreCenter(rsSmooth, RATIO_ZSCALE);
          const momRaw = pctChangeArr(rsRatio, MOM_W);
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

          rrgResults.push({ ticker: sector, quadrant, rsRatio: latest.rsRatio, rsMomentum: latest.rsMomentum, trail });
        }
      }
    }

    console.log(`[sector-rrg v3] Done. ${records.length} sectors scored, ${rrgResults.length} RRG computed.`);

    return new Response(
      JSON.stringify({
        // RRG chart data (kept)
        results: rrgResults,
        latestDate,
        benchmark: BENCHMARK,
        // New dashboard data
        dashboard: {
          sectors: records,
          spyReturns,
          bullSpread,
          asOf: new Date().toISOString(),
        },
      }),
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
