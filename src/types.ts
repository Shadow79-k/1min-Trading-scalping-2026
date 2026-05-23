export type TradingMode = 'AUTOMATIC' | 'MANUAL';

export interface EconomicEvent {
  id: string;
  time: string; // e.g. "18:30:00"
  currency: 'USD' | 'EUR' | 'GBP' | 'JPY';
  event: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  forecast?: string;
  previous?: string;
  actual?: string;
}

export interface StrategySettings {
  // Platform configuration
  platform: string;
  apiKey: string;
  
  // Money management parameters
  riskPerOrderPercent: number; // e.g. 0.25%
  maxOrdersPerDay: number; // e.g. 750
  maxLossDailyPercent: number; // e.g. 1%
  maxProfitDailyPercent: number; // e.g. 2%
  
  // Trade management parameters
  stopLossPips: number; // e.g. 5
  takeProfitPips: number; // e.g. 10
  trailingStopPips: number; // e.g. 5
  useTrailingStop: boolean;

  // Rule 1 settings: RSI on Close
  rsi1Period: number; // 5
  rsi1AppliedPrice: 'close';
  rsi1CandleShift: number; // 1
  rsi1SellLevel: number; // 30
  rsi1BuyLevel: number; // 70
  rsi1Enabled: boolean;

  // Rule 2 settings: RSI on Open
  rsi2Period: number; // 5
  rsi2AppliedPrice: 'open';
  rsi2CandleShift: number; // 1
  rsi2SellLevel: number; // 70
  rsi2BuyLevel: number; // 30
  rsi2Enabled: boolean;

  // Rule 3 settings: EMA Crossover
  emaFastPeriod: number; // 9
  emaSlowPeriod: number; // 21
  emaCandleShift: number; // 1
  emaCrossoverEnabled: boolean;

  // Real-Time Economic Calendar News Filter settings
  newsFilterEnabled: boolean;
  newsFilterBufferMinutes: number; // default 30
  newsFilterMinImpact: 'HIGH' | 'MEDIUM' | 'LOW'; // default HIGH

  // MACD Rule settings
  macdEnabled: boolean;
  macdFastPeriod: number; // 12
  macdSlowPeriod: number; // 26
  macdSignalPeriod: number; // 9
  macdCrossoverEnabled: boolean;
  macdDivergenceEnabled: boolean;

  // Multi-Timeframe Strategy settings
  mtfEnabled: boolean;
  mtfConfirmTimeframe: 'M5' | 'M15' | 'BOTH';
  mtfConfirmTrend: boolean; // confirm trend using EMA9 > EMA21 alignment
  mtfConfirmCandlestick: boolean; // check if color aligns with trade signal

  // Alerts & Notifications configuration
  soundEnabled: boolean;
  browserAlertsEnabled: boolean;
  alertOnProfitHit: boolean;
  alertOnDrawdownHit: boolean;

  // Running states
  tradingMode: TradingMode;
  tradingHoursStart: number; // e.g. 0.0
  tradingHoursEnd: number; // e.g. 23.0
  tradingDays: string[]; // ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
}

export interface Trade {
  id: string;
  timestamp: string;
  pair: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  currentPrice: number;
  exitPrice?: number;
  status: 'ACTIVE' | 'TP' | 'SL' | 'EXP' | 'TRAILING_ACTIVE';
  pnlPercentage: number; // percentage profit or loss
  pipsProfit: number;
  pnlAmount: number; // dollar amount based on dynamic sizing
  initialStopLoss: number;
  initialTakeProfit: number;
  currentStopLoss: number;
  triggerType: 'RSI1' | 'RSI2' | 'EMA_CROSS' | 'MACD_CROSS' | 'MACD_DIV' | 'MANUAL';
  newsFilterAlert?: string; // notes if bypassed/held
  durationMins?: number; // simulated duration in minutes
  entryRealTime?: number; // real timestamp ms
  exitRealTime?: number; // real timestamp ms
}

export interface Candle {
  time: string; // timestamp or formatted time e.g., '14:23:00'
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  rsiClose5?: number;
  rsiOpen5?: number;
  ema9?: number;
  ema21?: number;
  // MACD indicator variables
  macdLine?: number;
  macdSignal?: number;
  macdHist?: number;
}

export interface BotStats {
  initialBalance: number;
  currentBalance: number;
  totalOrdersToday: number;
  maxProfitLimitReached: boolean;
  maxLossLimitReached: boolean;
  totalWon: number;
  totalLost: number;
}
