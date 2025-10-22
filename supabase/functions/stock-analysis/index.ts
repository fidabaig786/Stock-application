import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Retry utilities to stabilize external API calls
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3, backoffMs = 300): Promise<Response> {
  let attempt = 0;
  let lastErr: any;
  while (attempt <= retries) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      // Retry on rate limits and server errors
      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res; // do not retry on other non-OK statuses
    } catch (err) {
      lastErr = err;
      if (attempt === retries) throw err;
      const wait = backoffMs * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
      console.log(`Retrying fetch (${attempt + 1}/${retries}) for ${url}: ${err}`);
      await sleep(wait);
      attempt++;
    }
  }
  throw lastErr;
}

function getStableEndDate(): string {
  const d = new Date();
  if (d.getDay() === 0) d.setDate(d.getDate() - 2); // Sunday -> Friday
  if (d.getDay() === 6) d.setDate(d.getDate() - 1); // Saturday -> Friday
  return d.toISOString().split('T')[0];
}

interface AnalysisRequest {
  watchlist: Array<{
    ticker: string;
    assetType: 'Stock' | 'Option';
  }>;
  criteria: {
    mrt: boolean;
    rsiConfirmation: boolean;
    dmiConfirmation: boolean;
    emaCrossover: boolean;
    macdCrossover: boolean;
    weeklyMacd: boolean;
    burst: boolean;
  };
}

interface AnalysisResult {
  ticker: string;
  assetType: string;
  currentPrice: string;
  mrt: string;
  rsiConfirmation: string;
  macdCrossover: string;
  weeklyMacd: string;
  dmiConfirmation: string;
  emaCrossover: string;
  burst: string;
  passed: boolean;
}

async function validatePolygonApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetchWithRetry(`https://api.polygon.io/v3/reference/tickers?active=true&limit=1&apikey=${apiKey}`);
    return response.ok;
  } catch (error) {
    console.error('API key validation error:', error);
    return false;
  }
}

async function fetchStockData(ticker: string, apiKey: string, assetType: string = 'Stock') {
  try {
    // Use consistent date for reproducible results - last business day
    const baseDate = new Date();
    // If it's weekend, go to Friday
    if (baseDate.getDay() === 0) baseDate.setDate(baseDate.getDate() - 2); // Sunday -> Friday
    if (baseDate.getDay() === 6) baseDate.setDate(baseDate.getDate() - 1); // Saturday -> Friday
    
    const endDate = baseDate.toISOString().split('T')[0];
    
    // Fetch current/latest price - use daily data instead of minute data for consistency
    const priceResponse = await fetchWithRetry(
      `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${endDate}/${endDate}?adjusted=true&sort=desc&limit=1&apikey=${apiKey}`
    );
    const priceData = await priceResponse.json();
    
    // Fetch historical data for analysis - use fixed periods from the base date
    const daysBack = assetType === 'Option' ? 30 : 60;
    const historicalStartDate = new Date(baseDate.getTime() - (daysBack * 24 * 60 * 60 * 1000));
    
    const historicalResponse = await fetchWithRetry(
      `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${historicalStartDate.toISOString().split('T')[0]}/${endDate}?adjusted=true&sort=asc&limit=250&apikey=${apiKey}`
    );
    const historicalData = await historicalResponse.json();
    
    return {
      price: priceData.results?.[0]?.c || 0,
      historicalData: historicalData.results || []
    };
  } catch (error) {
    console.error(`Error fetching data for ${ticker}:`, error);
    return { price: 0, historicalData: [] };
  }
}

async function calculateRSI(ticker: string, apiKey: string): Promise<{ value: number; status: string }> {
  try {
    const endDate = getStableEndDate();
    const rsiResponse = await fetchWithRetry(
      `https://api.polygon.io/v1/indicators/rsi/${ticker}?timestamp.gte=2024-01-01&timestamp.lte=${endDate}&timespan=day&adjusted=true&window=14&series_type=close&order=desc&limit=5&apikey=${apiKey}`
    );
    const rsiData = await rsiResponse.json();
    
    if (!rsiData.results || !rsiData.results.values || rsiData.results.values.length === 0) {
      return { value: 0, status: "❌ No RSI data available" };
    }
    
    // Get the latest RSI value
    const latestRSI = rsiData.results.values[0].value;
    
    return {
      value: latestRSI,
      status: (latestRSI >= 30 && latestRSI <= 70) 
        ? `✅ RSI is in favorable range (${latestRSI.toFixed(2)})` 
        : `❌ RSI outside favorable range (${latestRSI.toFixed(2)})`
    };
  } catch (error) {
    console.error(`Error fetching RSI for ${ticker}:`, error);
    return { value: 0, status: "❌ Error fetching RSI data" };
  }
}

async function calculateDailyMACD(ticker: string, apiKey: string): Promise<{ status: string; crossover: boolean }> {
  try {
    // Use Polygon's built-in MACD endpoint for daily data
    const endDate = getStableEndDate();
    
    const url = `https://api.polygon.io/v1/indicators/macd/${ticker}?timestamp.gte=2024-01-01&timestamp.lte=${endDate}&timespan=day&adjusted=true&short_window=5&long_window=13&signal_window=5&series_type=close&order=desc&limit=2&apikey=${apiKey}`;

    const response = await fetchWithRetry(url);
    const data = await response.json();

    if (data.status !== "OK" || !data.results) {
      return { status: "❌ Polygon API error", crossover: false };
    }

    if (!data.results.values || data.results.values.length < 1) {
      return { status: "❌ No daily MACD data available", crossover: false };
    }

    // Get the latest MACD values
    const latest = data.results.values[0];
    const macdValue = latest.value;
    const signalValue = latest.signal;

    // Simple bullish/bearish determination based on MACD >= Signal
    const isBullish = macdValue >= signalValue;
    const status = isBullish
      ? "✅ Bullish (MACD >= Signal)"
      : "❌ Bearish (MACD < Signal)";

    console.log(`${ticker} - dailyMacd (Option): ${status} (MACD: ${macdValue.toFixed(6)}, Signal: ${signalValue.toFixed(6)})`);
    return { status, crossover: isBullish };
  } catch (error) {
    console.error(`Daily MACD calculation error for ${ticker}:`, error);
    return { status: "❌ Error calculating daily MACD", crossover: false };
  }
}

function calculateMACD(data: any[], assetType: string): { status: string; crossover: boolean } {
  // Need at least 13 periods for slow EMA calculation
  if (data.length < 13) return { status: "❌ Insufficient data for MACD", crossover: false };
  
  const closes = data.map((d: any) => d.c);
  
  // Calculate MACD with parameters: fast=5, slow=13, signal=5
  const emaFast = calculatePandasEWM(closes, 5);
  const emaSlow = calculatePandasEWM(closes, 13);
  
  if (emaFast.length === 0 || emaSlow.length === 0) {
    return { status: "❌ EMA calculation failed", crossover: false };
  }
  
  const macdValues = emaFast.map((fast, i) => fast - emaSlow[i]);
  
  // Calculate signal line using EWM with span=5
  const signalValues = calculatePandasEWM(macdValues, 5);
  
  if (macdValues.length < 2 || signalValues.length < 2) {
    return { status: "❌ Insufficient data for crossover detection", crossover: false };
  }
  
  // For stocks, keep existing crossover detection logic
  // Create MACD_Above array to detect crossovers
  const macdAbove = macdValues.map((macd, i) => macd > signalValues[i]);
  
  // Find the latest crossover in the data
  let latestCrossoverIndex = -1;
  for (let i = 1; i < macdAbove.length; i++) {
    if (macdAbove[i] !== macdAbove[i - 1]) {
      latestCrossoverIndex = i;
    }
  }
  
  if (latestCrossoverIndex === -1) {
    return { status: "❌ No crossovers in the given period", crossover: false };
  }
  
  const crossoverMACD = macdValues[latestCrossoverIndex];
  const crossoverSignal = signalValues[latestCrossoverIndex];
  
  let status: string;
  let crossover = true; // Any crossover (bullish or bearish) counts as pass
  
  if (crossoverMACD > crossoverSignal) {
    status = "✅ MACD crossed ABOVE Signal line (Bullish)";
  } else {
    status = "✅ MACD crossed BELOW Signal line (Bearish)";
  }
  
  return { status, crossover };
}

function calculateEMA(data: number[], period: number): number {
  if (data.length === 0) return 0;
  
  const multiplier = 2 / (period + 1);
  let ema = data[0];
  
  for (let i = 1; i < data.length; i++) {
    ema = (data[i] * multiplier) + (ema * (1 - multiplier));
  }
  
  return ema;
}

async function calculateWeeklyMACD(ticker: string, apiKey: string, assetType: string): Promise<{ status: string; crossover: boolean }> {
  try {
    // Use Polygon's built-in MACD endpoint for weekly data
    const endDate = getStableEndDate();
    
    const url = `https://api.polygon.io/v1/indicators/macd/${ticker}?timestamp.gte=2024-01-01&timestamp.lte=${endDate}&timespan=week&adjusted=true&short_window=19&long_window=39&signal_window=9&series_type=close&order=desc&limit=2&apikey=${apiKey}`;

    const response = await fetchWithRetry(url);
    const data = await response.json();

    if (data.status !== "OK" && data.status !== "DELAYED") {
      return { status: "❌ Polygon API error", crossover: false };
    }

    if (!data.results || !data.results.values || data.results.values.length < 1) {
      return { status: "❌ No weekly MACD data available", crossover: false };
    }

    // Get the latest MACD values
    const latest = data.results.values[0];
    const macdValue = latest.value;
    const signalValue = latest.signal;

    // Simple bullish/bearish determination based on MACD >= Signal
    const isBullish = macdValue >= signalValue;
    const status = isBullish
      ? "✅ Bullish (MACD >= Signal)"
      : "❌ Bearish (MACD < Signal)";

    console.log(`${ticker} - weeklyMacd (${assetType}): ${status} (MACD: ${macdValue.toFixed(6)}, Signal: ${signalValue.toFixed(6)})`);
    return { status, crossover: isBullish };
  } catch (error) {
    console.error(`Weekly MACD calculation error for ${ticker}:`, error);
    return { status: "❌ Weekly MACD calculation error", crossover: false };
  }
}

// Pandas ewm equivalent function (adjust=False)
function calculatePandasEWM(data: number[], span: number): number[] {
  if (data.length === 0) return [];
  
  const alpha = 2 / (span + 1);
  const result = [data[0]]; // First value is the seed
  
  for (let i = 1; i < data.length; i++) {
    const ewm = alpha * data[i] + (1 - alpha) * result[i - 1];
    result.push(ewm);
  }
  
  return result;
}

// EWM calculation similar to pandas ewm(span=X, adjust=False).mean()
function calculateEWM(data: number[], span: number): number[] {
  if (data.length === 0) return [];
  
  const alpha = 2 / (span + 1);
  const result = [data[0]]; // First value is the seed
  
  for (let i = 1; i < data.length; i++) {
    const ewm = alpha * data[i] + (1 - alpha) * result[i - 1];
    result.push(ewm);
  }
  
  return result;
}

async function calculateEMACrossover(ticker: string, apiKey: string): Promise<{ status: string; crossover: boolean }> {
  try {
    const endDate = getStableEndDate();
    
    // Get EMA_8 value using Polygon's built-in EMA endpoint
    const ema8Url = `https://api.polygon.io/v1/indicators/ema/${ticker}?timestamp.gte=2024-01-01&timestamp.lte=${endDate}&timespan=week&adjusted=true&window=8&series_type=close&order=desc&limit=1&apikey=${apiKey}`;
    
    // Get EMA_21 value using Polygon's built-in EMA endpoint  
    const ema21Url = `https://api.polygon.io/v1/indicators/ema/${ticker}?timestamp.gte=2024-01-01&timestamp.lte=${endDate}&timespan=week&adjusted=true&window=21&series_type=close&order=desc&limit=1&apikey=${apiKey}`;

    const [ema8Response, ema21Response] = await Promise.all([
      fetchWithRetry(ema8Url),
      fetchWithRetry(ema21Url)
    ]);

    const ema8Data = await ema8Response.json();
    const ema21Data = await ema21Response.json();

    if (ema8Data.status !== "OK" && ema8Data.status !== "DELAYED") {
      return { status: "❌ EMA_8 API error", crossover: false };
    }

    if (ema21Data.status !== "OK" && ema21Data.status !== "DELAYED") {
      return { status: "❌ EMA_21 API error", crossover: false };
    }

    if (!ema8Data.results?.values?.length || !ema21Data.results?.values?.length) {
      return { status: "❌ No EMA data available", crossover: false };
    }

    const ema8 = ema8Data.results.values[0];
    const ema21 = ema21Data.results.values[0];

    // Check if both EMAs are from the same timestamp, use more recent if different
    const ema8Timestamp = ema8.timestamp;
    const ema21Timestamp = ema21.timestamp;
    const latestTimestamp = Math.max(ema8Timestamp, ema21Timestamp);

    if (ema8Timestamp !== ema21Timestamp) {
      console.log(`Warning: EMA timestamps don't match for ${ticker}. Using latest available data.`);
    }

    const ema8Value = ema8.value;
    const ema21Value = ema21.value;
    const difference = ema8Value - ema21Value;

    // Determine bullish or bearish based on EMA_8 > EMA_21
    const isBullish = ema8Value > ema21Value;
    const status = isBullish
      ? "✅ Bullish (EMA_8 > EMA_21)"
      : "❌ Bearish (EMA_8 <= EMA_21)";

    console.log(`${ticker} - EMA Crossover: ${status} (EMA_8: ${ema8Value.toFixed(2)}, EMA_21: ${ema21Value.toFixed(2)}, Diff: ${difference.toFixed(2)})`);
    
    return { status, crossover: isBullish };
  } catch (error) {
    console.error(`EMA crossover calculation error for ${ticker}:`, error);
    return { status: "❌ EMA crossover calculation error", crossover: false };
  }
}

async function calculateDailyEMACrossover(ticker: string, apiKey: string): Promise<{ status: string; crossover: boolean }> {
  try {
    const endDate = getStableEndDate();
    
    // Get EMA_8 value using Polygon's built-in EMA endpoint for daily data
    const ema8Url = `https://api.polygon.io/v1/indicators/ema/${ticker}?timestamp.gte=2024-01-01&timestamp.lte=${endDate}&timespan=day&adjusted=true&window=8&series_type=close&order=desc&limit=1&apikey=${apiKey}`;
    
    // Get EMA_21 value using Polygon's built-in EMA endpoint for daily data
    const ema21Url = `https://api.polygon.io/v1/indicators/ema/${ticker}?timestamp.gte=2024-01-01&timestamp.lte=${endDate}&timespan=day&adjusted=true&window=21&series_type=close&order=desc&limit=1&apikey=${apiKey}`;

    const [ema8Response, ema21Response] = await Promise.all([
      fetchWithRetry(ema8Url),
      fetchWithRetry(ema21Url)
    ]);

    const ema8Data = await ema8Response.json();
    const ema21Data = await ema21Response.json();

    if (ema8Data.status !== "OK" && ema8Data.status !== "DELAYED") {
      return { status: "❌ EMA_8 API error", crossover: false };
    }

    if (ema21Data.status !== "OK" && ema21Data.status !== "DELAYED") {
      return { status: "❌ EMA_21 API error", crossover: false };
    }

    if (!ema8Data.results?.values?.length || !ema21Data.results?.values?.length) {
      return { status: "❌ No daily EMA data available", crossover: false };
    }

    const ema8 = ema8Data.results.values[0];
    const ema21 = ema21Data.results.values[0];

    // Check if both EMAs are from the same timestamp, use more recent if different
    const ema8Timestamp = ema8.timestamp;
    const ema21Timestamp = ema21.timestamp;
    const latestTimestamp = Math.max(ema8Timestamp, ema21Timestamp);

    if (ema8Timestamp !== ema21Timestamp) {
      console.log(`Warning: EMA timestamps don't match for ${ticker}. Using latest available data.`);
    }

    const ema8Value = ema8.value;
    const ema21Value = ema21.value;
    const difference = ema8Value - ema21Value;

    // Determine bullish or bearish based on EMA_8 > EMA_21
    const isBullish = ema8Value > ema21Value;
    const status = isBullish
      ? "✅ Bullish (EMA_8 > EMA_21)"
      : "❌ Bearish (EMA_8 <= EMA_21)";

    console.log(`${ticker} - Daily EMA Crossover (Option): ${status} (EMA_8: ${ema8Value.toFixed(2)}, EMA_21: ${ema21Value.toFixed(2)}, Diff: ${difference.toFixed(2)})`);
    
    return { status, crossover: isBullish };
  } catch (error) {
    console.error(`Daily EMA crossover calculation error for ${ticker}:`, error);
    return { status: "❌ Daily EMA crossover calculation error", crossover: false };
  }
}

function calculateDMI(data: any[]): { status: string; positive: boolean } {
  const period = 14;
  if (data.length < period * 2) {
    return { status: "❌ Insufficient data for DMI", positive: false };
  }

  const highs = data.map((d: any) => d.h);
  const lows = data.map((d: any) => d.l);
  const closes = data.map((d: any) => d.c);

  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < highs.length; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];

    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);

    const highLow = highs[i] - lows[i];
    const highClose = Math.abs(highs[i] - closes[i - 1]);
    const lowClose = Math.abs(lows[i] - closes[i - 1]);
    tr.push(Math.max(highLow, highClose, lowClose));
  }

  // Initial smoothed values (sum of first period)
  let tr14 = tr.slice(0, period).reduce((a, b) => a + b, 0);
  let plusDM14 = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let minusDM14 = minusDM.slice(0, period).reduce((a, b) => a + b, 0);

  // Iterate through remaining values using Wilder's smoothing
  for (let i = period; i < tr.length; i++) {
    tr14 = tr14 - tr14 / period + tr[i];
    plusDM14 = plusDM14 - plusDM14 / period + plusDM[i];
    minusDM14 = minusDM14 - minusDM14 / period + minusDM[i];
  }

  if (tr14 === 0) {
    return { status: "❌ Insufficient volatility for DMI", positive: false };
  }

  const plusDI = 100 * (plusDM14 / tr14);
  const minusDI = 100 * (minusDM14 / tr14);
  const dx = 100 * Math.abs(plusDI - minusDI) / (plusDI + minusDI || 1);

  // Compute ADX using smoothing of DX over the last period
  // Start with average of first 'period' DX values if available
  let adx: number;
  if (tr.length >= period * 2) {
    // Build DX series for last (period) steps for a better estimate
    const dxSeries: number[] = [];
    let trN = tr.slice(0, period).reduce((a, b) => a + b, 0);
    let plusDMN = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
    let minusDMN = minusDM.slice(0, period).reduce((a, b) => a + b, 0);
    for (let i = period; i < tr.length; i++) {
      trN = trN - trN / period + tr[i];
      plusDMN = plusDMN - plusDMN / period + plusDM[i];
      minusDMN = minusDMN - minusDMN / period + minusDM[i];
      const plusDIN = 100 * (plusDMN / trN);
      const minusDIN = 100 * (minusDMN / trN);
      const dxN = 100 * Math.abs(plusDIN - minusDIN) / (plusDIN + minusDIN || 1);
      dxSeries.push(dxN);
    }
    // Wilder's ADX: average the last 'period' DX values
    const start = Math.max(0, dxSeries.length - period);
    const recentDX = dxSeries.slice(start);
    adx = recentDX.reduce((a, b) => a + b, 0) / recentDX.length;
  } else {
    adx = dx; // fallback
  }

  const positive = plusDI > minusDI && adx >= 25; // classic threshold
  const status = positive
    ? `✅ Positive DMI trend confirmed (ADX: ${adx.toFixed(2)})`
    : `❌ No positive DMI trend (ADX: ${adx.toFixed(2)})`;

  return { status, positive };
}

// Calculate MRT (Z-Score based approach)
async function calculateMRT(ticker: string, apiKey: string): Promise<{ status: string; satisfied: boolean }> {
  try {
    const window = 20;
    const overboughtThreshold = 1;
    
    // Fetch 365 days of data
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
    
    const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${startDate.toISOString().split('T')[0]}/${endDate.toISOString().split('T')[0]}?adjusted=true&sort=asc&limit=50000&apikey=${apiKey}`;
    
    const response = await fetchWithRetry(url);
    const data = await response.json();
    
    if (!data.results || data.results.length < window) {
      return { status: "❌ Insufficient data", satisfied: false };
    }
    
    const closes = data.results.map((r: any) => r.c);
    
    // Calculate moving average, standard deviation, and Z-Score for each point
    const zScores: number[] = [];
    
    for (let i = window - 1; i < closes.length; i++) {
      const windowData = closes.slice(i - window + 1, i + 1);
      
      // Calculate MA
      const ma = windowData.reduce((sum: number, val: number) => sum + val, 0) / window;
      
      // Calculate STD
      const squaredDiffs = windowData.map((val: number) => Math.pow(val - ma, 2));
      const variance = squaredDiffs.reduce((sum: number, val: number) => sum + val, 0) / window;
      const std = Math.sqrt(variance);
      
      // Calculate Z-Score
      const zScore = std !== 0 ? (closes[i] - ma) / std : 0;
      zScores.push(zScore);
    }
    
    if (zScores.length === 0) {
      return { status: "❌ Unable to calculate Z-Score", satisfied: false };
    }
    
    // Get the latest Z-Score
    const latestZScore = zScores[zScores.length - 1];
    
    // Condition: Z-Score <= 1 means NOT overbought
    const satisfied = latestZScore <= overboughtThreshold;
    
    const status = satisfied 
      ? `✅ Not overbought (Z-Score: ${latestZScore.toFixed(2)})` 
      : `❌ Overbought (Z-Score: ${latestZScore.toFixed(2)})`;
    
    return { status, satisfied };
  } catch (error) {
    console.error('MRT calculation error:', error);
    return { status: "❌ Calculation error", satisfied: false };
  }
}

// Calculate Burst indicator
async function calculateBurst(ticker: string, apiKey: string): Promise<{ status: string; satisfied: boolean }> {
  try {
    // Use consistent date for reproducible results - last business day
    const baseDate = new Date();
    if (baseDate.getDay() === 0) baseDate.setDate(baseDate.getDate() - 2); // Sunday -> Friday
    if (baseDate.getDay() === 6) baseDate.setDate(baseDate.getDate() - 1); // Saturday -> Friday
    
    const endDate = baseDate.toISOString().split('T')[0];
    const startDate = new Date(baseDate.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${startDate}/${endDate}?adjusted=true&sort=asc&limit=50000&apikey=${apiKey}`;
    
    const response = await fetchWithRetry(url);
    const data = await response.json();
    
    if (!data.results || data.results.length < 27) { // Need at least 27 days for 7-day check + 20-day average
      return { status: "❌ Insufficient data", satisfied: false };
    }
    
    const results = data.results;
    const volumes = results.map((r: any) => r.v);
    const closes = results.map((r: any) => r.c);
    
    // Calculate daily % change
    const dailyChanges = [];
    for (let i = 1; i < closes.length; i++) {
      const pctChange = (closes[i] - closes[i - 1]) / closes[i - 1];
      dailyChanges.push(pctChange);
    }
    
    // Calculate 20-day rolling average volume
    const avgVolumes: number[] = [];
    for (let i = 19; i < volumes.length; i++) {
      const sum = volumes.slice(i - 19, i + 1).reduce((a: number, b: number) => a + b, 0);
      avgVolumes.push(sum / 20);
    }
    
    // Check last 7 trading days for the condition
    const priceThreshold = 0.05; // 5%
    let conditionMet = false;
    
    // Get the last 7 days of data (assuming we have enough data)
    const last7Days = Math.min(7, dailyChanges.length);
    
    console.log(`\nAnalyzing last ${last7Days} trading days for ${ticker}:`);
    
    for (let i = 0; i < last7Days; i++) {
      const dayIndex = dailyChanges.length - 1 - i; // Start from most recent
      const volumeIndex = avgVolumes.length - 1 - i;
      
      if (dayIndex >= 0 && volumeIndex >= 0) {
        const pctChange = dailyChanges[dayIndex];
        const volume = volumes[dayIndex + 1]; // Volume data is offset by 1 due to price change calculation
        const avgVolume = avgVolumes[volumeIndex];
        const close = closes[dayIndex + 1];
        
        const date = new Date(results[dayIndex + 1].t).toISOString().split('T')[0];
        
        console.log(`${date} | Close=${close.toFixed(2)}, Pct_Change=${(pctChange * 100).toFixed(2)}%, Vol=${volume}, AvgVol=${avgVolume.toFixed(0)}`);
        
        const priceCondition = pctChange >= priceThreshold;
        const volumeCondition = volume >= avgVolume;
        
        if (priceCondition && volumeCondition) {
          console.log("  ✅ Condition Met (Price Spike + Volume Spike)");
          conditionMet = true;
        } else {
          console.log("  ❌ Condition Not Met");
        }
      }
    }
    
    if (conditionMet) {
      console.log("\n🎯 SUCCESS: At least one day in the last 7 met the condition.\n");
    } else {
      console.log("\n🚫 FAIL: No day in the last 7 met the condition.\n");
    }
    
    return { 
      status: conditionMet ? "✅ Price spike + Volume spike in last 7 days" : "❌ No condition met in last 7 days", 
      satisfied: conditionMet 
    };
  } catch (error) {
    console.error('Burst calculation error:', error);
    return { status: "❌ Calculation error", satisfied: false };
  }
}

async function calculateTechnicalIndicators(historicalData: any[], ticker: string, criteria: any, apiKey: string, assetType: string) {
  console.log(`Calculating indicators for ${ticker} with criteria:`, criteria);
  
  const statuses = {
    mrt: "❌ MRT not calculated",
    rsiConfirmation: "❌ RSI not calculated",
    macdCrossover: "❌ MACD not calculated",
    weeklyMacd: "❌ Weekly MACD not calculated",
    dmiConfirmation: "❌ DMI not calculated",
    emaCrossover: "❌ EMA crossover not calculated",
    burst: "❌ Burst not calculated",
  } as const;

  // We'll collect mutable copies so we can update
  const s: Record<keyof typeof statuses, string> = { ...statuses };
  const flags: Record<keyof typeof statuses, boolean> = {
    mrt: false,
    rsiConfirmation: false,
    macdCrossover: false,
    weeklyMacd: false,
    dmiConfirmation: false,
    emaCrossover: false,
    burst: false,
  };

  if (criteria.mrt && assetType === 'Option') {
    console.log(`Calculating MRT for option ${ticker}`);
    const mrtResult = await calculateMRT(ticker, apiKey);
    console.log(`MRT result for ${ticker}:`, mrtResult);
    s.mrt = mrtResult.status;
    flags.mrt = !!mrtResult.satisfied;
  }

  if (criteria.rsiConfirmation) {
    const rsiResult = await calculateRSI(ticker, apiKey);
    s.rsiConfirmation = rsiResult.status;
    flags.rsiConfirmation = s.rsiConfirmation.startsWith('✅');
  }

  if (criteria.macdCrossover) {
    if (assetType === 'Option') {
      // Use Polygon's MACD endpoint for options
      const macdResult = await calculateDailyMACD(ticker, apiKey);
      s.macdCrossover = macdResult.status;
      flags.macdCrossover = !!macdResult.crossover;
    } else {
      // Use existing logic for stocks
      const macdResult = calculateMACD(historicalData, assetType);
      s.macdCrossover = macdResult.status;
      flags.macdCrossover = !!macdResult.crossover;
    }
  }

  if (criteria.weeklyMacd) {
    const weeklyMacdResult = await calculateWeeklyMACD(ticker, apiKey, assetType);
    s.weeklyMacd = weeklyMacdResult.status;
    flags.weeklyMacd = !!weeklyMacdResult.crossover;
  }

  if (criteria.dmiConfirmation) {
    const dmiResult = calculateDMI(historicalData);
    s.dmiConfirmation = dmiResult.status;
    flags.dmiConfirmation = !!dmiResult.positive;
  }

  if (criteria.emaCrossover) {
    if (assetType === 'Option') {
      // Use daily EMA for options
      const emaResult = await calculateDailyEMACrossover(ticker, apiKey);
      s.emaCrossover = emaResult.status;
      flags.emaCrossover = !!emaResult.crossover;
    } else {
      // Use weekly EMA for stocks
      const emaResult = await calculateEMACrossover(ticker, apiKey);
      s.emaCrossover = emaResult.status;
      flags.emaCrossover = !!emaResult.crossover;
    }
  }

  if (criteria.burst) {
    const burstResult = await calculateBurst(ticker, apiKey);
    s.burst = burstResult.status;
    flags.burst = !!burstResult.satisfied;
  }

  return { statuses: s, flags };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the Polygon API key from Supabase secrets
    const polygonApiKey = Deno.env.get('POLYGON_API_KEY');
    if (!polygonApiKey) {
      console.error('POLYGON_API_KEY not found in environment');
      return new Response(
        JSON.stringify({ error: 'API configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate the API key (with retry to avoid transient failures)
    const isValidKey = await validatePolygonApiKey(polygonApiKey);
    if (!isValidKey) {
      console.error('Invalid Polygon API key');
      return new Response(
        JSON.stringify({ error: 'Invalid API configuration' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { watchlist, criteria }: AnalysisRequest = await req.json();

    if (!watchlist || !Array.isArray(watchlist) || watchlist.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid watchlist provided' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Starting analysis for ${watchlist.length} tickers`);

    // Process each ticker sequentially to avoid API burst and ensure determinism
    const analysisResults: AnalysisResult[] = [];
    for (const stock of watchlist) {
      const { price, historicalData } = await fetchStockData(stock.ticker, polygonApiKey, stock.assetType);
      const { statuses, flags } = await calculateTechnicalIndicators(historicalData, stock.ticker, criteria, polygonApiKey, stock.assetType);
      
      // Count how many criteria are met
      let criteriaMetCount = 0;
      let totalCriteriaChecked = 0;
  
      // Debug: Log the criteria being checked
      console.log(`\n=== DEBUGGING ${stock.ticker} (${stock.assetType}) ===`);
      console.log('Selected criteria:', JSON.stringify(criteria));
      
      // Check each selected criteria and only count those that are actually calculated for this asset type
      Object.entries(criteria).forEach(([key, value]) => {
        if (value) {
          console.log(`Checking ${key}: selected=${value}`);
          // Only count criteria that would actually be calculated for this asset type
          let shouldCount = false;
          
          if (key === 'mrt' && stock.assetType === 'Option') shouldCount = true;
          else if (key === 'rsiConfirmation') shouldCount = true;
          else if (key === 'macdCrossover') shouldCount = true;
          else if (key === 'weeklyMacd') shouldCount = true;
          else if (key === 'dmiConfirmation') shouldCount = true;
          else if (key === 'emaCrossover') shouldCount = true;
          else if (key === 'burst' && stock.assetType === 'Stock') shouldCount = true;
          
          console.log(`  - shouldCount for ${stock.assetType}: ${shouldCount}`);
          
          if (shouldCount) {
            totalCriteriaChecked++;
            const indicatorStatus = statuses[key as keyof typeof statuses];
            const passedFlag = flags[key as keyof typeof flags];
            console.log(`  - ${stock.ticker} - ${key}: ${indicatorStatus}`);
            if (passedFlag) {
              criteriaMetCount++;
              console.log(`  - ✅ PASSED: ${key}`);
            } else {
              console.log(`  - ❌ FAILED: ${key}`);
            }
          }
        }
      });
  
      console.log(`\n🎯 ${stock.ticker} FINAL RESULT: ${criteriaMetCount}/${totalCriteriaChecked} criteria met`);
      
      // A stock passes only if it meets ALL selected criteria (intersection logic)
      const passed = totalCriteriaChecked > 0 ? (criteriaMetCount === totalCriteriaChecked) : false;
      console.log(`🎯 ${stock.ticker} PASSED: ${passed}\n`);
  
      analysisResults.push({
        ticker: stock.ticker,
        assetType: stock.assetType,
        currentPrice: `$${price.toFixed(2)}`,
        mrt: statuses.mrt,
        rsiConfirmation: statuses.rsiConfirmation,
        macdCrossover: statuses.macdCrossover,
        weeklyMacd: statuses.weeklyMacd,
        dmiConfirmation: statuses.dmiConfirmation,
        emaCrossover: statuses.emaCrossover,
        burst: statuses.burst,
        passed
      });
    }

    console.log(`Analysis completed: ${analysisResults.filter(r => r.passed).length}/${analysisResults.length} stocks passed`);

    return new Response(
      JSON.stringify({ results: analysisResults }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Analysis error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});