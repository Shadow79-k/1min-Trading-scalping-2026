import React, { useState, useEffect, useRef } from 'react';
import { StrategySettings, Trade, Candle, BotStats, EconomicEvent } from './types';
import { generateInitialCandles, recalculateIndicators, checkTradingSignals, calculatePips, aggregateCandles, getMinutesDifference } from './utils/tradingSimulation';
import { playNotificationTone } from './utils/audio';
import { TradingChart } from './components/TradingChart';
import { BotMetrics } from './components/BotMetrics';
import { BotControlPanel } from './components/BotControlPanel';
import { TradeHistoryList } from './components/TradeHistoryList';
import { AIPortfolioAdvisor } from './components/AIPortfolioAdvisor';
import { ShieldCheck, Info, Radio, Activity, Terminal as TerminalIcon, HelpCircle, Newspaper, Hourglass, Layers2, BarChart2, Bell, Volume2, VolumeX } from 'lucide-react';

const INITIAL_BALANCE = 10000;

export default function App() {
  // 1. Initial configuration for strategy reflecting user criteria
  const [settings, setSettings] = useState<StrategySettings>({
    platform: 'Pocket Option',
    apiKey: 'AwC9KTcFeNhC8vTRU', // specified by user
    
    riskPerOrderPercent: 0.25, // specified by user
    maxOrdersPerDay: 750, // specified by user
    maxLossDailyPercent: 1.0, // specified by user
    maxProfitDailyPercent: 2.0, // specified by user

    stopLossPips: 5, // specified by user
    takeProfitPips: 10, // specified by user
    trailingStopPips: 5, // specified by user
    useTrailingStop: true,

    // Rule 1: RSI Close M1 Period 5
    rsi1Period: 5,
    rsi1AppliedPrice: 'close',
    rsi1CandleShift: 1,
    rsi1SellLevel: 30,
    rsi1BuyLevel: 70,
    rsi1Enabled: true,

    // Rule 2: RSI Open M1 Period 5  
    rsi2Period: 5,
    rsi2AppliedPrice: 'open',
    rsi2CandleShift: 1,
    rsi2SellLevel: 70,
    rsi2BuyLevel: 30,
    rsi2Enabled: true,

    // Rule 3: EMA Crossover Fast 9 Slow 21
    emaFastPeriod: 9,
    emaSlowPeriod: 21,
    emaCandleShift: 1,
    emaCrossoverEnabled: true,

    // News Economic Calendar limits
    newsFilterEnabled: true,
    newsFilterBufferMinutes: 30,
    newsFilterMinImpact: 'HIGH',

    // MACD Indicator Rules (12, 26, 9)
    macdEnabled: true,
    macdFastPeriod: 12,
    macdSlowPeriod: 26,
    macdSignalPeriod: 9,
    macdCrossoverEnabled: true,
    macdDivergenceEnabled: true,

    // Multi-Timeframe Strategy
    mtfEnabled: true,
    mtfConfirmTimeframe: 'BOTH',
    mtfConfirmTrend: true,
    mtfConfirmCandlestick: true,

    soundEnabled: true,
    browserAlertsEnabled: true,
    alertOnProfitHit: true,
    alertOnDrawdownHit: true,

    tradingMode: 'AUTOMATIC',
    tradingHoursStart: 0.0,
    tradingHoursEnd: 23.0,
    tradingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  });

  // 2. Main Simulation States
  const [candles, setCandles] = useState<Candle[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<BotStats>({
    initialBalance: INITIAL_BALANCE,
    currentBalance: INITIAL_BALANCE,
    totalOrdersToday: 0,
    maxProfitLimitReached: false,
    maxLossLimitReached: false,
    totalWon: 0,
    totalLost: 0,
  });

  const [economicEvents, setEconomicEvents] = useState<EconomicEvent[]>([]);
  const [newsHaltAlert, setNewsHaltAlert] = useState<string | null>(null);

  // Automation Switcher
  const [activeAutomatedTrading, setActiveAutomatedTrading] = useState(false);
  const [simSpeedSeconds, setSimSpeedSeconds] = useState(3); // 3 seconds resolution by default (Turbo mode)
  const [systemLogs, setSystemLogs] = useState<string[]>([]);
  const [candleProgress, setCandleProgress] = useState(0); // tracks countdown to resolve next bar
  
  // Custom Macro news form states
  const [newEventEvent, setNewEventEvent] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventCurrency, setNewEventCurrency] = useState<'USD' | 'EUR' | 'GBP' | 'JPY'>('USD');
  const [newEventImpact, setNewEventImpact] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  
  // Custom sound and browser notification alerts state
  const [toasts, setToasts] = useState<{ id: string; type: 'profit' | 'drawdown'; title: string; message: string }[]>([]);

  const triggerAlert = (type: 'profit' | 'drawdown', title: string, message: string) => {
    // 1. Play synthesized sound tone if enabled in settings
    const playsSound = settingsRef.current.soundEnabled && (type === 'profit' ? settingsRef.current.alertOnProfitHit : settingsRef.current.alertOnDrawdownHit);
    if (playsSound) {
      playNotificationTone(type);
    }

    // 2. Add visual floating overlay toast if browser alerts are enabled
    if (settingsRef.current.browserAlertsEnabled) {
      const toastId = `alert-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      setToasts((prev) => [...prev, { id: toastId, type, title, message }]);
      
      // Auto close after 7 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toastId));
      }, 7000);

      // Trigger standard system notification if supported and granted permission
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, { body: message });
        } catch (e) {
          console.warn("Failed rendering desktop notification: ", e);
        }
      }
    }
  };

  const currentTicker = 'EUR/USD';

  // Refs to maintain exact real-time reference inside fast tick intervals (prevents state-stale closures)
  const candlesRef = useRef<Candle[]>([]);
  const tradesRef = useRef<Trade[]>([]);
  const statsRef = useRef<BotStats>(stats);
  const settingsRef = useRef<StrategySettings>(settings);
  const activeAutomatedTradingRef = useRef(activeAutomatedTrading);

  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  useEffect(() => {
    tradesRef.current = trades;
  }, [trades]);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  useEffect(() => {
    settingsRef.current = settings;
    // If we transition to MANUAL, make sure we deactivate background engine
    if (settings.tradingMode === 'MANUAL') {
      setActiveAutomatedTrading(false);
    }
  }, [settings]);

  useEffect(() => {
    activeAutomatedTradingRef.current = activeAutomatedTrading;
  }, [activeAutomatedTrading]);

  // Append system logs helper
  const addLog = (msg: string) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setSystemLogs((prev) => [`[${timeStr}] ${msg}`, ...prev.slice(0, 48)]);
  };

  // 3. Setup Initial Seed History
  useEffect(() => {
    const initialHist = generateInitialCandles(180, 1.0945);
    setCandles(initialHist);
    addLog(`Apex Scalper initialized. Loaded 180 historical M1 candles for deep M5 & M15 trend confirmation.`);
    addLog(`Pocket Option API credentials secure. Awaiting scalp trigger events.`);

    // Fetch initial economic calendar from backend API
    fetch('/api/news')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setEconomicEvents(data);
          addLog(`Synchronized ${data.length} economic calendar events from server news feed.`);
        }
      })
      .catch((err) => {
        console.error('Failed fetching calendar news events: ', err);
        addLog(`[WARNING] Server economic news calendar feed offline. Using standard fallback lists.`);
      });
  }, []);

  // 4. Master Fast Simulation Ticker Loop
  useEffect(() => {
    // Standard timer ticking every 150ms 
    const fastTickInterval = setInterval(() => {
      if (candlesRef.current.length === 0) return;

      // Check daily stop boundaries to lock system out
      const currentPnL = ((statsRef.current.currentBalance - INITIAL_BALANCE) / INITIAL_BALANCE) * 100;
      if (currentPnL >= settingsRef.current.maxProfitDailyPercent) {
        if (!statsRef.current.maxProfitLimitReached) {
          setStats((prev) => ({ ...prev, maxProfitLimitReached: true }));
          setActiveAutomatedTrading(false);
          addLog(`[SYSTEM LOCKOUT] DAILY PROFIT CEILING HIT (+${settingsRef.current.maxProfitDailyPercent.toFixed(2)}%). All automated triggers disabled.`);
          triggerAlert(
            'profit',
            'PROFIT TARGET HIT! 🚀',
            `Congratulations! The bot has reached your Daily Profit Target of +${settingsRef.current.maxProfitDailyPercent.toFixed(2)}% (Balance: $${statsRef.current.currentBalance.toFixed(2)}).`
          );
        }
        return;
      }
      if (currentPnL <= -settingsRef.current.maxLossDailyPercent) {
        if (!statsRef.current.maxLossLimitReached) {
          setStats((prev) => ({ ...prev, maxLossLimitReached: true }));
          setActiveAutomatedTrading(false);
          addLog(`[SYSTEM LOCKOUT] EMERGENCY DRAWDOWN BLOCK TRIGGERED (-${settingsRef.current.maxLossDailyPercent.toFixed(2)}%). Bot deactivated strictly.`);
          triggerAlert(
            'drawdown',
            'EMERGENCY DRAWDOWN HALT! ⚠️',
            `Drawdown boundary triggered at -${settingsRef.current.maxLossDailyPercent.toFixed(2)}% (Balance: $${statsRef.current.currentBalance.toFixed(2)}). Algorithmic trading deactivated.`
          );
        }
        return;
      }

      // Check daily orders limit
      if (statsRef.current.totalOrdersToday >= settingsRef.current.maxOrdersPerDay) {
        if (activeAutomatedTradingRef.current) {
          setActiveAutomatedTrading(false);
          addLog(`[SYSTEM LOCKOUT] Maximum daily order cap reached (${settingsRef.current.maxOrdersPerDay}). Deactivating bot.`);
        }
        return;
      }

      // Update current live candle movement
      const updatedCandles = [...candlesRef.current];
      const lastIdx = updatedCandles.length - 1;
      const lastCandle = { ...updatedCandles[lastIdx] };

      // Micro movement simulation (forex fractional pips ticking between 1.0900 and 1.1000)
      const tickChange = (Math.random() - 0.5) * 0.00018; 
      const nextClose = parseFloat((lastCandle.close + tickChange).toFixed(5));
      lastCandle.close = nextClose;
      lastCandle.high = parseFloat(Math.max(lastCandle.high, nextClose).toFixed(5));
      lastCandle.low = parseFloat(Math.min(lastCandle.low, nextClose).toFixed(5));
      
      updatedCandles[lastIdx] = lastCandle;
      setCandles(updatedCandles);

      // Process and update active positions
      let tradesUpdated = false;
      const progressTrades = tradesRef.current.map((trade) => {
        if (trade.status !== 'ACTIVE' && trade.status !== 'TRAILING_ACTIVE') {
          return trade;
        }

        tradesUpdated = true;
        const currentRate = nextClose;
        const entryRate = trade.entryPrice;
        let pips = 0;

        // Calculate absolute pip distance
        if (trade.direction === 'BUY') {
          pips = calculatePips(currentRate, entryRate);
        } else {
          pips = calculatePips(entryRate, currentRate);
        }

        // Initialize updated trade fields
        const updatedTrade = {
          ...trade,
          currentPrice: currentRate,
          pipsProfit: pips,
        };

        // Standard Dynamic Risk math: 0.25% of balance is dynamic allocation.
        // We model a realistic payout ratio or leverage: 
        // Profit percentage of risked baseline = (current relative pips / StopLossPips)
        const riskedAmount = statsRef.current.currentBalance * (settingsRef.current.riskPerOrderPercent / 100);
        const ratio = pips / settingsRef.current.stopLossPips;
        updatedTrade.pnlAmount = parseFloat((riskedAmount * ratio).toFixed(2));

        // -------- TRAILING STOP MANAGER --------
        if (settingsRef.current.useTrailingStop) {
          // If in BUY mode and price spikes up, move stop loss up to lock in profit 5 pips behind price
          if (trade.direction === 'BUY') {
            const potentialSL = parseFloat((currentRate - settingsRef.current.trailingStopPips * 0.0001).toFixed(5));
            if (potentialSL > updatedTrade.currentStopLoss) {
              updatedTrade.currentStopLoss = potentialSL;
              updatedTrade.status = 'TRAILING_ACTIVE';
            }
          } else { // SELL mode
            const potentialSL = parseFloat((currentRate + settingsRef.current.trailingStopPips * 0.0001).toFixed(5));
            if (potentialSL < updatedTrade.currentStopLoss) {
              updatedTrade.currentStopLoss = potentialSL;
              updatedTrade.status = 'TRAILING_ACTIVE';
            }
          }
        }

        // -------- CHECK STOP LOSS AND TAKE PROFIT TRIGGERS --------
        // 1. Take Profit threshold reached
        if (pips >= settingsRef.current.takeProfitPips) {
          updatedTrade.status = 'TP';
          updatedTrade.exitPrice = currentRate;
          updatedTrade.pipsProfit = settingsRef.current.takeProfitPips;
          const winsAmount = parseFloat((riskedAmount * (settingsRef.current.takeProfitPips / settingsRef.current.stopLossPips)).toFixed(2));
          updatedTrade.pnlAmount = winsAmount;
          
          const currentCandleTime = curTimeStr() || trade.timestamp;
          updatedTrade.durationMins = getMinutesDifference(trade.timestamp, currentCandleTime);
          updatedTrade.exitRealTime = Date.now();
          
          setStats((prev) => ({
            ...prev,
            currentBalance: parseFloat((prev.currentBalance + winsAmount).toFixed(2)),
            totalWon: prev.totalWon + 1,
          }));
          addLog(`[TAKE PROFIT HIT] ${trade.direction} ${trade.pair} resolved. Closed at ${currentRate.toFixed(5)}. Gain: +$${winsAmount.toFixed(2)} (+${settingsRef.current.takeProfitPips} pips).`);
        } 
        // 2. Trailing Stop or Original Stop Loss triggered
        else {
          let slBreached = false;
          if (trade.direction === 'BUY') {
            if (currentRate <= updatedTrade.currentStopLoss) {
              slBreached = true;
            }
          } else { // SELL
            if (currentRate >= updatedTrade.currentStopLoss) {
              slBreached = true;
            }
          }

          if (slBreached) {
            updatedTrade.status = 'SL';
            updatedTrade.exitPrice = currentRate;
            
            // Calculate final pips realized at exit stop rate
            let realizedPips = 0;
            if (trade.direction === 'BUY') {
              realizedPips = calculatePips(updatedTrade.currentStopLoss, entryRate);
            } else {
              realizedPips = calculatePips(entryRate, updatedTrade.currentStopLoss);
            }
            updatedTrade.pipsProfit = realizedPips;
            
            const lossAmount = parseFloat((riskedAmount * (realizedPips / settingsRef.current.stopLossPips)).toFixed(2));
            updatedTrade.pnlAmount = lossAmount;

            const currentCandleTime = curTimeStr() || trade.timestamp;
            updatedTrade.durationMins = getMinutesDifference(trade.timestamp, currentCandleTime);
            updatedTrade.exitRealTime = Date.now();

            setStats((prev) => ({
              ...prev,
              currentBalance: parseFloat((prev.currentBalance + lossAmount).toFixed(2)),
              totalLost: prev.totalLost + 1,
            }));

            if (realizedPips >= 0) {
              addLog(`[TRAILING CLOSED] ${trade.direction} ${trade.pair} exited via trailing SL at ${updatedTrade.currentStopLoss.toFixed(5)}. Locked Profit: +$${lossAmount.toFixed(2)} (${realizedPips.toFixed(1)} pips).`);
            } else {
              addLog(`[STOP LOSS TRIGGERED] ${trade.direction} ${trade.pair} hit bounds at ${updatedTrade.currentStopLoss.toFixed(5)}. Loss: -$${Math.abs(lossAmount).toFixed(2)} (${realizedPips.toFixed(1)} pips).`);
            }
          }
        }

        return updatedTrade;
      });

      if (tradesUpdated) {
        setTrades(progressTrades);
      }

    }, 300);

    return () => clearInterval(fastTickInterval);
  }, []);

  // 5. Setup M1 Candle resolution clock
  useEffect(() => {
    const clockInterval = setInterval(() => {
      // Avoid rolling new candles while stats lockout are triggered
      if (stats.maxLossLimitReached || stats.maxProfitLimitReached) return;

      setCandleProgress((prev) => {
        if (prev >= 100) {
          // RESOLVE AND APPEND CANDLE ENTRY
          const curCandles = [...candlesRef.current];
          if (curCandles.length === 0) return 0;

          // Close active candle and initialize variables for the next one
          const lastCandle = { ...curCandles[curCandles.length - 1] };
          
          const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const newCandle: Candle = {
            time: timeNow,
            open: lastCandle.close,
            high: lastCandle.close,
            low: lastCandle.close,
            close: lastCandle.close,
            volume: Math.floor(Math.random() * 120) + 30,
          };

          const extendedSeries = [...curCandles, newCandle];
          // Recalculate indicators across series
          const computedSeries = recalculateIndicators(extendedSeries);
          
          setCandles(computedSeries);

          // Extract M5 and M15 candlesticks
          const m5Candles = aggregateCandles(computedSeries, 5);
          const m15Candles = aggregateCandles(computedSeries, 15);

          // If Automatic Engine is active, query indicators for triggers, passing aggregated timeframes and news
          if (settingsRef.current.tradingMode === 'AUTOMATIC' && activeAutomatedTradingRef.current) {
            const evaluation = checkTradingSignals(computedSeries, settingsRef.current, m5Candles, m15Candles, economicEvents);
            
            // Set alert state for news suspension banner rendering
            setNewsHaltAlert(evaluation.newsFilterAlert || null);

            if (evaluation.signal && evaluation.triggerType) {
              executeIndicatorTrade(evaluation.signal, evaluation.triggerType, lastCandle.close, evaluation.reason);
            } else if (evaluation.newsFilterAlert) {
              addLog(`[NEWS BLOCKED] ${evaluation.reason}`);
            }
          }

          return 0; // reset progress
        }
        // Increment progress relative to speed settings
        const step = 100 / (simSpeedSeconds * 10);
        return prev + step;
      });
    }, 100);

    return () => clearInterval(clockInterval);
  }, [simSpeedSeconds, activeAutomatedTrading, stats, economicEvents]);

  // Helper inside loop to execute automated trades
  const executeIndicatorTrade = (
    direction: 'BUY' | 'SELL', 
    triggerType: 'RSI1' | 'RSI2' | 'EMA_CROSS' | 'MACD_CROSS' | 'MACD_DIV', 
    price: number, 
    reason: string
  ) => {
    // Verify boundaries before acting
    const currentPnL = ((statsRef.current.currentBalance - INITIAL_BALANCE) / INITIAL_BALANCE) * 100;
    if (currentPnL >= settings.maxProfitDailyPercent || currentPnL <= -settings.maxLossDailyPercent) return;
    if (stats.totalOrdersToday >= settings.maxOrdersPerDay) return;

    // Define Stop Loss and Take Profit levels
    const slMove = settings.stopLossPips * 0.0001;
    const tpMove = settings.takeProfitPips * 0.0001;

    const stopLossLevel = direction === 'BUY' 
      ? parseFloat((price - slMove).toFixed(5))
      : parseFloat((price + slMove).toFixed(5));

    const takeProfitLevel = direction === 'BUY'
      ? parseFloat((price + tpMove).toFixed(5))
      : parseFloat((price - tpMove).toFixed(5));

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newTrade: Trade = {
      id: `EX-${Math.floor(Math.random() * 900000 + 100000)}`,
      timestamp: curTimeStr(),
      pair: currentTicker,
      direction: direction,
      entryPrice: price,
      currentPrice: price,
      status: 'ACTIVE',
      pnlPercentage: 0,
      pipsProfit: 0,
      pnlAmount: 0,
      initialStopLoss: stopLossLevel,
      initialTakeProfit: takeProfitLevel,
      currentStopLoss: stopLossLevel,
      triggerType: triggerType,
      entryRealTime: Date.now(),
    };

    setTrades((prev) => [...prev, newTrade]);
    setStats((prev) => ({
      ...prev,
      totalOrdersToday: prev.totalOrdersToday + 1,
    }));

    addLog(`[ALGO SIGNAL] ${reason}. Placing automatic ${direction} trade at ${price.toFixed(5)}.`);
  };

  // Human timestamp finder
  const curTimeStr = () => {
    if (candlesRef.current.length === 0) return '';
    return candlesRef.current[candlesRef.current.length - 1].time;
  };

  // Helper for MANUAL triggers in dashboard
  const handleManualTradeExecution = (direction: 'BUY' | 'SELL') => {
    if (stats.maxLossLimitReached || stats.maxProfitLimitReached) {
      addLog(`[WARNING] Cannot transact. Daily drawdown or profit limits currently locked.`);
      return;
    }

    if (candles.length === 0) return;
    const currentPrice = candles[candles.length - 1].close;

    const slMove = settings.stopLossPips * 0.0001;
    const tpMove = settings.takeProfitPips * 0.0001;

    const stopLossLevel = direction === 'BUY' 
      ? parseFloat((currentPrice - slMove).toFixed(5))
      : parseFloat((currentPrice + slMove).toFixed(5));

    const takeProfitLevel = direction === 'BUY'
      ? parseFloat((currentPrice + tpMove).toFixed(5))
      : parseFloat((currentPrice - tpMove).toFixed(5));

    const newTrade: Trade = {
      id: `MCN-${Math.floor(Math.random() * 900000 + 100000)}`,
      timestamp: curTimeStr(),
      pair: currentTicker,
      direction: direction,
      entryPrice: currentPrice,
      currentPrice: currentPrice,
      status: 'ACTIVE',
      pnlPercentage: 0,
      pipsProfit: 0,
      pnlAmount: 0,
      initialStopLoss: stopLossLevel,
      initialTakeProfit: takeProfitLevel,
      currentStopLoss: stopLossLevel,
      triggerType: 'MANUAL',
      entryRealTime: Date.now(),
    };

    setTrades((prev) => [...prev, newTrade]);
    setStats((prev) => ({
      ...prev,
      totalOrdersToday: prev.totalOrdersToday + 1,
    }));

    addLog(`[MANUAL ORDER] Triggered manual ${direction} order at ${currentPrice.toFixed(5)}.`);
  };

  // Stats restart
  const handleResetStats = () => {
    setStats({
      initialBalance: INITIAL_BALANCE,
      currentBalance: INITIAL_BALANCE,
      totalOrdersToday: 0,
      maxProfitLimitReached: false,
      maxLossLimitReached: false,
      totalWon: 0,
      totalLost: 0,
    });
    setTrades([]);
    addLog(`System balance reinstated to baseline ($${INITIAL_BALANCE}). Simulation indicators and history flushed.`);
  };

  const handleAddNewsEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventEvent || !newEventTime) return;

    fetch('/api/news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: newEventEvent,
        time: newEventTime,
        currency: newEventCurrency,
        impact: newEventImpact,
        forecast: 'N/A',
        previous: 'N/A'
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          // Re-fetch standard feed
          fetch('/api/news')
            .then((r) => r.json())
            .then((list) => {
              if (Array.isArray(list)) {
                setEconomicEvents(list);
              }
            });
          setNewEventEvent('');
          setNewEventTime('');
          addLog(`[MACRO NEWS] Registered new simulated event: "${newEventEvent}" at time ${newEventTime}`);
        }
      })
      .catch((err) => {
        console.error('Failed storing event:', err);
        addLog(`[WARNING] Economic news server connection offline. Adding news element to local state.`);
        // Local fallback
        const mockEv: EconomicEvent = {
          id: `local-${Math.floor(Math.random() * 10000)}`,
          event: newEventEvent,
          time: newEventTime,
          currency: newEventCurrency,
          impact: newEventImpact,
        };
        setEconomicEvents((prev) => [...prev, mockEv]);
        setNewEventEvent('');
        setNewEventTime('');
      });
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between selection:bg-emerald-500/30 selection:text-white pb-6 font-sans">
      
      {/* 1. Bold Typography Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end px-4 sm:px-8 pt-8 pb-4 border-b border-neutral-800 sticky top-0 bg-black/95 backdrop-blur-md z-40 gap-4">
        <div className="flex flex-col">
          <span className={`text-[10px] sm:text-xs font-bold tracking-[0.3em] uppercase mb-2 flex items-center ${
            settings.tradingMode === 'AUTOMATIC' ? 'text-emerald-500' : 'text-amber-500'
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full mr-2 animate-pulse ${
              settings.tradingMode === 'AUTOMATIC' ? 'bg-emerald-500' : 'bg-amber-500'
            }`}></span>
            System Active: {settings.tradingMode} {activeAutomatedTrading ? '• BOT RUNNING' : '• STANDBY'}
          </span>
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tighter leading-none m-0">
            APEX<span className="text-emerald-500">.</span>SCALPER
          </h1>
        </div>
        
        <div className="flex flex-col items-start md:items-end w-full md:w-auto font-mono text-[11px] text-neutral-400 gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-neutral-600 uppercase tracking-widest text-[9px]">API KEY:</span> 
            <span className="text-emerald-400 font-mono tracking-wider">{settings.apiKey.slice(0, 6)}...{settings.apiKey.slice(-4)}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-neutral-600 uppercase tracking-widest text-[9px]">BARS TICK:</span>
            <div className="w-24 h-1.5 bg-neutral-900 rounded-none overflow-hidden border border-neutral-800">
              <div 
                className="h-full bg-emerald-500 transition-all duration-100"
                style={{ width: `${candleProgress}%` }}
              />
            </div>
            <span className="text-emerald-400 font-bold">{Math.ceil(simSpeedSeconds - (candleProgress / 100) * simSpeedSeconds)}s</span>
          </div>

          <div className="text-lg font-light italic tracking-tight font-serif text-neutral-300 mt-1">
            Pocket Option Professional v3.0
          </div>
        </div>
      </header>

      {/* 2. Main Dashboard Layout Area */}
      <main className="max-w-7xl w-full mx-auto px-4 mt-6 flex-1">
        
        {/* Banner Announcement for Limits */}
        {(stats.maxProfitLimitReached || stats.maxLossLimitReached) && (
          <div className={`mb-6 p-4 border flex items-center gap-3 font-mono text-xs leading-relaxed ${
            stats.maxProfitLimitReached 
              ? 'bg-black border-emerald-500 text-emerald-400' 
              : 'bg-black border-rose-500 text-rose-500'
          }`}>
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <div>
              <span className="font-bold uppercase tracking-[0.1em] block mb-1">
                {stats.maxProfitLimitReached ? 'Daily Profit Boundary Achieved' : 'Risk Protection Triggered'}
              </span>
              <span>
                {stats.maxProfitLimitReached 
                  ? `Congratulations! Bot has hit the target of +${settings.maxProfitDailyPercent}% limits. Simulation halted to preserve profit margins.`
                  : `Drawdown protection triggered. Daily balance reached maximum risk budget of -${settings.maxLossDailyPercent}%. Trading loop suspended.`
                }
              </span>
              <button 
                onClick={handleResetStats}
                className="ml-4 underline hover:text-white font-bold inline-block uppercase tracking-wider bg-neutral-900 border border-neutral-850 px-3 py-1 font-sans text-[10px]"
              >
                Re-activate
              </button>
            </div>
          </div>
        )}

        <div className="mb-6 text-xs font-mono text-neutral-400 flex items-center gap-2.5 bg-neutral-950 p-4 border border-neutral-800">
          <Info className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>
            <strong>RSI & Crossover Scalper</strong> monitors M1 Candlesticks constantly. In <strong className="text-white">AUTOMATIC</strong> mode, the quantitative engine enters 0.25% dynamic allocation trades using the custom Stop Loss (5 pips) and Take Profit (10 pips) values. Adjust strategy parameters in real-time below.
          </span>
        </div>

        {/* Dynamic Multi-Metrics */}
        <BotMetrics 
          stats={stats} 
          settings={settings} 
          onResetStats={handleResetStats} 
        />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* LEFT SIDE: Control Dashboard (Span 1) */}
          <div className="lg:col-span-1">
            <BotControlPanel
              settings={settings}
              onChangeSettings={setSettings}
              onExecuteManualTrade={handleManualTradeExecution}
              simSpeedSeconds={simSpeedSeconds}
              onChangeSimSpeed={setSimSpeedSeconds}
              activeAutomatedTrading={activeAutomatedTrading}
              onToggleAutomation={() => setActiveAutomatedTrading(!activeAutomatedTrading)}
              trades={trades}
              candles={candles}
            />
          </div>

          {/* MIDDLE AREA: Chart View & System terminal (Span 2) */}
          <div className="lg:col-span-2 space-y-6">
            <TradingChart
              candles={candles}
              trades={trades}
              currentTicker={currentTicker}
            />

            {/* REAL-TIME SYSTEM LOG TERMINAL */}
            <div className="bg-black border border-neutral-800 p-5 font-mono text-xs overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
                <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-semibold flex items-center gap-1.5 leading-none">
                  <TerminalIcon className="w-3.5 h-3.5 text-emerald-500" />
                  Apex Scalper Terminal Log
                </span>
                <span className="text-[9px] bg-neutral-900 text-white border border-neutral-800 px-2 py-0.5 font-mono">
                  Listening...
                </span>
              </div>

              <div className="h-40 overflow-y-auto space-y-1.5 pr-1 leading-relaxed">
                {systemLogs.length === 0 ? (
                  <div className="text-neutral-605 italic py-4">Waiting for execution ticks...</div>
                ) : (
                  systemLogs.map((log, index) => (
                    <div 
                      key={index} 
                      className={`text-[11px] hover:bg-neutral-900/40 py-0.5 rounded ${
                        log.includes('[TAKE PROFIT') || log.includes('TP hit') ? 'text-emerald-400 font-bold' :
                        log.includes('[STOP LOSS') || log.includes('[WARNING]') ? 'text-rose-500 font-bold' :
                        log.includes('[ALGO SIGNAL') ? 'text-purple-400' :
                        log.includes('[MANUAL') ? 'text-amber-500 font-bold' :
                        'text-neutral-300'
                      }`}
                    >
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: Transactions ledger & AI Optimizer (Span 1) */}
          <div className="lg:col-span-1 space-y-6">
            <TradeHistoryList trades={trades} settings={settings} />
            <AIPortfolioAdvisor 
              settings={settings} 
              stats={stats} 
              trades={trades} 
            />
          </div>

        </div>

        {/* Advanced Quantitative & Macro Bento Box */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Bento 1: Economic News risk blockout schedule */}
          <div className="bg-black border border-neutral-800 p-5 font-sans">
            <h3 className="text-xs font-black uppercase tracking-[0.25em] text-neutral-400 border-b border-neutral-800 pb-2.5 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Newspaper className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                <span>Economic Data Calendar</span>
              </span>
              <span className="text-[9px] px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 text-neutral-400">
                Halt Buffer: {settings.newsFilterBufferMinutes}m
              </span>
            </h3>

            {newsHaltAlert && (
              <div className="bg-amber-950/40 border border-amber-500/55 p-3 mb-4 flex items-center gap-2.5 text-xs text-amber-300 animate-pulse font-mono leading-normal">
                <Hourglass className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{newsHaltAlert}</span>
              </div>
            )}

            <div className="space-y-3 max-h-48 overflow-y-auto mb-4 scrollbar-thin">
              {economicEvents.map((ev) => {
                const isNearHash = candles.length > 0 
                  ? getMinutesDifference(candles[candles.length - 1].time, ev.time) <= settings.newsFilterBufferMinutes
                  : false;
                
                return (
                  <div 
                    key={ev.id} 
                    className={`p-2.5 border transition-all ${
                      isNearHash 
                        ? 'bg-amber-950/20 border-amber-500/50' 
                        : 'bg-neutral-950 border-neutral-900'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold flex items-center gap-1.5">
                        <span className={`px-1 rounded text-[9px] font-mono ${
                          ev.impact === 'HIGH' ? 'bg-rose-950 text-rose-400' : 'bg-neutral-800 text-neutral-450'
                        }`}>
                          {ev.impact}
                        </span>
                        <span className="text-neutral-200">{ev.event}</span>
                      </span>
                      <span className="font-mono text-[10px] text-amber-500 font-bold">{ev.time}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-neutral-550 font-mono mt-1 border-t border-neutral-900 pt-1">
                      <span>Cur: {ev.currency}</span>
                      <span>Fore: {ev.forecast || 'N/A'}</span>
                      <span>Prev: {ev.previous || 'N/A'}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom Economic Trigger Form */}
            <form onSubmit={handleAddNewsEvent} className="border-t border-neutral-800 pt-3">
              <span className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Simulate Custom Economic Event</span>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="text"
                  placeholder="e.g. FOMC Meeting"
                  value={newEventEvent}
                  onChange={(e) => setNewEventEvent(e.target.value)}
                  className="bg-neutral-950 border border-neutral-850 p-1.5 text-xs text-white focus:outline-none focus:border-neutral-700"
                  required
                />
                <input
                  type="text"
                  placeholder="Time e.g., 18:35:00"
                  value={newEventTime}
                  onChange={(e) => setNewEventTime(e.target.value)}
                  className="bg-neutral-950 border border-neutral-850 p-1.5 text-xs text-white font-mono focus:outline-none focus:border-neutral-700 text-center"
                  required
                />
                <select
                  value={newEventCurrency}
                  onChange={(e) => setNewEventCurrency(e.target.value as any)}
                  className="bg-neutral-950 border border-neutral-850 p-1 text-xs text-neutral-300 font-mono focus:outline-none"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="JPY">JPY</option>
                </select>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-sans text-[10px] font-bold tracking-widest uppercase transition-all"
                >
                  ADD EVENT
                </button>
              </div>
            </form>
          </div>

          {/* Bento 2: MACD Indicator Gauge live readout */}
          <div className="bg-black border border-neutral-800 p-5 font-sans">
            <h3 className="text-xs font-black uppercase tracking-[0.25em] text-neutral-400 border-b border-neutral-800 pb-2.5 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <BarChart2 className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                <span>MACD Technical Readout</span>
              </span>
              <span className="text-[9px] px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 text-neutral-400 font-mono">
                12, 26, 9
              </span>
            </h3>

            {(() => {
              if (candles.length === 0) return null;
              const lastCandle = candles[candles.length - 1];
              const macdVal = lastCandle.macdLine ?? 0;
              const signalVal = lastCandle.macdSignal ?? 0;
              const histVal = lastCandle.macdHist ?? 0;

              const isHistogramUp = histVal >= 0;

              return (
                <div className="space-y-4">
                  {/* Digital Telemetry Gauge */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-neutral-950 border border-neutral-900 p-3 flex flex-col items-center">
                      <span className="text-[9px] text-neutral-400 font-mono uppercase tracking-widest mb-1">MACD</span>
                      <span className={`text-[13px] font-mono font-bold ${macdVal >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                        {macdVal.toFixed(5)}
                      </span>
                    </div>
                    <div className="bg-neutral-950 border border-neutral-900 p-3 flex flex-col items-center">
                      <span className="text-[9px] text-neutral-400 font-mono uppercase tracking-widest mb-1">SIGNAL</span>
                      <span className="text-[13px] font-mono font-bold text-neutral-200">
                        {signalVal.toFixed(5)}
                      </span>
                    </div>
                    <div className="bg-neutral-950 border border-neutral-900 p-3 flex flex-col items-center">
                      <span className="text-[9px] text-neutral-400 font-mono uppercase tracking-widest mb-1">HISTOGRAM</span>
                      <span className={`text-[13px] font-mono font-bold ${isHistogramUp ? 'text-emerald-400' : 'text-rose-500'}`}>
                        {histVal.toFixed(5)}
                      </span>
                    </div>
                  </div>

                  {/* Visual Histogram Sweller bar */}
                  <div className="p-3 bg-neutral-950 border border-neutral-900">
                    <span className="text-[9px] text-neutral-500 font-mono uppercase tracking-wider block mb-2">Histogram Pressure Oscillation</span>
                    <div className="flex h-12 gap-1 items-end justify-center">
                      {/* Negative Side */}
                      <div className="flex-1 flex justify-end">
                        {!isHistogramUp && (
                          <div 
                            className="bg-rose-500 border border-rose-600 w-full" 
                            style={{ height: `${Math.min(100, Math.abs(histVal) * 150000)}%` }}
                          />
                        )}
                      </div>
                      <div className="w-0.5 bg-neutral-800 h-full mx-1" />
                      {/* Positive Side */}
                      <div className="flex-1">
                        {isHistogramUp && (
                          <div 
                            className="bg-emerald-500 border border-emerald-600 w-full" 
                            style={{ height: `${Math.min(100, Math.abs(histVal) * 150000)}%` }}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Subtitle summary */}
                  <div className="p-2.5 border border-dashed border-neutral-800 text-[10px] font-mono text-neutral-400 text-center">
                    Crossovers checked on candles shift 1 in real-time. Divergence scanned over past 15 periods.
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Bento 3: Multi-Timeframe confirmation engine (M5 & M15) */}
          <div className="bg-black border border-neutral-800 p-5 font-sans">
            <h3 className="text-xs font-black uppercase tracking-[0.25em] text-neutral-400 border-b border-neutral-800 pb-2.5 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Layers2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Multi-Timeframe Validation</span>
              </span>
              <span className="text-[9px] px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 text-neutral-400">
                M5 & M15 trend confirmation
              </span>
            </h3>

            {(() => {
              const m5C = aggregateCandles(candles, 5);
              const m15C = aggregateCandles(candles, 15);

              const lastM5 = m5C[m5C.length - 1];
              const lastM15 = m15C[m15C.length - 1];

              const formatTFCandle = (tf: string, c?: Candle) => {
                if (!c) return <div className="text-neutral-500 italic text-[11px] py-4">Generating {tf} candlestick benchmarks...</div>;
                const isBullish = c.close >= c.open;
                const matchesEMA = c.ema21 !== undefined;
                const hasTrend = matchesEMA ? (c.close > c.ema21 ? 'BULLISH' : 'BEARISH') : 'N/A';
                
                return (
                  <div className="p-2.5 bg-neutral-950 border border-neutral-900 space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-neutral-200">{tf} Status Bar</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-mono tracking-widest ${
                        hasTrend === 'BULLISH' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-450'
                      }`}>
                        {hasTrend} TREND
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-neutral-500 pt-1 border-t border-neutral-900">
                      <div>Candle: <span className={isBullish ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{isBullish ? 'GREEN' : 'RED'}</span></div>
                      <div>EMA21: <span className="text-neutral-300">{c.ema21?.toFixed(5) || 'N/A'}</span></div>
                      <div>Close: <span className="text-neutral-300">{c.close.toFixed(5)}</span></div>
                      <div>State: <span className="text-neutral-400 font-bold">Closed</span></div>
                    </div>
                  </div>
                );
              };

              return (
                <div className="space-y-4">
                  {formatTFCandle('M5', lastM5)}
                  {formatTFCandle('M15', lastM15)}

                  <div className="bg-neutral-950 border border-neutral-900 px-3 py-2 flex items-center gap-2 text-[10px] text-neutral-400 font-mono justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                    <span>Active Checks: {settings.mtfConfirmTrend ? 'Trend' : ''} {settings.mtfConfirmCandlestick ? '• Candles' : ''}</span>
                  </div>
                </div>
              );
            })()}
          </div>

        </div>

      </main>

      {/* 3. Bold Design Footer */}
      <footer className="h-auto md:h-16 flex flex-col md:flex-row items-center justify-between px-8 py-6 md:py-0 border-t border-neutral-800 text-[10px] uppercase tracking-[0.3em] font-bold text-neutral-500 gap-4 mt-12 bg-black">
        <div className="flex flex-wrap gap-4 md:space-x-12 justify-center">
          <span>Trading Days: {settings.tradingDays.length === 7 ? 'Mon-Sun' : 'Configured'}</span>
          <span>Hours: {Math.floor(settings.tradingHoursStart).toString().padStart(2, '0')}:00 - {Math.floor(settings.tradingHoursEnd).toString().padStart(2, '0')}:00</span>
          <span>Platform: Pocket Option</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Server Status: Frankfurt-01</span>
          <div className="flex space-x-1">
            <div className="w-1.5 h-3 bg-emerald-500"></div>
            <div className="w-1.5 h-3 bg-emerald-500"></div>
            <div className="w-1.5 h-3 bg-emerald-500"></div>
            <div className="w-1.5 h-3 bg-neutral-700"></div>
          </div>
        </div>
      </footer>

      {/* Floating Toast Notification Containers */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full" id="trading-alerts-stack">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`p-4 border shadow-2xl relative flex flex-col gap-1 text-xs font-mono transition-all duration-300 animate-pulse border-l-4 ${
                toast.type === 'profit'
                  ? 'bg-neutral-950 border-emerald-500 border-l-emerald-400 text-emerald-400 shadow-emerald-950/20'
                  : 'bg-neutral-950 border-rose-950 border-l-rose-500 text-rose-450 shadow-rose-950/20'
              }`}
            >
              <div className="flex items-center justify-between font-bold border-b pb-1.5 mb-1.5 border-neutral-900">
                <span className="flex items-center gap-1.5 font-sans tracking-wide text-[11px] uppercase">
                  <Bell className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  {toast.title}
                </span>
                <button
                  type="button"
                  onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                  className="text-neutral-500 hover:text-white transition-colors duration-200 text-lg leading-none"
                >
                  &times;
                </button>
              </div>
              <div className="text-neutral-300 font-sans leading-relaxed text-[11px]">
                {toast.message}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
