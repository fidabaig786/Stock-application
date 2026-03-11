// v7 - MACD params 5/13/5, crossover detection in last 8 weeks
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Retry utility (matches stock-analysis) ───

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

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
      console.log(`Retrying fetch (${attempt + 1}/${retries}): ${err}`);
      await sleep(wait);
      attempt++;
    }
  }
  throw lastErr;
}

// ─── Indicator Helpers ───

function calcEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

// Local RSI for chart candles (fallback, since Polygon RSI timestamps may not align with candle timestamps)
function calcRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return rsi;

  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return rsi;
}

// Unified MACD logic: EWM with span fast=5, slow=13, signal=5
function calcPandasEWM(data: number[], span: number): number[] {
  if (data.length === 0) return [];
  const alpha = 2 / (span + 1);
  const result = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(alpha * data[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
}

function calcLocalMACD(closes: number[]): { macdLine: number[]; signalLine: number[]; histogram: number[] } {
  const emaFast = calcPandasEWM(closes, 5);
  const emaSlow = calcPandasEWM(closes, 13);
  const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
  const signalLine = calcPandasEWM(macdLine, 5);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { macdLine, signalLine, histogram };
}

// ─── Local Weekly MACD (1100 days history, EWM 5/13/5, crossover in last 8 weeks) ───

async function fetchAndCalcMACD(ticker: string, apiKey: string): Promise<{ crossover: string }> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1100);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/week/${startStr}/${endStr}?adjusted=true&sort=asc&limit=500&apikey=${apiKey}`;
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      console.error(`Polygon weekly data error for MACD ${ticker}: ${res.status}`);
      return { crossover: 'N/A' };
    }
    const data = await res.json();
    if (data.status !== "OK" && data.status !== "DELAYED") {
      return { crossover: 'N/A' };
    }
    if (!data.results || data.results.length < 14) {
      return { crossover: 'N/A' };
    }

    const bars = data.results;
    const closes: number[] = bars.map((r: any) => r.c);
    const emaFast = calcPandasEWM(closes, 5);
    const emaSlow = calcPandasEWM(closes, 13);
    const macdLine = emaFast.map((v: number, i: number) => v - emaSlow[i]);
    const signalLine = calcPandasEWM(macdLine, 5);

    // Detect crossovers in the last 8 weeks
    const n = macdLine.length;
    const lookback = Math.min(8, n - 1);
    let lastCrossover = 'N/A';

    // Check from most recent going back to find the latest crossover
    for (let i = n - 1; i >= n - lookback && i >= 1; i--) {
      const prevMacd = macdLine[i - 1];
      const prevSignal = signalLine[i - 1];
      const currMacd = macdLine[i];
      const currSignal = signalLine[i];

      if (prevMacd < prevSignal && currMacd >= currSignal) {
        lastCrossover = 'Bullish';
        const crossDate = new Date(bars[i].t).toISOString().split('T')[0];
        console.log(`[MATRIX-MACD] ${ticker} date=${crossDate} BULLISH CROSS MACD=${currMacd.toFixed(4)} Signal=${currSignal.toFixed(4)}`);
        break;
      } else if (prevMacd > prevSignal && currMacd < currSignal) {
        lastCrossover = 'Bearish';
        const crossDate = new Date(bars[i].t).toISOString().split('T')[0];
        console.log(`[MATRIX-MACD] ${ticker} date=${crossDate} BEARISH CROSS MACD=${currMacd.toFixed(4)} Signal=${currSignal.toFixed(4)}`);
        break;
      }
    }

    // If no crossover in last 8 weeks, use current position
    if (lastCrossover === 'N/A') {
      const isBullish = macdLine[n - 1] >= signalLine[n - 1];
      lastCrossover = isBullish ? 'Bullish' : 'Bearish';
      const latestDate = new Date(bars[n - 1].t).toISOString().split('T')[0];
      console.log(`[MATRIX-MACD] ${ticker} date=${latestDate} NO CROSS, current: MACD=${macdLine[n-1].toFixed(4)} Signal=${signalLine[n-1].toFixed(4)} => ${lastCrossover}`);
    }

    return { crossover: lastCrossover };
  } catch (e) {
    console.error(`Error calculating MACD for ${ticker}:`, e);
    return { crossover: 'N/A' };
  }
}

// ─── RRG Helpers ───

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

// ─── Polygon Fetch ───

async function fetchWeeklyData(ticker: string, apiKey: string): Promise<{
  closes: number[];
  highs: number[];
  lows: number[];
  opens: number[];
  timestamps: number[];
} | null> {
  const to = new Date();
  const from = new Date();
  from.setFullYear(from.getFullYear() - 2);

  const fromStr = from.toISOString().split('T')[0];
  const toStr = to.toISOString().split('T')[0];

  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/week/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=50000&apikey=${apiKey}`;

  try {
    console.log(`Fetching weekly data for ${ticker}: ${fromStr} to ${toStr}`);
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      const body = await res.text();
      console.error(`Polygon API error for ${ticker}: ${res.status} - ${body}`);
      return null;
    }
    const data = await res.json();
    if (!data?.results || data.results.length < 30) {
      console.error(`Insufficient weekly data for ${ticker}: ${data?.results?.length || 0} bars`);
      return null;
    }

    const lastTs = data.results[data.results.length - 1].t;
    console.log(`${ticker}: got ${data.results.length} bars, latest: ${new Date(lastTs).toISOString().split('T')[0]}`);

    return {
      closes: data.results.map((r: any) => r.c),
      highs: data.results.map((r: any) => r.h),
      lows: data.results.map((r: any) => r.l),
      opens: data.results.map((r: any) => r.o),
      timestamps: data.results.map((r: any) => r.t),
    };
  } catch (e) {
    console.error(`Error fetching weekly data for ${ticker}:`, e);
    return null;
  }
}

// ─── Polygon RSI Fetch ───

async function fetchPolygonRSI(ticker: string, apiKey: string): Promise<{ values: { value: number; timestamp: number }[] } | null> {
  const url = `https://api.polygon.io/v1/indicators/rsi/${ticker}?timespan=week&adjusted=true&window=14&series_type=close&order=desc&limit=52&apikey=${apiKey}`;
  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      console.error(`Polygon RSI API error for ${ticker}: ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (!data?.results?.values || data.results.values.length === 0) {
      console.error(`No RSI data for ${ticker}`);
      return null;
    }
    return { values: data.results.values };
  } catch (e) {
    console.error(`Error fetching RSI for ${ticker}:`, e);
    return null;
  }
}

// ─── Local Weekly EMA Crossover (1100 days history, EWM 8/21, crossover in last 40 weeks) ───

async function fetchAndCalcEMA(ticker: string, apiKey: string): Promise<{ crossover: string }> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1100);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/week/${startStr}/${endStr}?adjusted=true&sort=asc&limit=500&apikey=${apiKey}`;
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      console.error(`Polygon weekly data error for EMA ${ticker}: ${res.status}`);
      return { crossover: 'N/A' };
    }
    const data = await res.json();
    if (data.status !== "OK" && data.status !== "DELAYED") {
      return { crossover: 'N/A' };
    }
    if (!data.results || data.results.length < 22) {
      return { crossover: 'N/A' };
    }

    const bars = data.results;
    const closes: number[] = bars.map((r: any) => r.c);
    const ema8 = calcPandasEWM(closes, 8);
    const ema21 = calcPandasEWM(closes, 21);

    const n = closes.length;

    // Detect crossovers in last 40 weeks
    const lookback = Math.min(40, n - 1);
    let lastCrossover = 'N/A';

    for (let i = n - 1; i >= n - lookback && i >= 1; i--) {
      const prevEma8 = ema8[i - 1];
      const prevEma21 = ema21[i - 1];
      const currEma8 = ema8[i];
      const currEma21 = ema21[i];

      if (prevEma8 < prevEma21 && currEma8 >= currEma21) {
        lastCrossover = 'Bullish';
        const crossDate = new Date(bars[i].t).toISOString().split('T')[0];
        console.log(`[MATRIX-EMA] ${ticker} date=${crossDate} BULLISH CROSS EMA8=${currEma8.toFixed(4)} EMA21=${currEma21.toFixed(4)}`);
        break;
      } else if (prevEma8 > prevEma21 && currEma8 < currEma21) {
        lastCrossover = 'Bearish';
        const crossDate = new Date(bars[i].t).toISOString().split('T')[0];
        console.log(`[MATRIX-EMA] ${ticker} date=${crossDate} BEARISH CROSS EMA8=${currEma8.toFixed(4)} EMA21=${currEma21.toFixed(4)}`);
        break;
      }
    }

    // If no crossover found, use current position
    if (lastCrossover === 'N/A') {
      const isBullish = ema8[n - 1] >= ema21[n - 1];
      lastCrossover = isBullish ? 'Bullish' : 'Bearish';
      const latestDate = new Date(bars[n - 1].t).toISOString().split('T')[0];
      console.log(`[MATRIX-EMA] ${ticker} date=${latestDate} NO CROSS, current: EMA8=${ema8[n-1].toFixed(4)} EMA21=${ema21[n-1].toFixed(4)} => ${lastCrossover}`);
    }

    return { crossover: lastCrossover };
  } catch (e) {
    console.error(`Error calculating EMA for ${ticker}:`, e);
    return { crossover: 'N/A' };
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
    console.log(`[v6] weekly-technical-matrix invoked at ${new Date().toISOString()}, apiKey present: ${!!apiKey}, tickers: ${JSON.stringify(tickers)}`);

    if (!apiKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      throw new Error('tickers array is required');
    }

    // Always include SPY as benchmark
    const allTickers = Array.from(new Set(['SPY', ...tickers.map((t: string) => t.toUpperCase())]));

    // Process tickers sequentially to avoid Polygon rate limits (matches stock-analysis approach)
    const dataMap: Record<string, Awaited<ReturnType<typeof fetchWeeklyData>>> = {};
    const rsiMap: Record<string, Awaited<ReturnType<typeof fetchPolygonRSI>>> = {};
    const ema8Map: Record<string, number | null> = {};
    const ema21Map: Record<string, number | null> = {};
    const macdMap: Record<string, { crossover: string }> = {};
    
    for (const ticker of allTickers) {
      const [weeklyData, rsiData, ema8Val, ema21Val, macdData] = await Promise.all([
        fetchWeeklyData(ticker, apiKey),
        fetchPolygonRSI(ticker, apiKey),
        fetchPolygonEMA(ticker, apiKey, 8),
        fetchPolygonEMA(ticker, apiKey, 21),
        fetchAndCalcMACD(ticker, apiKey),
      ]);
      dataMap[ticker] = weeklyData;
      rsiMap[ticker] = rsiData;
      ema8Map[ticker] = ema8Val;
      ema21Map[ticker] = ema21Val;
      macdMap[ticker] = macdData;
      // Small delay between tickers to respect rate limits
      await sleep(200);
    }

    const spyData = dataMap['SPY'];
    if (!spyData) {
      throw new Error('Unable to fetch SPY benchmark data');
    }

    const results: any[] = [];

    for (const ticker of allTickers) {
      const data = dataMap[ticker];
      if (!data) {
        results.push({
          ticker,
          error: 'Unable to fetch data',
          rsi: null,
          rsiLabel: null,
          emaCrossover: null,
          macdSignal: null,
          rrgQuadrant: null,
          burst: null,
          currentPrice: null,
          weeklyCandles: [],
        });
        continue;
      }

      const { closes, highs, lows, opens, timestamps } = data;

      // RSI(14) from Polygon API (for table display - authoritative value)
      const polygonRsi = rsiMap[ticker];
      const rsiValue = polygonRsi?.values?.[0]?.value ?? NaN;
      const rsiLabel = isNaN(rsiValue) ? 'N/A' : rsiValue > 70 ? 'Overbought' : rsiValue < 30 ? 'Oversold' : 'Neutral';
      
      // Local RSI calculation for chart candles
      const rsiArr = calcRSI(closes, 14);

      // EMA 8 × EMA 21 crossover (from Polygon API - stock EMA logic)
      const ema8Val = ema8Map[ticker];
      const ema21Val = ema21Map[ticker];
      let emaCrossover = 'N/A';
      if (ema8Val != null && ema21Val != null) {
        emaCrossover = ema8Val > ema21Val ? 'Bullish' : 'Bearish';
      }

      // Local EMA for chart candles
      const ema8 = calcEMA(closes, 8);
      const ema21 = calcEMA(closes, 21);

      // MACD (5/13/5 weekly close)
      const macdSignal = macdMap[ticker]?.crossover ?? 'N/A';
      // Local MACD for chart candles (5/13/5 params)
      const { macdLine, signalLine, histogram } = calcLocalMACD(closes);

      // RRG – align by timestamp to avoid mismatched weeks
      let rrgQuadrant = 'N/A';
      let rrgTrail: { rsRatio: number; rsMomentum: number; date: string }[] = [];
      if (ticker === 'SPY') {
        rrgQuadrant = 'Benchmark';
        rrgTrail = [{ rsRatio: 100, rsMomentum: 100, date: new Date(timestamps[timestamps.length - 1]).toISOString().split('T')[0] }];
      } else {
        // Build a set of timestamps present in both series
        const spyTsSet = new Set(spyData.timestamps);
        const alignedTickerCloses: number[] = [];
        const alignedSpyCloses: number[] = [];
        const alignedTimestamps: number[] = [];

        const spyTsMap = new Map<number, number>();
        spyData.timestamps.forEach((ts, idx) => spyTsMap.set(ts, idx));

        timestamps.forEach((ts, idx) => {
          const spyIdx = spyTsMap.get(ts);
          if (spyIdx !== undefined) {
            alignedTickerCloses.push(closes[idx]);
            alignedSpyCloses.push(spyData.closes[spyIdx]);
            alignedTimestamps.push(ts);
          }
        });

        if (alignedTickerCloses.length >= 30) {
          const rsRatio = calcRSRatio(alignedTickerCloses, alignedSpyCloses, 10);
          const rsMomentum = calcRSMomentum(rsRatio, 10);

          rrgQuadrant = getRRGQuadrant(
            rsRatio[rsRatio.length - 1],
            rsMomentum[rsMomentum.length - 1]
          );

          const trailLen = Math.min(12, rsRatio.length);
          for (let j = rsRatio.length - trailLen; j < rsRatio.length; j++) {
            if (!isNaN(rsRatio[j]) && !isNaN(rsMomentum[j])) {
              rrgTrail.push({
                rsRatio: parseFloat(rsRatio[j].toFixed(4)),
                rsMomentum: parseFloat(rsMomentum[j].toFixed(4)),
                date: new Date(alignedTimestamps[j]).toISOString().split('T')[0],
              });
            }
          }
        }
      }

      // Build last 52 weeks of candle data for charting
      const candleCount = Math.min(52, closes.length);
      const weeklyCandles = [];
      for (let i = closes.length - candleCount; i < closes.length; i++) {
        weeklyCandles.push({
          date: new Date(timestamps[i]).toISOString().split('T')[0],
          open: opens[i],
          high: highs[i],
          low: lows[i],
          close: closes[i],
          ema8: ema8[i],
          ema21: ema21[i],
          macd: macdLine[i],
          signal: signalLine[i],
          histogram: histogram[i],
          rsi: rsiArr[i],
        });
      }

      results.push({
        ticker,
        currentPrice: closes[closes.length - 1],
        rsi: isNaN(rsiValue) ? null : parseFloat(rsiValue.toFixed(2)),
        rsiLabel,
        emaCrossover,
        macdSignal,
        rrgQuadrant,
        rrgTrail,
        burst: null, // Burst removed from matrix
        weeklyCandles,
      });
    }

    return new Response(
      JSON.stringify({ results }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in weekly-technical-matrix:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
