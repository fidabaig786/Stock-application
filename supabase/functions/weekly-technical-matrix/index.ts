import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Indicator Helpers ───

function calcEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

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

function calcMACD(closes: number[]) {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calcEMA(macdLine, 9);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { macdLine, signalLine, histogram };
}

// ─── RRG Helpers ───

function calcRSRatio(tickerCloses: number[], benchmarkCloses: number[], period = 10): number[] {
  // Relative strength = ticker / benchmark * 100
  const rs = tickerCloses.map((v, i) => (v / benchmarkCloses[i]) * 100);
  // RS-Ratio is the EMA of the relative strength, normalized around 100
  const rsRatio = calcEMA(rs, period);
  // Normalize around 100: scale so mean ~ 100
  const mean = rsRatio.reduce((a, b) => a + b, 0) / rsRatio.length;
  return rsRatio.map(v => (v / mean) * 100);
}

function calcRSMomentum(rsRatio: number[], period = 10): number[] {
  // RS-Momentum = rate of change of RS-Ratio, normalized around 100
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

// ─── Burst Logic ───

function calcBurst(closes: number[], highs: number[]): boolean {
  if (closes.length < 21) return false;
  
  const currentClose = closes[closes.length - 1];
  
  // 20-week high (excluding current week)
  const prev20Highs = highs.slice(-21, -1);
  const twentyWeekHigh = Math.max(...prev20Highs);
  
  // Average weekly move (absolute) over last 20 weeks
  const weeklyMoves: number[] = [];
  for (let i = closes.length - 20; i < closes.length; i++) {
    weeklyMoves.push(Math.abs(closes[i] - closes[i - 1]));
  }
  const avgMove = weeklyMoves.reduce((a, b) => a + b, 0) / weeklyMoves.length;
  
  const currentMove = Math.abs(closes[closes.length - 1] - closes[closes.length - 2]);
  
  return currentClose > twentyWeekHigh && currentMove > 2 * avgMove;
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
  from.setFullYear(from.getFullYear() - 2); // 2 years for enough weekly data

  const fromStr = from.toISOString().split('T')[0];
  const toStr = to.toISOString().split('T')[0];

  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/week/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=200&apiKey=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Polygon API error for ${ticker}: ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (!data?.results || data.results.length < 30) {
      console.error(`Insufficient weekly data for ${ticker}: ${data?.results?.length || 0} bars`);
      return null;
    }

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

// ─── Main Handler ───

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

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      throw new Error('tickers array is required');
    }

    // Always include SPY as benchmark
    const allTickers = Array.from(new Set(['SPY', ...tickers.map((t: string) => t.toUpperCase())]));

    // Fetch all weekly data
    const dataMap: Record<string, Awaited<ReturnType<typeof fetchWeeklyData>>> = {};
    for (const ticker of allTickers) {
      dataMap[ticker] = await fetchWeeklyData(ticker, apiKey);
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

      // RSI(14)
      const rsiArr = calcRSI(closes, 14);
      const rsiValue = rsiArr[rsiArr.length - 1];
      const rsiLabel = isNaN(rsiValue) ? 'N/A' : rsiValue > 70 ? 'Overbought' : rsiValue < 30 ? 'Oversold' : 'Neutral';

      // EMA 8 × EMA 21 crossover
      const ema8 = calcEMA(closes, 8);
      const ema21 = calcEMA(closes, 21);
      const emaCrossover = ema8[ema8.length - 1] > ema21[ema21.length - 1] ? 'Bullish' : 'Bearish';

      // MACD
      const { macdLine, signalLine, histogram } = calcMACD(closes);
      const macdSignal = macdLine[macdLine.length - 1] > signalLine[signalLine.length - 1] ? 'Bullish' : 'Bearish';

      // RRG
      let rrgQuadrant = 'N/A';
      if (ticker === 'SPY') {
        rrgQuadrant = 'Benchmark';
      } else {
        // Align lengths
        const minLen = Math.min(closes.length, spyData.closes.length);
        const tickerSlice = closes.slice(-minLen);
        const spySlice = spyData.closes.slice(-minLen);

        const rsRatio = calcRSRatio(tickerSlice, spySlice, 10);
        const rsMomentum = calcRSMomentum(rsRatio, 10);

        rrgQuadrant = getRRGQuadrant(
          rsRatio[rsRatio.length - 1],
          rsMomentum[rsMomentum.length - 1]
        );
      }

      // Burst
      const isBurst = calcBurst(closes, highs);

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
        burst: isBurst,
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
