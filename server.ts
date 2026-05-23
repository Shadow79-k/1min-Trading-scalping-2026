import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables (.env)
dotenv.config();

const app = express();
const PORT = 3000;

// Middleware to parse JSON
app.use(express.json());

// Lazy-initialize Gemini SDK
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not defined in Settings > Secrets.');
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Global server-backed economic calendar events
let activeEconomicCalendar = [
  { id: 'ev-1', time: '18:30:00', currency: 'USD', event: 'FOMC Interest Rate Decision', impact: 'HIGH', forecast: '5.25%', previous: '5.25%' },
  { id: 'ev-2', time: '19:45:00', currency: 'EUR', event: 'ECB Press Conference', impact: 'HIGH', forecast: 'N/A', previous: '3.75%' },
  { id: 'ev-3', time: '21:00:00', currency: 'USD', event: 'Fed Chair Powell Testimony', impact: 'HIGH', forecast: 'N/A', previous: 'N/A' },
  { id: 'ev-4', time: '08:30:00', currency: 'USD', event: 'Core CPI MoM Inflation Report', impact: 'HIGH', forecast: '0.3%', previous: '0.2%' },
  { id: 'ev-5', time: '14:30:00', currency: 'USD', event: 'Non-Farm Employment Change (NFP)', impact: 'HIGH', forecast: '185K', previous: '210K' }
];

// REST Api endpoint for news calendar retrieval
app.get('/api/news', (req, res) => {
  res.json(activeEconomicCalendar);
});

// REST Api endpoint to add a custom high impact news event
app.post('/api/news', (req, res) => {
  const { currency, event, time, impact, forecast, previous } = req.body;
  if (!event || !time) {
    return res.status(400).json({ error: 'Event name and time (HH:MM:SS) are required.' });
  }
  
  const newEvent = {
    id: `ev-user-${Math.floor(Math.random() * 90000 + 10000)}`,
    time,
    currency: currency || 'USD',
    event,
    impact: impact || 'HIGH',
    forecast: forecast || 'N/A',
    previous: previous || 'N/A'
  };
  activeEconomicCalendar.push(newEvent);
  res.json({ success: true, event: newEvent });
});

// REST Api endpoint for AI Scalping Strategy Audit & Advisory
app.post('/api/analyze', async (req, res) => {
  try {
    const { strategySettings, tradeHistory, botStats, logs } = req.body;

    const apiKeyStatus = process.env.GEMINI_API_KEY ? "CONFIGURED (Safe Server-Side)" : "MISSING";

    const prompt = `
You are the elite algorithmic advisor and quantitative trading architect for the "Apex Scalper Trading Bot".
Assess the performance of the scalping strategy with the parameters below and provide a concise, expert review in human-readable Markdown format.

## Trading Configurations
- Platform: ${strategySettings?.platform || 'Pocket Option'}
- Trading Mode: ${strategySettings?.tradingMode || 'AUTOMATIC'}
- Trade Hours: ${strategySettings?.tradingHoursStart || 0.0} - ${strategySettings?.tradingHoursEnd || 23.0}
- API Secret State: ${strategySettings?.apiKey ? 'CONNECTED' : 'NOT CONNECTED'}
- Server-Side Key Status: ${apiKeyStatus}

## Money Management Configuration
- Risk Per Order: ${strategySettings?.riskPerOrderPercent || 0.25}%
- Max Orders Per Day: ${strategySettings?.maxOrdersPerDay || 750}
- Max Loss Daily: ${strategySettings?.maxLossDailyPercent || 1}%
- Max Profit Daily: ${strategySettings?.maxProfitDailyPercent || 2}% (Target percent ratio)

## Trade Parameters
- Stop Loss: ${strategySettings?.stopLossPips || 5} pips
- Take Profit: ${strategySettings?.takeProfitPips || 10} pips
- Trailing Stop: ${strategySettings?.trailingStopPips || 5} pips (Enabled: ${strategySettings?.useTrailingStop ? 'Yes' : 'No'})

## Active Entry & Exit Rules
1. RSI close (shift 1, period ${strategySettings?.rsi1Period || 5}): Sell Level: ${strategySettings?.rsi1SellLevel || 30}, Buy Level: ${strategySettings?.rsi1BuyLevel || 70} (RSI close mode: ${strategySettings?.rsi1Enabled ? 'ACTIVE' : 'INACTIVE'})
2. RSI open (shift 1, period ${strategySettings?.rsi2Period || 5}): Sell Level: ${strategySettings?.rsi2SellLevel || 70}, Buy Level: ${strategySettings?.rsi2BuyLevel || 30} (RSI open mode: ${strategySettings?.rsi2Enabled ? 'ACTIVE' : 'INACTIVE'})
3. EMA Crossover (shift 1): Fast: ${strategySettings?.emaFastPeriod || 9}-period, Slow: ${strategySettings?.emaSlowPeriod || 21}-period (EMA Crossover mode: ${strategySettings?.emaCrossoverEnabled ? 'ACTIVE' : 'INACTIVE'})

## Simulated Execution Performance Summary
- Initial Seed Balance: $${botStats?.initialBalance || 10000}
- Current Simulated Balance: $${botStats?.currentBalance || 10000}
- Realized Win Rate: ${botStats?.totalWon + botStats?.totalLost > 0 ? ((botStats.totalWon / (botStats.totalWon + botStats.totalLost)) * 100).toFixed(1) + '%' : 'N/A'}
- Won: ${botStats?.totalWon || 0} trades / Lost: ${botStats?.totalLost || 0} trades
- Orders Executed Today: ${botStats?.totalOrdersToday || 0} / ${strategySettings?.maxOrdersPerDay || 750} max.
- Daily Limits Hit: Profit Cap Hit [${botStats?.maxProfitLimitReached ? 'YES' : 'NO'}] | Daily Stop Limit Hit [${botStats?.maxLossLimitReached ? 'YES' : 'NO'}]

Please write a highly quantitative, constructive critique addressing:
1. **Mathematical Safety**: Critique the 0.25% dynamic allocation against standard Pocket Option binary option payout / scalping risk-to-reward metrics.
2. **Indicator Validation**: Explore the contrast between Rule 1 (RSI Close Period 5: Sell 30, Buy 70 - counters common overbought consensus to ride micro-momentum) vs Rule 2 (RSI Open Period 5: Sell 70, Buy 30 - traditional mean-reverting oversold/overbought). Highlight whether combining them is conflicting or synergistic.
3. **Pips Calibration**: Is a 5-pip Stop Loss too tight for M1 timeframe given average true range (ATR) noise? Compare it with the 10-pip Take Profit and trailing stop parameters.
4. **Actionable Recommendations**: Present 3 clear Bullet Point upgrades to maximize mathematical efficacy.

Keep it structured, analytical, and professional. Avoid fluffy adjectives. Use a dry, quantitative hedge-fund analyst tone.
`;

    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are the Elite quantitative algorithm developer for high-frequency forex and index contracts.',
        temperature: 0.7,
      }
    });

    res.json({ analysis: response.text || "No report generated." });
  } catch (error: any) {
    console.error("AI strategy analysis failed: ", error);
    res.status(500).json({ error: error?.message || 'Failure executing server-side Gemini analysis' });
  }
});

// Configure Vite integration for dev or fall back to dist folder for production build
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with active Vite routing...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode serving static dist files...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Apex Scalper Service running natively on port ${PORT}`);
  });
}

setupVite();
