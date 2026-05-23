import { Candle, StrategySettings, Trade, EconomicEvent } from '../types';

/**
 * Generates an initial sequence of candles to bootstrap the chart indicators.
 * We boost this to 200 candles to allow deep M5 & M15 timeframe resolution.
 */
export function generateInitialCandles(count: number = 180, basePrice: number = 1.0950): Candle[] {
  let candles: Candle[] = [];
  let currentPrice = basePrice;
  let timestamp = Date.now() - count * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const change = (Math.random() - 0.49) * 0.0008; // realistic forex M1 micro-pips movement
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) + Math.random() * 0.0003;
    const low = Math.min(open, close) - Math.random() * 0.0003;
    const volume = Math.floor(Math.random() * 150) + 50;

    candles.push({
      time: timeStr,
      open,
      high,
      low,
      close,
      volume,
    });

    currentPrice = close;
    timestamp += 60 * 1000;
  }

  // Back-calculate indicators
  return recalculateIndicators(candles);
}

/**
 * Helper to calculate EMA (Exponential Moving Average) for a period.
 */
export function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  if (data.length === 0) return ema;

  const k = 2 / (period + 1);
  let prevEma = data[0];
  ema.push(prevEma);

  for (let i = 1; i < data.length; i++) {
    const curEma = data[i] * k + prevEma * (1 - k);
    ema.push(curEma);
    prevEma = curEma;
  }

  return ema;
}

/**
 * Calculates Wilder's Relative Strength Index (RSI) for a series.
 */
export function calculateRSI(prices: number[], period: number): number[] {
  const rsi: number[] = [];
  if (prices.length < period) {
    return new Array(prices.length).fill(50);
  }

  // Pre-fill initial index elements with neutral 50 until we have enough candles
  for (let i = 0; i < period; i++) {
    rsi.push(50);
  }

  let gains = 0;
  let losses = 0;

  // First period gains/losses
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  const initialRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + initialRS));

  // Wilder's smoothing multiplier
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs));
  }

  return rsi;
}

/**
 * Takes an array of candles and fills calculations for EMAs, RSIs, and MACD (12, 26, 9)
 */
export function recalculateIndicators(candles: Candle[]): Candle[] {
  const closePrices = candles.map((c) => c.close);
  const openPrices = candles.map((c) => c.open);

  const ema9 = calculateEMA(closePrices, 9);
  const ema21 = calculateEMA(closePrices, 21);
  
  const rsiClose5 = calculateRSI(closePrices, 5);
  const rsiOpen5 = calculateRSI(openPrices, 5);

  // MACD indicator integration
  // 12-period Fast EMA, 26-period Slow EMA, 9-period Signal line
  const ema12 = calculateEMA(closePrices, 12);
  const ema26 = calculateEMA(closePrices, 26);
  
  const macdLine = ema12.map((val, idx) => val - (ema26[idx] || val));
  const macdSignal = calculateEMA(macdLine, 9);
  const macdHist = macdLine.map((val, idx) => val - (macdSignal[idx] || val));

  return candles.map((candle, idx) => ({
    ...candle,
    ema9: ema9[idx],
    ema21: ema21[idx],
    rsiClose5: rsiClose5[idx],
    rsiOpen5: rsiOpen5[idx],
    macdLine: macdLine[idx],
    macdSignal: macdSignal[idx],
    macdHist: macdHist[idx],
  }));
}

/**
 * Aggregates M1 candles into higher timeframes.
 * e.g., multiplier = 5 results in M5 candles; multiplier = 15 results in M15.
 */
export function aggregateCandles(m1Candles: Candle[], multiplier: number): Candle[] {
  const aggregated: Candle[] = [];
  
  for (let i = 0; i < m1Candles.length; i += multiplier) {
    const chunk = m1Candles.slice(i, i + multiplier);
    if (chunk.length === 0) continue;

    const open = chunk[0].open;
    const close = chunk[chunk.length - 1].close;
    const high = Math.max(...chunk.map((c) => c.high));
    const low = Math.min(...chunk.map((c) => c.low));
    const volume = chunk.reduce((sum, c) => sum + c.volume, 0);
    const time = chunk[0].time; // Bracket open timestamp

    aggregated.push({
      time,
      open,
      high,
      low,
      close,
      volume,
    });
  }

  return recalculateIndicators(aggregated);
}

/**
 * Computes direct difference in absolute minutes between two "HH:MM:SS" / "HH:MM" timestamps.
 */
export function getMinutesDifference(time1: string, tnews: string): number {
  const parseTime = (tString: string) => {
    const parts = tString.split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h * 60 + m;
  };

  const minutes1 = parseTime(time1);
  const minutes2 = parseTime(tnews);
  
  let diff = Math.abs(minutes1 - minutes2);
  if (diff > 12 * 60) {
    diff = 24 * 60 - diff; // modular midnight wrap
  }
  return diff;
}

/**
 * Detects if a MACD divergence (Bullish or Bearish) has formed recently.
 */
export function detectMACDPriceDivergence(candles: Candle[]): 'BULLISH_DIV' | 'BEARISH_DIV' | null {
  if (candles.length < 15) return null;
  
  // Segment A: candles index -15 to -8 (past pivot region)
  // Segment B: candles index -7 to -1 (current pivot region)
  const len = candles.length;
  const segA = candles.slice(len - 15, len - 8);
  const segB = candles.slice(len - 8, len);
  
  // Bulish: Price Lower Low vs MACD Higher Low
  let minLowIndexA = 0;
  let minLowA = Infinity;
  segA.forEach((c, idx) => {
    if (c.low < minLowA) {
      minLowA = c.low;
      minLowIndexA = idx;
    }
  });

  let minLowIndexB = 0;
  let minLowB = Infinity;
  segB.forEach((c, idx) => {
    if (c.low < minLowB) {
      minLowB = c.low;
      minLowIndexB = idx;
    }
  });

  const macdA = segA[minLowIndexA].macdLine || 0;
  const macdB = segB[minLowIndexB].macdLine || 0;

  if (minLowB < minLowA && macdB > macdA + 0.00001) {
    return 'BULLISH_DIV';
  }

  // Bearish: Price Higher High vs MACD Lower High
  let maxHighIndexA = 0;
  let maxHighA = -Infinity;
  segA.forEach((c, idx) => {
    if (c.high > maxHighA) {
      maxHighA = c.high;
      maxHighIndexA = idx;
    }
  });

  let maxHighIndexB = 0;
  let maxHighB = -Infinity;
  segB.forEach((c, idx) => {
    if (c.high > maxHighB) {
      maxHighB = c.high;
      maxHighIndexB = idx;
    }
  });

  const macdHighA = segA[maxHighIndexA].macdLine || 0;
  const macdHighB = segB[maxHighIndexB].macdLine || 0;

  if (maxHighB > maxHighA && macdHighB < macdHighA - 0.00001) {
    return 'BEARISH_DIV';
  }

  return null;
}

/**
 * Confirms a trade signal from M1 with trend direction and/or candlestick patterns on higher timeframes.
 */
export function verifyMultiTimeframeConfirmation(
  direction: 'BUY' | 'SELL',
  primaryReason: string,
  settings: StrategySettings,
  m5Candles?: Candle[],
  m15Candles?: Candle[]
): { confirmed: boolean; finalReason: string } {
  if (!settings.mtfEnabled) {
    return { confirmed: true, finalReason: primaryReason };
  }

  const timeframesToCheck: ('M5' | 'M15')[] = [];
  if (settings.mtfConfirmTimeframe === 'M5' || settings.mtfConfirmTimeframe === 'BOTH') {
    timeframesToCheck.push('M5');
  }
  if (settings.mtfConfirmTimeframe === 'M15' || settings.mtfConfirmTimeframe === 'BOTH') {
    timeframesToCheck.push('M15');
  }

  for (const tf of timeframesToCheck) {
    const list = tf === 'M5' ? m5Candles : m15Candles;
    if (!list || list.length < 3) {
      continue;
    }

    const lastTFCandle = list[list.length - 1];
    
    // 1. Trend confirmation using EMA alignment (Close vs EMA21, or EMA9 vs EMA21)
    if (settings.mtfConfirmTrend) {
      const slowEMA = lastTFCandle.ema21;
      if (slowEMA !== undefined) {
        if (direction === 'BUY' && lastTFCandle.close < slowEMA) {
          return {
            confirmed: false,
            finalReason: `${primaryReason} | BYPASSED: trend contrary ${tf} bearish (Close ${lastTFCandle.close.toFixed(5)} < EMA21 ${slowEMA.toFixed(5)})`
          };
        }
        if (direction === 'SELL' && lastTFCandle.close > slowEMA) {
          return {
            confirmed: false,
            finalReason: `${primaryReason} | BYPASSED: trend contrary ${tf} bullish (Close ${lastTFCandle.close.toFixed(5)} > EMA21 ${slowEMA.toFixed(5)})`
          };
        }
      }
    }

    // 2. Candlestick Confirmation pattern (Confirming bullish / bearish pressure color)
    if (settings.mtfConfirmCandlestick) {
      const isBullishCandle = lastTFCandle.close >= lastTFCandle.open;
      if (direction === 'BUY' && !isBullishCandle) {
        return {
          confirmed: false,
          finalReason: `${primaryReason} | BYPASSED: contrary ${tf} candlestick bearish red color`
        };
      }
      if (direction === 'SELL' && isBullishCandle) {
        return {
          confirmed: false,
          finalReason: `${primaryReason} | BYPASSED: contrary ${tf} candlestick bullish green color`
        };
      }
    }
  }

  return {
    confirmed: true,
    finalReason: `${primaryReason} [MTF ${settings.mtfConfirmTimeframe} CONFIRMED]`
  };
}

/**
 * Checks signal triggers according to specified Strategy settings.
 */
export function checkTradingSignals(
  candles: Candle[], 
  settings: StrategySettings,
  m5Candles?: Candle[],
  m15Candles?: Candle[],
  economicEvents: EconomicEvent[] = []
): { 
  signal: 'BUY' | 'SELL' | null; 
  reason: string; 
  triggerType: 'RSI1' | 'RSI2' | 'EMA_CROSS' | 'MACD_CROSS' | 'MACD_DIV' | null;
  newsFilterAlert?: string;
} {
  if (candles.length < 25) {
    return { signal: null, reason: 'Insufficient history data', triggerType: null };
  }

  const closedCandleIndex = candles.length - 2; // Last completed candle (shift 1)
  const prevClosedCandleIndex = candles.length - 3; // Shift 2 (for crossover checks)
  
  const closedCandle = candles[closedCandleIndex];
  const prevClosedCandle = candles[prevClosedCandleIndex];

  if (!closedCandle || !prevClosedCandle) {
    return { signal: null, reason: 'Candles not ready', triggerType: null };
  }

  // ---- real-time NEWS ECONOMIC FILTER BLOCK OUT ----
  if (settings.newsFilterEnabled && economicEvents.length > 0) {
    const lastTickTime = candles[candles.length - 1].time;
    
    for (const ev of economicEvents) {
      const evImpactVal = ev.impact === 'HIGH' ? 3 : ev.impact === 'MEDIUM' ? 2 : 1;
      const minFilterVal = settings.newsFilterMinImpact === 'HIGH' ? 3 : settings.newsFilterMinImpact === 'MEDIUM' ? 2 : 1;

      if (evImpactVal >= minFilterVal) {
        const minDiff = getMinutesDifference(lastTickTime, ev.time);
        
        if (minDiff <= settings.newsFilterBufferMinutes) {
          return {
            signal: null,
            reason: `[NEWS ACTIVE] Auto trading halted: news event "${ev.event}" occurs at ${ev.time} (${minDiff} mins away)`,
            triggerType: null,
            newsFilterAlert: `HALTED: "${ev.event}" at ${ev.time} (${minDiff}m)`
          };
        }
      }
    }
  }

  // ---- NEW RULE 5: MACD DIVERGENCE (Divergence matched with RSI zone filters) ----
  if (settings.macdEnabled && settings.macdDivergenceEnabled) {
    const div = detectMACDPriceDivergence(candles);
    const rsiVal = closedCandle.rsiClose5 || 50;
    
    if (div === 'BULLISH_DIV') {
      // Divergence is bullish (reversal from low) + confirmed if RSI close is not extremely overbought
      if (rsiVal < 55) {
        const preSig = {
          signal: 'BUY' as const,
          reason: `MACD Bullish Divergence spotted with underlying RSI at ${rsiVal.toFixed(1)}`,
          triggerType: 'MACD_DIV' as const
        };
        const verification = verifyMultiTimeframeConfirmation('BUY', preSig.reason, settings, m5Candles, m15Candles);
        if (verification.confirmed) {
          return { ...preSig, reason: verification.finalReason };
        } else {
          return { signal: null, reason: verification.finalReason, triggerType: null };
        }
      }
    }

    if (div === 'BEARISH_DIV') {
      // Divergence is bearish (top reversal) + confirmed if RSI is not extremely oversold
      if (rsiVal > 45) {
        const preSig = {
          signal: 'SELL' as const,
          reason: `MACD Bearish Divergence spotted with underlying RSI at ${rsiVal.toFixed(1)}`,
          triggerType: 'MACD_DIV' as const
        };
        const verification = verifyMultiTimeframeConfirmation('SELL', preSig.reason, settings, m5Candles, m15Candles);
        if (verification.confirmed) {
          return { ...preSig, reason: verification.finalReason };
        } else {
          return { signal: null, reason: verification.finalReason, triggerType: null };
        }
      }
    }
  }

  // ---- NEW RULE 4: MACD CROSSOVER (Fast crosses Signal in confluence with RSI Close 5 indicators) ----
  if (settings.macdEnabled && settings.macdCrossoverEnabled) {
    const macdNow = closedCandle.macdLine;
    const signalNow = closedCandle.macdSignal;
    const macdPrev = prevClosedCandle.macdLine;
    const signalPrev = prevClosedCandle.macdSignal;

    if (macdNow !== undefined && signalNow !== undefined && macdPrev !== undefined && signalPrev !== undefined) {
      // Bullish Cross (MACD line crosses ABOVE signal)
      if (macdPrev <= signalPrev && macdNow > signalNow) {
        const rsiVal = closedCandle.rsiClose5 || 50;
        // Confirmed if we are not pushing overbought territory
        if (rsiVal < 65) {
          const preSig = {
            signal: 'BUY' as const,
            reason: `MACD Bullish Crossover (MACD Line ${macdNow.toFixed(5)} crossed above Signal ${signalNow.toFixed(5)})`,
            triggerType: 'MACD_CROSS' as const
          };
          const verification = verifyMultiTimeframeConfirmation('BUY', preSig.reason, settings, m5Candles, m15Candles);
          if (verification.confirmed) {
            return { ...preSig, reason: verification.finalReason };
          } else {
            return { signal: null, reason: verification.finalReason, triggerType: null };
          }
        }
      }

      // Bearish Cross (MACD line crosses BELOW signal)
      if (macdPrev >= signalPrev && macdNow < signalNow) {
        const rsiVal = closedCandle.rsiClose5 || 50;
        // Confirmed if we are not pushing oversold territory
        if (rsiVal > 35) {
          const preSig = {
            signal: 'SELL' as const,
            reason: `MACD Bearish Crossover (MACD Line ${macdNow.toFixed(5)} crossed below Signal ${signalNow.toFixed(5)})`,
            triggerType: 'MACD_CROSS' as const
          };
          const verification = verifyMultiTimeframeConfirmation('SELL', preSig.reason, settings, m5Candles, m15Candles);
          if (verification.confirmed) {
            return { ...preSig, reason: verification.finalReason };
          } else {
            return { signal: null, reason: verification.finalReason, triggerType: null };
          }
        }
      }
    }
  }

  // ---- RULE 3: EMA CROSSOVER (FAST 9, SLOW 21, SHIFT 1) ----
  if (settings.emaCrossoverEnabled) {
    const fastNow = closedCandle.ema9;
    const slowNow = closedCandle.ema21;
    const fastPrev = prevClosedCandle.ema9;
    const slowPrev = prevClosedCandle.ema21;

    if (fastNow && slowNow && fastPrev && slowPrev) {
      if (fastPrev <= slowPrev && fastNow > slowNow) {
        const preSig = { 
          signal: 'BUY' as const, 
          reason: `EMA Bullish Cross (Fast ${settings.emaFastPeriod} crossed above Slow ${settings.emaSlowPeriod})`, 
          triggerType: 'EMA_CROSS' as const 
        };
        const verification = verifyMultiTimeframeConfirmation('BUY', preSig.reason, settings, m5Candles, m15Candles);
        if (verification.confirmed) return { ...preSig, reason: verification.finalReason };
        else return { signal: null, reason: verification.finalReason, triggerType: null };
      }
      if (fastPrev >= slowPrev && fastNow < slowNow) {
        const preSig = { 
          signal: 'SELL' as const, 
          reason: `EMA Bearish Cross (Fast ${settings.emaFastPeriod} crossed below Slow ${settings.emaSlowPeriod})`, 
          triggerType: 'EMA_CROSS' as const 
        };
        const verification = verifyMultiTimeframeConfirmation('SELL', preSig.reason, settings, m5Candles, m15Candles);
        if (verification.confirmed) return { ...preSig, reason: verification.finalReason };
        else return { signal: null, reason: verification.finalReason, triggerType: null };
      }
    }
  }

  // ---- RULE 1: RSI CLOSE (PERIOD 5, SHIFT 1) ----
  if (settings.rsi1Enabled) {
    const rsiVal = closedCandle.rsiClose5;
    const rsiPrev = prevClosedCandle.rsiClose5;
    
    if (rsiVal !== undefined && rsiPrev !== undefined) {
      if (rsiPrev < settings.rsi1BuyLevel && rsiVal >= settings.rsi1BuyLevel) {
        const preSig = { 
          signal: 'BUY' as const, 
          reason: `RSI Close 5 crossed Buy Level (${settings.rsi1BuyLevel}) showing sharp momentum upwards`, 
          triggerType: 'RSI1' as const 
        };
        const verification = verifyMultiTimeframeConfirmation('BUY', preSig.reason, settings, m5Candles, m15Candles);
        if (verification.confirmed) return { ...preSig, reason: verification.finalReason };
        else return { signal: null, reason: verification.finalReason, triggerType: null };
      }
      if (rsiPrev > settings.rsi1SellLevel && rsiVal <= settings.rsi1SellLevel) {
        const preSig = { 
          signal: 'SELL' as const, 
          reason: `RSI Close 5 crossed Sell Level (${settings.rsi1SellLevel}) showing sharp momentum downwards`, 
          triggerType: 'RSI1' as const 
        };
        const verification = verifyMultiTimeframeConfirmation('SELL', preSig.reason, settings, m5Candles, m15Candles);
        if (verification.confirmed) return { ...preSig, reason: verification.finalReason };
        else return { signal: null, reason: verification.finalReason, triggerType: null };
      }
    }
  }

  // ---- RULE 2: RSI OPEN (PERIOD 5, SHIFT 1) ----
  if (settings.rsi2Enabled) {
    const rsiVal = closedCandle.rsiOpen5;
    const rsiPrev = prevClosedCandle.rsiOpen5;

    if (rsiVal !== undefined && rsiPrev !== undefined) {
      if (rsiPrev > settings.rsi2BuyLevel && rsiVal <= settings.rsi2BuyLevel) {
        const preSig = { 
          signal: 'BUY' as const, 
          reason: `RSI Open 5 oversold cross below Buy Level (${settings.rsi2BuyLevel}) triggering reverse buy`, 
          triggerType: 'RSI2' as const 
        };
        const verification = verifyMultiTimeframeConfirmation('BUY', preSig.reason, settings, m5Candles, m15Candles);
        if (verification.confirmed) return { ...preSig, reason: verification.finalReason };
        else return { signal: null, reason: verification.finalReason, triggerType: null };
      }
      if (rsiPrev < settings.rsi2SellLevel && rsiVal >= settings.rsi2SellLevel) {
        const preSig = { 
          signal: 'SELL' as const, 
          reason: `RSI Open 5 overbought cross above Sell Level (${settings.rsi2SellLevel}) triggering reverse sell`, 
          triggerType: 'RSI2' as const 
        };
        const verification = verifyMultiTimeframeConfirmation('SELL', preSig.reason, settings, m5Candles, m15Candles);
        if (verification.confirmed) return { ...preSig, reason: verification.finalReason };
        else return { signal: null, reason: verification.finalReason, triggerType: null };
      }
    }
  }

  return { signal: null, reason: 'No active triggers met.', triggerType: null };
}

/**
 * Helper to calculate Pip values (assumes typical EUR/USD forex structure)
 * 1 pip = 0.0001 units
 */
export function calculatePips(price1: number, price2: number): number {
  return parseFloat(((price1 - price2) * 10000).toFixed(1));
}
