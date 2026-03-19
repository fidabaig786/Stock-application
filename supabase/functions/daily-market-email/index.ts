import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url: string, retries = 3, backoffMs = 300): Promise<Response> {
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt === retries) throw err;
      await sleep(backoffMs * Math.pow(2, attempt) + Math.random() * 100);
    }
  }
  throw lastErr;
}

// ─── POLYGON HELPERS ───

async function fetchBars(ticker: string, apiKey: string, daysBack = 300): Promise<any[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (daysBack + 15));
  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${fmt_date(start)}/${fmt_date(end)}?adjusted=true&sort=asc&limit=500&apiKey=${apiKey}`;
  try {
    const res = await fetchWithRetry(url);
    const data = await res.json();
    return data.results || [];
  } catch (e) {
    console.error(`fetchBars error for ${ticker}:`, e);
    return [];
  }
}

function fmt_date(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ─── INDICATORS ───

function emaValue(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let val = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    val = closes[i] * k + val * (1 - k);
  }
  return Math.round(val * 100) / 100;
}

function emaSeries(closes: number[], period: number): number[] {
  if (closes.length < period) return [];
  const k = 2 / (period + 1);
  const result = [closes.slice(0, period).reduce((a, b) => a + b, 0) / period];
  for (let i = period; i < closes.length; i++) {
    result.push(closes[i] * k + result[result.length - 1] * (1 - k));
  }
  return result;
}

function calcMACD(closes: number[], fast = 12, slow = 26, signal = 9) {
  if (closes.length < slow + signal) return { macd: null, sig: null, hist: null, histRising: null };
  const fe = emaSeries(closes, fast);
  const se = emaSeries(closes, slow);
  const ml = Math.min(fe.length, se.length);
  const macdLine = Array.from({ length: ml }, (_, i) => fe[i] - se[i]);
  if (macdLine.length < signal) return { macd: null, sig: null, hist: null, histRising: null };
  const sigLine = emaSeries(macdLine, signal);
  const hist = Array.from({ length: sigLine.length }, (_, i) => macdLine[i] - sigLine[i]);
  const histRising = hist.length >= 2 ? hist[hist.length - 1] > hist[hist.length - 2] : null;
  return {
    macd: Math.round(macdLine[macdLine.length - 1] * 100) / 100,
    sig: Math.round(sigLine[sigLine.length - 1] * 100) / 100,
    hist: Math.round(hist[hist.length - 1] * 100) / 100,
    histRising,
  };
}

function calcRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const diffs = closes.slice(1).map((v, i) => v - closes[i]);
  const gains = diffs.map(d => d > 0 ? d : 0);
  const losses = diffs.map(d => d < 0 ? -d : 0);
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }
  if (avgLoss === 0) return 100;
  return Math.round((100 - 100 / (1 + avgGain / avgLoss)) * 10) / 10;
}

function isSideways(closes: number[], period = 20, threshold = 3.0): { sideways: boolean | null; rangePct: number | null } {
  if (closes.length < period) return { sideways: null, rangePct: null };
  const window = closes.slice(-period);
  const hi = Math.max(...window), lo = Math.min(...window);
  const mid = (hi + lo) / 2;
  const rangePct = Math.round((hi - lo) / mid * 10000) / 100;
  return { sideways: rangePct < threshold, rangePct };
}

function pullbackDetected(closes: number[], period = 20, threshold = 3.0): { pullback: boolean | null; dropPct: number | null } {
  if (closes.length < period) return { pullback: null, dropPct: null };
  const recentHigh = Math.max(...closes.slice(-period));
  const dropPct = Math.round((recentHigh - closes[closes.length - 1]) / recentHigh * 10000) / 100;
  return { pullback: dropPct >= threshold, dropPct };
}

function qqqDirection(closes: number[], lookback = 5): { goingUp: boolean | null; chg: number | null } {
  if (closes.length < lookback + 1) return { goingUp: null, chg: null };
  const chg = Math.round((closes[closes.length - 1] - closes[closes.length - lookback - 1]) / closes[closes.length - lookback - 1] * 10000) / 100;
  return { goingUp: closes[closes.length - 1] > closes[closes.length - lookback - 1], chg };
}

function avgVolume(bars: any[], period = 20): { avg: number | null; ratio: number | null } {
  const vols = bars.map(b => b.v);
  if (vols.length < period + 1) return { avg: null, ratio: null };
  const avg = vols.slice(-(period + 1), -1).reduce((a: number, b: number) => a + b, 0) / period;
  const ratio = avg > 0 ? Math.round(vols[vols.length - 1] / avg * 100) / 100 : null;
  return { avg: Math.round(avg), ratio };
}

function distanceFromEma(price: number, ema: number | null): number | null {
  if (!ema) return null;
  return Math.round((price - ema) / ema * 10000) / 100;
}

function crossJustHappened(closes: number[], fastPeriod: number, slowPeriod: number, lookback = 3): string | null {
  if (closes.length < slowPeriod + lookback) return null;
  for (let i = 1; i <= lookback; i++) {
    const sliceNow = i > 1 ? closes.slice(0, -(i - 1)) : closes;
    const slicePrev = closes.slice(0, -(i + 1));
    const fastNow = emaValue(sliceNow, fastPeriod);
    const slowNow = emaValue(sliceNow, slowPeriod);
    const fastPrev = emaValue(slicePrev, fastPeriod);
    const slowPrev = emaValue(slicePrev, slowPeriod);
    if (fastNow && slowNow && fastPrev && slowPrev) {
      if (fastPrev <= slowPrev && fastNow > slowNow) return "golden";
      if (fastPrev >= slowPrev && fastNow < slowNow) return "death";
    }
  }
  return null;
}

// ─── VIX via Polygon ───

async function fetchVIX(apiKey: string): Promise<{ vix: number | null; vixChg1w: number | null; vixSpiking: boolean; vixFallingFast: boolean }> {
  try {
    // Use I:VIX for the VIX index on Polygon
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 90);
    const url = `https://api.polygon.io/v2/aggs/ticker/I:VIX/range/1/day/${fmt_date(start)}/${fmt_date(end)}?adjusted=true&sort=asc&limit=500&apiKey=${apiKey}`;
    const res = await fetchWithRetry(url);
    const data = await res.json();
    const results = data.results || [];
    if (results.length < 6) return { vix: null, vixChg1w: null, vixSpiking: false, vixFallingFast: false };
    const closes = results.map((r: any) => r.c);
    const vix = Math.round(closes[closes.length - 1] * 100) / 100;
    const vix1w = closes[closes.length - 6];
    const vixChg1w = Math.round((vix - vix1w) * 100) / 100;
    return { vix, vixChg1w, vixSpiking: vixChg1w > 5, vixFallingFast: vixChg1w < -3 };
  } catch (e) {
    console.error('VIX fetch error:', e);
    return { vix: null, vixChg1w: null, vixSpiking: false, vixFallingFast: false };
  }
}

// ─── BREADTH via Polygon ───

async function fetchBreadth(apiKey: string): Promise<number | null> {
  const etfs = ["XLK", "XLF", "XLV", "XLI", "XLY", "XLP", "XLE", "XLU", "XLB", "XLRE", "XLC"];
  let aboveCount = 0;
  for (const etf of etfs) {
    try {
      const bars = await fetchBars(etf, apiKey, 120);
      await sleep(200);
      if (bars.length < 50) continue;
      const closes = bars.map((b: any) => b.c);
      const ema50 = emaValue(closes, 50);
      if (ema50 && closes[closes.length - 1] > ema50) aboveCount++;
    } catch (e) {
      console.error(`Breadth error for ${etf}:`, e);
    }
  }
  return Math.round(aboveCount / etfs.length * 1000) / 10;
}

// ─── MARKET BIAS ───

interface Check { label: string; passed: boolean; detail: string }

async function runMarketBias(apiKey: string): Promise<{ bias: string; price: number; date: string; checks: Check[]; notes: string[]; alerts: string[] }> {
  const bars = await fetchBars("QQQ", apiKey, 300);
  if (!bars.length) return { bias: "ERROR", price: 0, date: "", checks: [], notes: [], alerts: [] };

  const closes = bars.map((b: any) => b.c);
  const price = closes[closes.length - 1];
  const date = new Date(bars[bars.length - 1].t).toISOString().split('T')[0];

  const e8 = emaValue(closes, 8);
  const e34 = emaValue(closes, 34);
  const e50 = emaValue(closes, 50);
  const e200 = emaValue(closes, 200);
  const { macd: macdVal, sig: sigVal, hist: histVal, histRising } = calcMACD(closes);
  const rsiVal = calcRSI(closes);
  const { sideways, rangePct } = isSideways(closes);
  const { pullback, dropPct } = pullbackDetected(closes);
  const { goingUp, chg: chg5d } = qqqDirection(closes, 5);
  const { avg: avgVol, ratio: volRatio } = avgVolume(bars);
  const distE34 = distanceFromEma(price, e34);
  const cross50_200 = crossJustHappened(closes, 50, 200, 5);
  const cross8_34 = crossJustHappened(closes, 8, 34, 3);

  const { vix, vixChg1w, vixSpiking, vixFallingFast } = await fetchVIX(apiKey);
  await sleep(200);
  const breadthPct = await fetchBreadth(apiKey);

  const checks: Check[] = [];
  const notes: string[] = [];
  const alerts: string[] = [];

  // 1. Long term trend
  const golden = e50 !== null && e200 !== null && e50 > e200;
  checks.push({ label: "Long term trend (50 EMA vs 200 EMA)", passed: !!golden, detail: `50 EMA (${e50}) ${golden ? '>' : '<'} 200 EMA (${e200}) -- ${golden ? 'Bullish' : 'Bearish'}` });
  if (cross50_200 === "golden") alerts.push("GOLDEN CROSS just happened on 50/200 EMA");
  if (cross50_200 === "death") alerts.push("DEATH CROSS just happened on 50/200 EMA");

  // 2. Short term momentum
  const bullSt = e8 !== null && e34 !== null && e8 > e34;
  checks.push({ label: "Short term momentum (8 EMA vs 34 EMA)", passed: !!bullSt, detail: `8 EMA (${e8}) ${bullSt ? '>' : '<'} 34 EMA (${e34}) -- ${bullSt ? 'Bullish' : 'Bearish'}` });
  if (cross8_34 === "golden") alerts.push("8 EMA just crossed ABOVE 34 EMA -- buy signal");
  if (cross8_34 === "death") alerts.push("8 EMA just crossed BELOW 34 EMA -- sell signal");

  // 3. MACD
  const macdBull = macdVal !== null && sigVal !== null && macdVal > sigVal;
  checks.push({ label: "MACD (12,26,9) above signal", passed: !!macdBull, detail: `MACD (${macdVal}) ${macdBull ? 'above' : 'below'} signal (${sigVal})` });

  // 4. MACD histogram
  checks.push({ label: "MACD histogram rising", passed: !!histRising, detail: `Histogram ${histVal} -- ${histRising ? 'rising' : 'falling'}` });

  // 5. RSI
  const rsiOk = rsiVal !== null && rsiVal >= 45 && rsiVal <= 70;
  checks.push({ label: "RSI in healthy range (45-70)", passed: rsiOk, detail: `RSI ${rsiVal} -- ${rsiOk ? 'ideal zone' : (rsiVal && rsiVal > 70 ? 'overbought' : 'oversold')}` });
  if (rsiVal && rsiVal > 75) notes.push("RSI overbought -- wait for pullback");
  if (rsiVal && rsiVal < 35) notes.push("RSI oversold -- possible reversal setup");

  // 6. VIX
  const vixOk = vix !== null && vix < 20;
  let vixDetail = "VIX unavailable";
  if (vix !== null) {
    if (vix < 15) vixDetail = `VIX low at ${vix} -- options cheap, ideal for spreads`;
    else if (vix < 20) vixDetail = `VIX normal at ${vix} -- good conditions`;
    else if (vix < 25) vixDetail = `VIX elevated at ${vix} -- options getting expensive`;
    else if (vix < 30) vixDetail = `VIX high at ${vix} -- avoid new spreads`;
    else vixDetail = `VIX panic at ${vix} -- close all positions`;
  }
  checks.push({ label: "VIX below 20", passed: vixOk, detail: vixDetail });

  // 7. VIX direction
  const vixDirOk = vixChg1w !== null && vixChg1w < 0;
  let vixDirDetail = "VIX direction unavailable";
  if (vixChg1w !== null) {
    if (vixFallingFast) vixDirDetail = `VIX falling fast (${vixChg1w > 0 ? '+' : ''}${vixChg1w}) -- BEST TIME to buy spreads`;
    else if (vixChg1w < 0) vixDirDetail = `VIX falling (${vixChg1w}) -- favorable`;
    else if (vixSpiking) vixDirDetail = `VIX SPIKING (+${vixChg1w}) -- CLOSE spreads immediately`;
    else vixDirDetail = `VIX rising (+${vixChg1w}) -- caution`;
  }
  checks.push({ label: "VIX falling", passed: vixDirOk, detail: vixDirDetail });
  if (vixSpiking) alerts.push("VIX SPIKING -- close all bull spreads now");
  if (vixFallingFast) notes.push("VIX falling fast -- good entry window opening");

  // 8. QQQ direction
  let dirDetail: string, dirOk: boolean;
  if (sideways) { dirDetail = `QQQ sideways (${rangePct}% range) -- no direction`; dirOk = false; }
  else if (goingUp && e8 && e34 && e8 > e34) { dirDetail = `QQQ trending UP (${chg5d! >= 0 ? '+' : ''}${chg5d}% past 5d) -- bullish`; dirOk = true; }
  else if (!goingUp && e8 && e34 && e8 < e34) { dirDetail = `QQQ trending DOWN (${chg5d! >= 0 ? '+' : ''}${chg5d}% past 5d) -- bearish`; dirOk = false; }
  else if (goingUp) { dirDetail = `QQQ moving up (${chg5d! >= 0 ? '+' : ''}${chg5d}% past 5d) EMAs mixed`; dirOk = true; }
  else { dirDetail = `QQQ moving down (${chg5d! >= 0 ? '+' : ''}${chg5d}% past 5d) -- caution`; dirOk = false; }
  checks.push({ label: "QQQ trending up", passed: dirOk, detail: dirDetail });

  // 9. Extension
  const extended = distE34 !== null && distE34 > 5.0;
  const nearSupport = distE34 !== null && distE34 >= 0 && distE34 <= 3.0;
  checks.push({
    label: "QQQ not extended (within 5% of 34 EMA)", passed: !extended,
    detail: distE34 !== null ? `QQQ ${distE34 >= 0 ? '+' : ''}${distE34}% from 34 EMA -- ${nearSupport ? 'near support' : extended ? 'extended' : 'ok'}` : "N/A"
  });
  if (extended) notes.push("QQQ extended -- wait for pullback to 34 EMA");
  if (nearSupport) notes.push("QQQ near 34 EMA -- ideal entry zone");

  // 10. Volume
  const volOk = volRatio !== null && volRatio >= 1.0;
  checks.push({ label: "Volume confirming move", passed: volOk, detail: volRatio ? `Volume ${volRatio}x average -- ${volRatio >= 1.5 ? 'strong' : volOk ? 'normal' : 'weak'}` : "N/A" });
  if (volRatio && volRatio >= 2.0 && goingUp) notes.push(`HIGH VOLUME up day (${volRatio}x) -- institutional buying`);
  if (volRatio && volRatio >= 2.0 && !goingUp) notes.push(`HIGH VOLUME down day (${volRatio}x) -- institutional selling`);

  // 11. Pullback
  checks.push({ label: "No significant pullback", passed: !pullback, detail: pullback ? `Pullback ${dropPct}% from 20d high` : 'No pullback -- holding near highs' });

  // 12. Breadth
  const breadthOk = breadthPct !== null && breadthPct >= 60;
  checks.push({ label: "Market breadth > 60%", passed: breadthOk, detail: breadthPct !== null ? `${breadthPct}% sectors above 50 EMA -- ${breadthOk ? 'broad rally' : 'narrow market'}` : "N/A" });
  if (breadthPct !== null && breadthPct < 40) notes.push("Breadth very weak -- high risk environment");

  // Score
  const passedCount = checks.filter(c => c.passed).length;
  const total = checks.length;
  let bias: string;
  if (alerts.length) bias = "ALERT";
  else if (passedCount === total) bias = "STRONGLY BULLISH";
  else if (passedCount >= 9) bias = "BULLISH";
  else if (passedCount >= 7) bias = "CAUTIOUSLY BULLISH";
  else if (passedCount >= 5) bias = "MIXED -- wait";
  else if (passedCount >= 3) bias = "BEARISH";
  else bias = "STRONGLY BEARISH";

  return { bias, price, date, checks, notes, alerts };
}

// ─── FRED MACRO CALENDAR ───

const FRED_SERIES: Record<string, string> = {
  CPIAUCSL: "CPI", CPILFESL: "Core CPI", PCEPI: "PCE Price Index",
  PCEPILFE: "Core PCE", PPIFIS: "PPI Final Demand",
  PAYEMS: "Nonfarm Payrolls", UNRATE: "Unemployment Rate",
  ICSA: "Initial Jobless Claims", CCSA: "Continuing Claims",
  JTSJOL: "JOLTS Job Openings", GDP: "GDP", GDPC1: "Real GDP",
  INDPRO: "Industrial Production", TCU: "Capacity Utilization",
  RSAFS: "Retail Sales", UMCSENT: "U Mich Consumer Sentiment",
  HOUST: "Housing Starts", PERMIT: "Building Permits",
  EXHOSLUSM495S: "Existing Home Sales", HSN1F: "New Home Sales",
  BSCICP03USM665S: "ISM Manufacturing PMI", DGORDER: "Durable Goods Orders",
  BOPGSTB: "Trade Balance", PCEC96: "Real Personal Consumption",
  DSPIC96: "Real Disposable Income",
};

const HIGH_IMPACT = new Set([
  "PAYEMS", "UNRATE", "CPIAUCSL", "CPILFESL",
  "PCEPI", "PCEPILFE", "GDP", "GDPC1", "ICSA", "RSAFS", "PPIFIS"
]);

const RELEASE_TIMES: Record<string, string> = {
  PAYEMS: "8:30 AM EST", UNRATE: "8:30 AM EST",
  CPIAUCSL: "8:30 AM EST", CPILFESL: "8:30 AM EST",
  PCEPI: "8:30 AM EST", PCEPILFE: "8:30 AM EST",
  PPIFIS: "8:30 AM EST", ICSA: "8:30 AM EST",
  CCSA: "8:30 AM EST", RSAFS: "8:30 AM EST",
  DSPIC96: "8:30 AM EST", PCEC96: "8:30 AM EST",
  GDP: "8:30 AM EST", GDPC1: "8:30 AM EST",
  HOUST: "8:30 AM EST", PERMIT: "8:30 AM EST",
  BOPGSTB: "8:30 AM EST", DGORDER: "8:30 AM EST",
  INDPRO: "9:15 AM EST", TCU: "9:15 AM EST",
  UMCSENT: "10:00 AM EST", JTSJOL: "10:00 AM EST",
  EXHOSLUSM495S: "10:00 AM EST", HSN1F: "10:00 AM EST",
  BSCICP03USM665S: "10:00 AM EST",
};

const FOMC_DATES_2026 = [
  ["2026-01-28", "FOMC Rate Decision", "2:00 PM EST", "HIGH"],
  ["2026-01-28", "FOMC Press Conference", "2:30 PM EST", "HIGH"],
  ["2026-03-18", "FOMC Rate Decision", "2:00 PM EST", "HIGH"],
  ["2026-03-18", "FOMC Economic Projections", "2:00 PM EST", "HIGH"],
  ["2026-03-18", "FOMC Press Conference", "2:30 PM EST", "HIGH"],
  ["2026-05-06", "FOMC Rate Decision", "2:00 PM EST", "HIGH"],
  ["2026-05-06", "FOMC Press Conference", "2:30 PM EST", "HIGH"],
  ["2026-06-17", "FOMC Rate Decision", "2:00 PM EST", "HIGH"],
  ["2026-06-17", "FOMC Economic Projections", "2:00 PM EST", "HIGH"],
  ["2026-06-17", "FOMC Press Conference", "2:30 PM EST", "HIGH"],
  ["2026-07-29", "FOMC Rate Decision", "2:00 PM EST", "HIGH"],
  ["2026-07-29", "FOMC Press Conference", "2:30 PM EST", "HIGH"],
  ["2026-09-16", "FOMC Rate Decision", "2:00 PM EST", "HIGH"],
  ["2026-09-16", "FOMC Economic Projections", "2:00 PM EST", "HIGH"],
  ["2026-09-16", "FOMC Press Conference", "2:30 PM EST", "HIGH"],
  ["2026-10-28", "FOMC Rate Decision", "2:00 PM EST", "HIGH"],
  ["2026-10-28", "FOMC Press Conference", "2:30 PM EST", "HIGH"],
  ["2026-12-09", "FOMC Rate Decision", "2:00 PM EST", "HIGH"],
  ["2026-12-09", "FOMC Economic Projections", "2:00 PM EST", "HIGH"],
  ["2026-12-09", "FOMC Press Conference", "2:30 PM EST", "HIGH"],
];

async function fetchNextRelease(seriesId: string, fredKey: string, today: string, endDate: string): Promise<string | null> {
  try {
    const releaseRes = await fetch(`https://api.stlouisfed.org/fred/series/release?series_id=${seriesId}&api_key=${fredKey}&file_type=json`, { signal: AbortSignal.timeout(10000) });
    const releaseData = await releaseRes.json();
    const releases = releaseData.releases || [];
    if (!releases.length) return null;

    const datesRes = await fetch(`https://api.stlouisfed.org/fred/release/dates?release_id=${releases[0].id}&realtime_start=${today}&realtime_end=${endDate}&api_key=${fredKey}&file_type=json`, { signal: AbortSignal.timeout(10000) });
    const datesData = await datesRes.json();
    const dates = datesData.release_dates || [];
    for (const d of dates) {
      if (d.date >= today) return d.date;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchLatestValue(seriesId: string, fredKey: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${fredKey}&sort_order=desc&limit=2&file_type=json`, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    const obs = (data.observations || []).filter((o: any) => o.value !== ".");
    return obs.length ? obs[0].value : null;
  } catch {
    return null;
  }
}

interface CalendarEvent { time: string; name: string; impact: string; prev?: string }

async function buildCalendar(fredKey: string, daysAhead = 5): Promise<Record<string, CalendarEvent[]>> {
  const today = new Date();
  const todayStr = fmt_date(today);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + daysAhead);
  const endStr = fmt_date(endDate);

  const allEvents: Record<string, CalendarEvent[]> = {};

  function addEvent(dateStr: string, time: string, name: string, impact: string, prev?: string) {
    if (!allEvents[dateStr]) allEvents[dateStr] = [];
    allEvents[dateStr].push({ time, name, impact, prev });
  }

  // FOMC dates
  for (const [dateStr, name, time, impact] of FOMC_DATES_2026) {
    if (dateStr >= todayStr && dateStr <= endStr) {
      addEvent(dateStr, time, name, impact);
    }
  }

  // FRED series
  for (const [seriesId, seriesName] of Object.entries(FRED_SERIES)) {
    const releaseDate = await fetchNextRelease(seriesId, fredKey, todayStr, endStr);
    await sleep(100);
    if (releaseDate) {
      const prevVal = await fetchLatestValue(seriesId, fredKey);
      await sleep(100);
      addEvent(
        releaseDate,
        RELEASE_TIMES[seriesId] || "TBD",
        seriesName,
        HIGH_IMPACT.has(seriesId) ? "HIGH" : "MEDIUM",
        prevVal ? `Prev: ${prevVal}` : undefined
      );
    }
  }

  return allEvents;
}

// ─── EMAIL BUILDER ───

function buildEmailHTML(
  bias: { bias: string; price: number; date: string; checks: Check[]; notes: string[]; alerts: string[] },
  calendar: Record<string, CalendarEvent[]>
): string {
  const biasColor = bias.bias.includes("BULL") ? "#16a34a" : bias.bias.includes("BEAR") ? "#dc2626" : bias.bias === "ALERT" ? "#ea580c" : "#ca8a04";
  const passedCount = bias.checks.filter(c => c.passed).length;

  let checksHTML = bias.checks.map(c => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:${c.passed ? '#16a34a' : '#dc2626'};font-weight:bold;width:50px;">${c.passed ? 'PASS' : 'FAIL'}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;">${c.detail}</td>
    </tr>
  `).join('');

  let alertsHTML = '';
  if (bias.alerts.length) {
    alertsHTML = `
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin:16px 0;">
        <h3 style="color:#dc2626;margin:0 0 8px;">⚠️ ALERTS</h3>
        ${bias.alerts.map(a => `<p style="margin:4px 0;color:#991b1b;font-weight:bold;">*** ${a}</p>`).join('')}
      </div>
    `;
  }

  let notesHTML = '';
  if (bias.notes.length) {
    notesHTML = `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin:16px 0;">
        <h3 style="color:#2563eb;margin:0 0 8px;">📝 Notes</h3>
        ${bias.notes.map(n => `<p style="margin:4px 0;color:#1e40af;">→ ${n}</p>`).join('')}
      </div>
    `;
  }

  // Calendar section
  let calendarHTML = '';
  const sortedDates = Object.keys(calendar).sort();
  if (sortedDates.length) {
    const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    let calRows = '';
    for (const dateStr of sortedDates) {
      const d = new Date(dateStr + 'T12:00:00');
      const dayName = days[d.getDay()];
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const yr = String(d.getFullYear()).slice(2);
      const events = calendar[dateStr].sort((a, b) => a.time.localeCompare(b.time));

      calRows += `
        <tr><td colspan="3" style="padding:10px 10px 4px;font-weight:bold;color:#1f2937;font-size:14px;border-bottom:1px solid #d1d5db;">${dayName}, ${mm}/${dd}/${yr}</td></tr>
      `;
      for (const evt of events) {
        const marker = evt.impact === "HIGH" ? "🔴" : "🟡";
        calRows += `
          <tr>
            <td style="padding:3px 10px;font-size:12px;color:#6b7280;width:30px;">${marker}</td>
            <td style="padding:3px 10px;font-size:12px;color:#374151;width:120px;">${evt.time}</td>
            <td style="padding:3px 10px;font-size:12px;color:#374151;">${evt.name}${evt.prev ? ` | ${evt.prev}` : ''}</td>
          </tr>
        `;
      }
    }
    calendarHTML = `
      <h2 style="color:#1f2937;margin-top:32px;border-top:2px solid #e5e7eb;padding-top:20px;">📅 Upcoming Economic Events</h2>
      <table style="width:100%;border-collapse:collapse;">${calRows}</table>
    `;
  } else {
    calendarHTML = `<h2 style="color:#1f2937;margin-top:32px;border-top:2px solid #e5e7eb;padding-top:20px;">📅 No economic events in the next 5 days</h2>`;
  }

  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:700px;margin:0 auto;background:#ffffff;padding:24px;">
      <h1 style="color:#1f2937;margin:0;">📊 Daily Market Brief</h1>
      <p style="color:#6b7280;margin:4px 0 20px;">QQQ Market Bias | ${bias.date} | Price $${bias.price.toFixed(2)}</p>
      
      <div style="background:${biasColor};color:white;text-align:center;padding:16px;border-radius:8px;margin-bottom:20px;">
        <h2 style="margin:0;font-size:22px;">${bias.bias}</h2>
        <p style="margin:4px 0 0;opacity:0.9;">Score: ${passedCount}/${bias.checks.length}</p>
      </div>

      ${alertsHTML}

      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:8px 10px;text-align:left;font-size:12px;color:#6b7280;">Status</th>
            <th style="padding:8px 10px;text-align:left;font-size:12px;color:#6b7280;">Detail</th>
          </tr>
        </thead>
        <tbody>${checksHTML}</tbody>
      </table>

      ${notesHTML}
      ${calendarHTML}

      <p style="color:#9ca3af;font-size:11px;margin-top:32px;text-align:center;">
        MyStockData Daily Market Brief — Automated report
      </p>
    </div>
  `;
}

// ─── HANDLER ───

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const POLYGON_API_KEY = Deno.env.get('POLYGON_API_KEY');
    const FRED_API_KEY = Deno.env.get('FRED_API_KEY');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!POLYGON_API_KEY || !FRED_API_KEY || !RESEND_API_KEY) {
      throw new Error('Missing required API keys');
    }

    const resend = new Resend(RESEND_API_KEY);
    const EMAIL_RECEIVERS = ["dhiraj.gautam@gmail.com", "fidalaqani@gmail.com"];

    console.log('Starting daily market email...');

    // Run market bias
    const biasResult = await runMarketBias(POLYGON_API_KEY);
    console.log(`Market bias: ${biasResult.bias} (${biasResult.checks.filter(c => c.passed).length}/${biasResult.checks.length})`);

    // Build macro calendar
    const calendar = await buildCalendar(FRED_API_KEY, 5);
    console.log(`Calendar events: ${Object.keys(calendar).length} days`);

    // Build and send email
    const html = buildEmailHTML(biasResult, calendar);

    const emailResponse = await resend.emails.send({
      from: "MyStockData <onboarding@resend.dev>",
      to: [EMAIL_RECEIVER],
      subject: `📊 Daily Market Brief | ${biasResult.bias} | QQQ $${biasResult.price.toFixed(2)}`,
      html,
    });

    console.log('Daily market email sent:', emailResponse);

    return new Response(JSON.stringify({ success: true, bias: biasResult.bias, emailResponse }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Daily market email error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
