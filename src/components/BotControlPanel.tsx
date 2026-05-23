import React from 'react';
import { StrategySettings, TradingMode, Trade, Candle } from '../types';
import { Play, Pause, Sliders, Layers, Clock, Zap, Target, Bell, Save, FolderOpen, Trash2, ArrowUpRight, Clock3, TrendingUp, DollarSign } from 'lucide-react';
import { playNotificationTone } from '../utils/audio';

const SYSTEM_PRESETS = [
  {
    id: 'hft-scalper',
    name: 'VoltScalp HFT',
    description: 'Ultra Tight SL/TP with MACD & RSI triggers for high-turnover scalping.',
    badge: 'SCALPER M1',
    settings: {
      riskPerOrderPercent: 0.50,
      maxOrdersPerDay: 500,
      stopLossPips: 3,
      takeProfitPips: 6,
      useTrailingStop: true,
      trailingStopPips: 3,
      rsi1Enabled: true,
      rsi1Period: 5,
      rsi1SellLevel: 25,
      rsi1BuyLevel: 75,
      rsi2Enabled: true,
      rsi2Period: 5,
      rsi2SellLevel: 75,
      rsi2BuyLevel: 25,
      emaCrossoverEnabled: false,
      macdEnabled: true,
      macdCrossoverEnabled: true,
      macdDivergenceEnabled: false,
      mtfEnabled: false,
      newsFilterEnabled: false,
    }
  },
  {
    id: 'conservative-trend',
    name: 'Guardian Trend',
    description: 'Defensive parameters with deep Multi-Timeframe filters and news data halt protection.',
    badge: 'TREND RETRACE',
    settings: {
      riskPerOrderPercent: 0.10,
      maxOrdersPerDay: 150,
      stopLossPips: 12,
      takeProfitPips: 24,
      useTrailingStop: true,
      trailingStopPips: 8,
      rsi1Enabled: false,
      rsi2Enabled: false,
      emaCrossoverEnabled: true,
      macdEnabled: true,
      macdCrossoverEnabled: true,
      macdDivergenceEnabled: true,
      mtfEnabled: true,
      mtfConfirmTimeframe: 'BOTH' as any,
      mtfConfirmTrend: true,
      mtfConfirmCandlestick: true,
      newsFilterEnabled: true,
      newsFilterBufferMinutes: 45,
      newsFilterMinImpact: 'HIGH' as any,
    }
  },
  {
    id: 'macd-momentum',
    name: 'MACD Wave Rider',
    description: 'Specifically engineered to capture momentum extensions with MACD divergence validation.',
    badge: 'MOMENTUM M5',
    settings: {
      riskPerOrderPercent: 0.25,
      maxOrdersPerDay: 300,
      stopLossPips: 6,
      takeProfitPips: 15,
      useTrailingStop: false,
      rsi1Enabled: false,
      rsi2Enabled: false,
      emaCrossoverEnabled: true,
      macdEnabled: true,
      macdCrossoverEnabled: true,
      macdDivergenceEnabled: true,
      mtfEnabled: true,
      mtfConfirmTimeframe: 'M5' as any,
      mtfConfirmTrend: true,
      mtfConfirmCandlestick: false,
      newsFilterEnabled: false,
    }
  }
];

interface BotControlPanelProps {
  settings: StrategySettings;
  onChangeSettings: (newSettings: StrategySettings) => void;
  onExecuteManualTrade: (direction: 'BUY' | 'SELL') => void;
  simSpeedSeconds: number;
  onChangeSimSpeed: (speedSeconds: number) => void;
  activeAutomatedTrading: boolean;
  onToggleAutomation: () => void;
  trades?: Trade[];
  candles?: Candle[];
}

export function BotControlPanel({
  settings,
  onChangeSettings,
  onExecuteManualTrade,
  simSpeedSeconds,
  onChangeSimSpeed,
  activeAutomatedTrading,
  onToggleAutomation,
  trades = [],
  candles = [],
 }: BotControlPanelProps) {
  
  const [userPresets, setUserPresets] = React.useState<{ name: string; timestamp: string; settings: Partial<StrategySettings> }[]>([]);
  const [newPresetName, setNewPresetName] = React.useState('');

  React.useEffect(() => {
    const stored = localStorage.getItem('custom-trading-presets');
    if (stored) {
      try {
        setUserPresets(JSON.parse(stored));
      } catch (e) {
        console.error("Failed loading custom trading presets", e);
      }
    }
  }, []);

  const handleLoadPreset = (presetSettings: Partial<StrategySettings>, presetName: string) => {
    const merged = {
      ...settings,
      ...presetSettings,
      platform: settings.platform,
      apiKey: settings.apiKey,
    };
    onChangeSettings(merged as StrategySettings);
    playNotificationTone('trade');
  };

  const handleSaveCustomPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;

    const currentConfig = { ...settings, apiKey: '' }; // secure strip credentials
    const newPreset = {
      name: newPresetName.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      settings: currentConfig,
    };

    const updated = [...userPresets.filter(p => p.name.toLowerCase() !== newPreset.name.toLowerCase()), newPreset];
    setUserPresets(updated);
    localStorage.setItem('custom-trading-presets', JSON.stringify(updated));
    setNewPresetName('');
    playNotificationTone('trade');
  };

  const handleDeleteCustomPreset = (nameToDel: string) => {
    const updated = userPresets.filter(p => p.name !== nameToDel);
    setUserPresets(updated);
    localStorage.setItem('custom-trading-presets', JSON.stringify(updated));
  };

  const handleModeChange = (mode: TradingMode) => {
    onChangeSettings({ ...settings, tradingMode: mode });
  };

  const updateField = (key: keyof StrategySettings, val: any) => {
    onChangeSettings({
      ...settings,
      [key]: val,
    });
  };

  // --- STRATEGY EFFECTIVENESS & METRICS COMPUTATION ---
  const closedTrades = React.useMemo(() => {
    return (trades || []).filter(t => t.status === 'TP' || t.status === 'SL');
  }, [trades]);
  
  // 1. Average Trade Duration
  const durationSum = React.useMemo(() => {
    return closedTrades.reduce((sum, t) => {
      if (t.durationMins !== undefined) {
        return sum + t.durationMins;
      }
      if (t.entryRealTime && t.exitRealTime) {
        return sum + (t.exitRealTime - t.entryRealTime) / (1000 * 60);
      }
      return sum;
    }, 0);
  }, [closedTrades]);

  const avgDurationMins = closedTrades.length > 0 ? durationSum / closedTrades.length : 0;

  const formatDuration = (mins: number) => {
    if (mins <= 0) return '——';
    if (mins < 1) {
      const secs = Math.round(mins * 60);
      return `${secs}s`;
    }
    const dMins = Math.floor(mins);
    const dSecs = Math.round((mins - dMins) * 60);
    return dSecs > 0 ? `${dMins}m ${dSecs}s` : `${dMins}m`;
  };

  // Helper breakdown win vs loss durations
  const winTrades = React.useMemo(() => {
    return closedTrades.filter(t => t.status === 'TP' || t.pnlAmount > 0);
  }, [closedTrades]);

  const lossTrades = React.useMemo(() => {
    return closedTrades.filter(t => t.status === 'SL' && t.pnlAmount <= 0);
  }, [closedTrades]);

  const winDurationSum = React.useMemo(() => {
    return winTrades.reduce((sum, t) => sum + (t.durationMins ?? 0), 0);
  }, [winTrades]);
  const avgWinDuration = winTrades.length > 0 ? winDurationSum / winTrades.length : 0;

  const lossDurationSum = React.useMemo(() => {
    return lossTrades.reduce((sum, t) => sum + (t.durationMins ?? 0), 0);
  }, [lossTrades]);
  const avgLossDuration = lossTrades.length > 0 ? lossDurationSum / lossTrades.length : 0;

  // 2. Profit-Per-Hour Metrics
  // A. Simulated/Backtest hours
  const elapsedSimMinutes = React.useMemo(() => {
    if (candles && candles.length > 1) {
      const parseTime = (tString: string) => {
        const parts = tString.split(':');
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        return h * 60 + m;
      };
      const firstMinutes = parseTime(candles[0].time);
      const lastMinutes = parseTime(candles[candles.length - 1].time);
      let diff = lastMinutes - firstMinutes;
      if (diff < 0) diff += 24 * 60; // midnight wrap
      return diff || candles.length;
    } else if (candles) {
      return candles.length;
    }
    return 0;
  }, [candles]);

  const netSimProfit = React.useMemo(() => {
    return closedTrades.reduce((sum, t) => sum + (t.pnlAmount || 0), 0);
  }, [closedTrades]);

  const simProfitPerHour = elapsedSimMinutes > 0 ? (netSimProfit * 60) / elapsedSimMinutes : 0;

  // B. Real-time hours (Since component mounted)
  const mountTimeRef = React.useRef(Date.now());
  const [currentTime, setCurrentTime] = React.useState(Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000); // update every 10 seconds for real-time metric
    return () => clearInterval(timer);
  }, []);

  const elapsedRealMs = currentTime - mountTimeRef.current;
  const elapsedRealHours = elapsedRealMs / (1000 * 60 * 60);
  const realProfitPerHour = elapsedRealHours > 0 ? netSimProfit / elapsedRealHours : 0;

  // Extra context metrics: Profit Factor
  const profitFactor = React.useMemo(() => {
    let grossProfits = 0;
    let grossLosses = 0;
    closedTrades.forEach(t => {
      if (t.pnlAmount > 0) {
        grossProfits += t.pnlAmount;
      } else {
        grossLosses += Math.abs(t.pnlAmount);
      }
    });
    return grossLosses > 0 ? (grossProfits / grossLosses).toFixed(2) : grossProfits > 0 ? '∞' : '0.00';
  }, [closedTrades]);

  return (
    <div className="space-y-6">
      
      {/* SECTION 1: Master Operation Control */}
      <div className="bg-black p-5 border border-neutral-800 font-sans">
        <h3 className="text-xs font-black uppercase tracking-[0.25em] text-neutral-400 border-b border-neutral-800 pb-2.5 mb-4 flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-emerald-500" />
          <span>Execution Engine Mode</span>
        </h3>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => handleModeChange('AUTOMATIC')}
            className={`py-2 px-3 font-mono text-[11px] font-black tracking-widest transition-all border ${
              settings.tradingMode === 'AUTOMATIC'
                ? 'bg-neutral-900 text-emerald-400 border-emerald-500/50'
                : 'bg-black text-neutral-500 border-neutral-800 hover:bg-neutral-900 hover:text-white'
            }`}
          >
            AUTOMATIC
          </button>
          
          <button
            onClick={() => handleModeChange('MANUAL')}
            className={`py-2 px-3 font-mono text-[11px] font-black tracking-widest transition-all border ${
              settings.tradingMode === 'MANUAL'
                ? 'bg-neutral-900 text-amber-500 border-amber-500/50'
                : 'bg-black text-neutral-500 border-neutral-800 hover:bg-neutral-900 hover:text-white'
            }`}
          >
            MANUAL
          </button>
        </div>

        {settings.tradingMode === 'AUTOMATIC' ? (
          <div className="space-y-3">
            <button
              onClick={onToggleAutomation}
              className={`w-full py-3 px-4 font-sans font-black text-xs tracking-widest flex items-center justify-center gap-2 transition-all uppercase ${
                activeAutomatedTrading
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-white hover:bg-emerald-500 text-black'
              }`}
            >
              {activeAutomatedTrading ? (
                <>
                  <Pause className="w-4 h-4 shrink-0" />
                  <span>STOP AUTOMATED AGENT</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 shrink-0" />
                  <span>START AUTOMATED AGENT</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-neutral-500 font-mono text-center">
              Active Session: Continuous Loop | Mon-Sun
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onExecuteManualTrade('BUY')}
                className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-sans font-black text-[11px] tracking-widest uppercase transition-all"
              >
                BUY (LONG)
              </button>
              <button
                onClick={() => onExecuteManualTrade('SELL')}
                className="py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-sans font-black text-[11px] tracking-widest uppercase transition-all"
              >
                SELL (SHORT)
              </button>
            </div>
            <p className="text-[10px] text-neutral-500 font-mono text-center leading-relaxed">
              Inject contract into ticker. Selected Stop Loss and Take Profit levels apply instantly.
            </p>
          </div>
        )}
      </div>

      {/* SECTION 1.5: STRATEGY CONFIGURATION PROFILES */}
      <div className="bg-black p-5 border border-neutral-800">
        <h3 className="text-xs font-black uppercase tracking-[0.25em] text-neutral-400 border-b border-neutral-800 pb-2.5 mb-4 flex items-center gap-2">
          <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
          <span>Strategy Configuration Profiles</span>
        </h3>

        <div className="space-y-4">
          <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">
            System Backtest Presets
          </p>
          
          <div className="space-y-2.5">
            {SYSTEM_PRESETS.map((preset) => {
              const isActive = settings.stopLossPips === preset.settings.stopLossPips && 
                               settings.takeProfitPips === preset.settings.takeProfitPips &&
                               settings.riskPerOrderPercent === preset.settings.riskPerOrderPercent;
                               
              return (
                <div 
                  key={preset.id} 
                  className={`p-3 border transition-all ${
                    isActive 
                      ? 'bg-neutral-900/60 border-amber-500/40' 
                      : 'bg-neutral-950 border-neutral-900 hover:border-neutral-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold text-neutral-200 block">{preset.name}</span>
                      <span className="text-[9px] font-mono text-amber-500 uppercase tracking-widest">{preset.badge}</span>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => handleLoadPreset(preset.settings, preset.name)}
                      className={`py-1 px-2.5 text-[9px] font-mono font-bold tracking-widest uppercase transition-all ${
                        isActive
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-default'
                          : 'bg-neutral-900 text-neutral-300 border border-neutral-800 hover:bg-white hover:text-black hover:border-white'
                      }`}
                    >
                      {isActive ? 'ACTIVE' : 'LOAD PROFILE'}
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-1.5 leading-relaxed font-sans">
                    {preset.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* User defined custom presets */}
          <div className="border-t border-neutral-900 pt-4 font-sans">
            <span className="block text-[10px] uppercase font-mono tracking-wider text-neutral-500 mb-2.5">
              Custom Scalper Profiles
            </span>

            {userPresets.length === 0 ? (
              <div className="p-3 bg-neutral-950 border border-neutral-900 text-center text-neutral-650 text-[10px] font-mono">
                No custom profiles saved. Configure parameters below and save!
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {userPresets.map((up) => (
                  <div key={up.name} className="flex items-center justify-between p-2.5 bg-neutral-950 border border-neutral-900 text-[11px] font-sans">
                    <div className="min-w-0 flex-1">
                      <span className="text-neutral-200 font-bold block truncate">{up.name}</span>
                      <span className="text-[9px] font-mono text-neutral-550">Saved: {up.timestamp}</span>
                    </div>
                    <div className="flex gap-1.5 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => handleLoadPreset(up.settings, up.name)}
                        className="py-1 px-2.5 bg-neutral-900 text-neutral-300 border border-neutral-800 hover:bg-neutral-850 hover:text-white text-[9px] font-mono uppercase tracking-wider transition-all"
                      >
                        LOAD
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomPreset(up.name)}
                        className="p-1.5 bg-neutral-900 text-rose-500 border border-neutral-800 hover:bg-rose-950/30 hover:text-rose-450 hover:border-rose-950 transition-all flex items-center justify-center"
                        title="Delete Preset"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Save current settings form */}
            <form onSubmit={handleSaveCustomPreset} className="mt-3 flex gap-2 font-sans">
              <input
                type="text"
                maxLength={25}
                placeholder="Profile label, e.g., Gold Scalper"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                className="flex-1 bg-neutral-950 border border-neutral-850 p-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-700 font-sans"
              />
              <button
                type="submit"
                disabled={!newPresetName.trim()}
                className="px-3 bg-emerald-650 hover:bg-emerald-555 disabled:bg-neutral-900 disabled:text-neutral-600 border border-transparent disabled:border-neutral-850 text-white font-mono text-[10px] font-black tracking-widest uppercase transition-all flex items-center gap-1.5 shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>SAVE ACTIVE</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* SECTION 1.6: STRATEGY EFFICIENCY & METRICS */}
      <div className="bg-black p-5 border border-neutral-800">
        <h3 className="text-xs font-black uppercase tracking-[0.25em] text-neutral-400 border-b border-neutral-800 pb-2.5 mb-4 flex items-center gap-2">
          <Clock3 className="w-3.5 h-3.5 text-orange-500" />
          <span>Strategy Efficiency & Metrics</span>
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Metric 1: Average Trade Duration */}
            <div className="p-3 bg-neutral-950 border border-neutral-900 flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest block mb-1">Avg Duration</span>
                <span className="text-sm font-mono font-bold text-neutral-200 block">{formatDuration(avgDurationMins)}</span>
              </div>
              <div className="mt-2 pt-1.5 border-t border-neutral-900/65 flex flex-col gap-0.5">
                <span className="text-[8px] font-mono text-emerald-500">Wins: {formatDuration(avgWinDuration)}</span>
                <span className="text-[8px] font-mono text-rose-500">Losses: {formatDuration(avgLossDuration)}</span>
              </div>
            </div>

            {/* Metric 2: Profit Factor */}
            <div className="p-3 bg-neutral-950 border border-neutral-900 flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest block mb-1">Profit Factor</span>
                <span className={`text-sm font-mono font-bold block ${
                  profitFactor === '0.00' ? 'text-neutral-400' :
                  parseFloat(profitFactor) >= 1.5 ? 'text-emerald-400' :
                  parseFloat(profitFactor) >= 1.0 ? 'text-amber-500' : 'text-rose-500'
                }`}>
                  {profitFactor}
                </span>
              </div>
              <span className="text-[8px] font-sans text-neutral-500 mt-2 block leading-normal">
                {parseFloat(profitFactor) >= 1.5 ? 'Excellent edge' : 
                 parseFloat(profitFactor) >= 1.0 ? 'Positive return' : 
                 closedTrades.length > 0 ? 'Negative return' : 'No trades registered'}
              </span>
            </div>

            {/* Metric 3: Profit per Sim Hour */}
            <div className="p-3 bg-neutral-950 border border-neutral-900">
              <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest block mb-1">Profit/Hour (Sim)</span>
              <span className={`text-xs font-mono font-bold block ${
                simProfitPerHour > 0 ? 'text-emerald-400' :
                simProfitPerHour < 0 ? 'text-rose-400' : 'text-neutral-400'
              }`}>
                {simProfitPerHour > 0 ? '+' : ''}${simProfitPerHour.toFixed(2)}/hr
              </span>
              <span className="text-[8px] font-mono text-neutral-500 mt-1 block leading-normal uppercase">
                {elapsedSimMinutes} simulated mins
              </span>
            </div>

            {/* Metric 4: Profit per Real Hour */}
            <div className="p-3 bg-neutral-950 border border-neutral-900">
              <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest block mb-1">Profit/Hour (Real)</span>
              <span className={`text-xs font-mono font-bold block ${
                realProfitPerHour > 0 ? 'text-emerald-400' :
                realProfitPerHour < 0 ? 'text-rose-400' : 'text-neutral-400'
              }`}>
                {realProfitPerHour > 0 ? '+' : ''}${realProfitPerHour.toFixed(2)}/hr
              </span>
              <span className="text-[8px] font-mono text-neutral-500 mt-1 block leading-normal uppercase">
                Run for {elapsedRealMs < 60000 ? `${Math.round(elapsedRealMs/1000)}s` : `${Math.round(elapsedRealMs/60000)}m`}
              </span>
            </div>
          </div>

          <div className="p-2.5 bg-neutral-950/40 border border-neutral-900 font-sans text-[10px] text-neutral-400 leading-relaxed">
            <span className="font-bold text-neutral-300 block mb-1">Strategy Effectiveness Assessment</span>
            {closedTrades.length === 0 ? (
              <p>Simulate some orders to evaluate whether this scalping configuration is profitable per hour and maintains tight exit times.</p>
            ) : (
              <p>
                {avgDurationMins < 5 ? '⚡ High-velocity configuration: ' : '📈 Trend follower configuration: '}
                Average holding time is <strong className="text-neutral-200">{formatDuration(avgDurationMins)}</strong>. 
                {parseFloat(profitFactor) >= 1.0 
                  ? ' The active strategy holds a positive profit index. Ensure news filter shields are active to protect this hourly yield.' 
                  : ' The strategy currently experiences a negative hourly yield. Fine-tune your MACD trigger indicators or tighten Stop-Loss levels.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: Trading Speed Simulator Backtest */}
      <div className="bg-black p-5 border border-neutral-800">
        <h3 className="text-xs font-black uppercase tracking-[0.25em] text-neutral-400 border-b border-neutral-800 pb-2.5 mb-3 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-cyan-500" />
          <span>Simulation Speed Engine</span>
        </h3>
        
        <div className="grid grid-cols-3 gap-1 mb-2">
          {[
            { label: 'Regular', value: 60, icon: '⏱️' },
            { label: 'Fast', value: 10, icon: '⚡' },
            { label: 'Turbo', value: 3, icon: '🔥' }
          ].map((sp) => (
            <button
              key={sp.value}
              onClick={() => onChangeSimSpeed(sp.value)}
              className={`p-2 transition-all border flex flex-col items-center justify-center ${
                simSpeedSeconds === sp.value
                  ? 'bg-neutral-900 border-cyan-500/50 text-cyan-400'
                  : 'bg-black text-neutral-550 border-neutral-800 hover:bg-neutral-900 hover:text-white'
              }`}
            >
              <span className="text-sm mb-0.5">{sp.icon}</span>
              <span className="text-[9px] font-mono leading-none font-black uppercase tracking-wider">{sp.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 3: Indicator Strategic Rules */}
      <div className="bg-black p-5 border border-neutral-800">
        <h3 className="text-xs font-black uppercase tracking-[0.25em] text-neutral-400 border-b border-neutral-800 pb-2.5 mb-4 flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-purple-400" />
          <span>Entry Signal Parameters</span>
        </h3>

        <div className="space-y-4">
          {/* RULE 1: RSI CLOSE */}
          <div className="p-3 bg-neutral-950 border border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <span className="font-sans font-bold text-xs text-neutral-200">RSI Close Momentum</span>
              <input
                type="checkbox"
                checked={settings.rsi1Enabled}
                onChange={(e) => updateField('rsi1Enabled', e.target.checked)}
                className="w-4 h-4 text-emerald-600 bg-black border-neutral-700 focus:ring-emerald-500 focus:ring-1 focus:ring-offset-0 focus:outline-none"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-neutral-400 mt-2 border-t border-neutral-800 pt-2">
              <div>Period: <strong className="text-white">{settings.rsi1Period}</strong></div>
              <div>Shift: <strong className="text-white">{settings.rsi1CandleShift}</strong></div>
              <div className="text-rose-400">Sell Trigger: &lt;= {settings.rsi1SellLevel}</div>
              <div className="text-emerald-400">Buy Trigger: &gt;= {settings.rsi1BuyLevel}</div>
            </div>
          </div>

          {/* RULE 2: RSI OPEN */}
          <div className="p-3 bg-neutral-950 border border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <span className="font-sans font-bold text-xs text-neutral-200">RSI Open Reversion</span>
              <input
                type="checkbox"
                checked={settings.rsi2Enabled}
                onChange={(e) => updateField('rsi2Enabled', e.target.checked)}
                className="w-4 h-4 text-emerald-600 bg-black border-neutral-700 focus:ring-emerald-500 focus:ring-1 focus:ring-offset-0 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-neutral-400 mt-2 border-t border-neutral-800 pt-2">
              <div>Period: <strong className="text-white">{settings.rsi2Period}</strong></div>
              <div>Shift: <strong className="text-white">{settings.rsi2CandleShift}</strong></div>
              <div className="text-rose-400">Sell Trigger: &gt;= {settings.rsi2SellLevel}</div>
              <div className="text-emerald-400">Buy Trigger: &lt;= {settings.rsi2BuyLevel}</div>
            </div>
          </div>

          {/* RULE 3: EMA CROSSOVER */}
          <div className="p-3 bg-neutral-950 border border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <span className="font-sans font-bold text-xs text-neutral-200">EMA Crossovers</span>
              <input
                type="checkbox"
                checked={settings.emaCrossoverEnabled}
                onChange={(e) => updateField('emaCrossoverEnabled', e.target.checked)}
                className="w-4 h-4 text-emerald-600 bg-black border-neutral-700 focus:ring-emerald-500 focus:ring-1 focus:ring-offset-0 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-neutral-400 mt-2 border-t border-neutral-800 pt-2">
              <div>Fast: <strong className="text-white">{settings.emaFastPeriod} EMA</strong></div>
              <div>Slow: <strong className="text-white">{settings.emaSlowPeriod} EMA</strong></div>
              <div className="col-span-2 text-neutral-500 text-[9px] uppercase tracking-wider mt-1">
                Trigger on fast cross slow upwards.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: Stop-Loss & Take-Profit Calibration */}
      <div className="bg-black p-5 border border-neutral-800">
        <h3 className="text-xs font-black uppercase tracking-[0.25em] text-neutral-400 border-b border-neutral-800 pb-2.5 mb-4 flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-emerald-500" />
          <span>Management Calibration</span>
        </h3>

        <div className="space-y-4">
          {/* Stop Loss calibration */}
          <div className="border-b border-neutral-900 pb-3">
            <div className="flex justify-between items-end mb-1">
              <span className="text-xs text-neutral-400 italic font-serif">Stop Loss Level</span>
              <span className="text-sm font-mono font-bold text-rose-500">{settings.stopLossPips} PIPS</span>
            </div>
            <input
              type="range"
              min="2"
              max="25"
              step="1"
              value={settings.stopLossPips}
              onChange={(e) => updateField('stopLossPips', parseInt(e.target.value))}
              className="w-full h-1 bg-neutral-800 appearance-none cursor-pointer accent-neutral-300"
            />
          </div>

          {/* Take Profit calibration */}
          <div className="border-b border-neutral-900 pb-3">
            <div className="flex justify-between items-end mb-1">
              <span className="text-xs text-neutral-400 italic font-serif">Take Profit Level</span>
              <span className="text-sm font-mono font-bold text-emerald-400">{settings.takeProfitPips} PIPS</span>
            </div>
            <input
              type="range"
              min="5"
              max="40"
              step="1"
              value={settings.takeProfitPips}
              onChange={(e) => updateField('takeProfitPips', parseInt(e.target.value))}
              className="w-full h-1 bg-neutral-800 appearance-none cursor-pointer accent-neutral-300"
            />
          </div>

          {/* Trailing Stop calibration toggle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs text-neutral-400 italic font-serif block">Trailing Stop Lock</span>
                <span className="text-[9px] text-neutral-500 font-mono tracking-wide uppercase">LOCK-IN PROFIT</span>
              </div>
              <input
                type="checkbox"
                checked={settings.useTrailingStop}
                onChange={(e) => updateField('useTrailingStop', e.target.checked)}
                className="w-4 h-4 text-emerald-600 bg-black border-neutral-700 focus:ring-emerald-500 focus:ring-1 focus:ring-offset-0 focus:outline-none"
              />
            </div>

            {settings.useTrailingStop && (
              <div className="mt-2 pt-2 border-t border-neutral-900 font-mono">
                <div className="flex justify-between text-neutral-450 mb-1">
                  <span className="text-[9px] uppercase tracking-wider text-neutral-500">Trailing Shift</span>
                  <span className="text-xs text-cyan-400 font-bold">{settings.trailingStopPips} PIPS</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="15"
                  step="1"
                  value={settings.trailingStopPips}
                  onChange={(e) => updateField('trailingStopPips', parseInt(e.target.value))}
                  className="w-full h-1 bg-neutral-800 appearance-none cursor-pointer accent-neutral-300"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 5: MACD INDICATOR SCHEME */}
      <div className="bg-black p-5 border border-neutral-800">
        <h3 className="text-xs font-black uppercase tracking-[0.25em] text-neutral-400 border-b border-neutral-800 pb-2.5 mb-4 flex items-center gap-2">
          <span>MACD Algorithmic Rules</span>
        </h3>

        <div className="space-y-4">
          <div className="p-3 bg-neutral-950 border border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <span className="font-sans font-bold text-xs text-neutral-200">MACD Core Rules</span>
              <input
                type="checkbox"
                checked={settings.macdEnabled}
                onChange={(e) => updateField('macdEnabled', e.target.checked)}
                className="w-4 h-4 text-emerald-600 bg-black border-neutral-700 focus:ring-emerald-500 focus:ring-1 focus:ring-offset-0 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-neutral-400 mt-2 border-t border-neutral-800 pt-2">
              <div>Fast: <strong className="text-white">12</strong></div>
              <div>Slow: <strong className="text-white">26</strong></div>
              <div>Signal: <strong className="text-white">9</strong></div>
            </div>
          </div>

          <div className="p-3 bg-neutral-950 border border-neutral-800">
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400 font-mono text-[10px] uppercase">MACD Crossovers</span>
                <input
                  type="checkbox"
                  checked={settings.macdCrossoverEnabled}
                  disabled={!settings.macdEnabled}
                  onChange={(e) => updateField('macdCrossoverEnabled', e.target.checked)}
                  className="w-3.5 h-3.5 bg-black border-neutral-700 disabled:opacity-30"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400 font-mono text-[10px] uppercase">MACD Divergence</span>
                <input
                  type="checkbox"
                  checked={settings.macdDivergenceEnabled}
                  disabled={!settings.macdEnabled}
                  onChange={(e) => updateField('macdDivergenceEnabled', e.target.checked)}
                  className="w-3.5 h-3.5 bg-black border-neutral-700 disabled:opacity-30"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 6: MULTI-TIMEFRAME (MTF) CONFIRMATION */}
      <div className="bg-black p-5 border border-neutral-800">
        <h3 className="text-xs font-black uppercase tracking-[0.25em] text-neutral-400 border-b border-neutral-800 pb-2.5 mb-4 flex items-center gap-2">
          <span>Multi-Timeframe Strategy</span>
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-neutral-950 border border-neutral-800">
            <span className="font-sans font-bold text-xs text-neutral-200">Enable MTF Confirm</span>
            <input
              type="checkbox"
              checked={settings.mtfEnabled}
              onChange={(e) => updateField('mtfEnabled', e.target.checked)}
              className="w-4 h-4 text-emerald-600 bg-black border-neutral-700 focus:ring-emerald-500 focus:ring-1 focus:ring-offset-0 focus:outline-none"
            />
          </div>

          {settings.mtfEnabled && (
            <div className="space-y-3 p-3 bg-neutral-950 border border-neutral-800 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-neutral-400 font-mono text-[9px] uppercase">Confirm Timeframe</label>
                <select
                  value={settings.mtfConfirmTimeframe}
                  onChange={(e) => updateField('mtfConfirmTimeframe', e.target.value)}
                  className="bg-black text-white border border-neutral-800 p-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-mono"
                >
                  <option value="M5">M5 (5 Minutes)</option>
                  <option value="M15">M15 (15 Minutes)</option>
                  <option value="BOTH">BOTH (M5 & M15)</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-neutral-400 font-mono text-[10px] uppercase">Confirm Trend (EMA21)</span>
                <input
                  type="checkbox"
                  checked={settings.mtfConfirmTrend}
                  onChange={(e) => updateField('mtfConfirmTrend', e.target.checked)}
                  className="w-3.5 h-3.5 bg-black border-neutral-700"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-neutral-400 font-mono text-[10px] uppercase">Confirm Candle Pressure</span>
                <input
                  type="checkbox"
                  checked={settings.mtfConfirmCandlestick}
                  onChange={(e) => updateField('mtfConfirmCandlestick', e.target.checked)}
                  className="w-3.5 h-3.5 bg-black border-neutral-700"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 7: ECONOMIC CALENDAR NEWS FILTER */}
      <div className="bg-black p-5 border border-neutral-800">
        <h3 className="text-xs font-black uppercase tracking-[0.25em] text-neutral-400 border-b border-neutral-800 pb-2.5 mb-4 flex items-center gap-2">
          <span>Economic Calendar Halt</span>
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-neutral-950 border border-neutral-800">
            <span className="font-sans font-bold text-xs text-neutral-200">Active News Risk Filter</span>
            <input
              type="checkbox"
              checked={settings.newsFilterEnabled}
              onChange={(e) => updateField('newsFilterEnabled', e.target.checked)}
              className="w-4 h-4 text-emerald-600 bg-black border-neutral-700 focus:ring-emerald-500 focus:ring-1 focus:ring-offset-0 focus:outline-none"
            />
          </div>

          {settings.newsFilterEnabled && (
            <div className="space-y-3 p-3 bg-neutral-950 border border-neutral-800 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-neutral-400 font-mono text-[9px] uppercase">Halt Buffer (Minutes)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="5"
                    max="120"
                    value={settings.newsFilterBufferMinutes}
                    onChange={(e) => updateField('newsFilterBufferMinutes', parseInt(e.target.value) || 30)}
                    className="bg-black text-white border border-neutral-800 p-1.5 w-20 font-mono text-center text-xs"
                  />
                  <span className="text-neutral-500 font-mono text-[9px]">MINUTES</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-neutral-400 font-mono text-[9px] uppercase">Min Impact Threshold</label>
                <select
                  value={settings.newsFilterMinImpact}
                  onChange={(e) => updateField('newsFilterMinImpact', e.target.value)}
                  className="bg-black text-white border border-neutral-800 p-1.5 focus:outline-none text-xs font-mono"
                >
                  <option value="HIGH">HIGH IMPACT ONLY</option>
                  <option value="MEDIUM">MEDIUM & HIGH</option>
                  <option value="LOW">ALL EVENTS</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 8: ALERTS & NOTIFICATIONS */}
      <div className="bg-black p-5 border border-neutral-800">
        <h3 className="text-xs font-black uppercase tracking-[0.25em] text-neutral-400 border-b border-neutral-800 pb-2.5 mb-4 flex items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-emerald-500" />
          <span>Alerts & Notifications</span>
        </h3>

        <div className="space-y-4">
          {/* Sound Notification master toggle */}
          <div className="p-3 bg-neutral-950 border border-neutral-800">
            <div className="flex items-center justify-between">
              <span className="font-sans font-bold text-xs text-neutral-200">Sound Notifications</span>
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) => updateField('soundEnabled', e.target.checked)}
                className="w-4 h-4 text-emerald-600 bg-black border-neutral-700 focus:ring-emerald-500 focus:ring-1 focus:ring-offset-0 focus:outline-none"
              />
            </div>
            <p className="text-[10px] text-neutral-500 mt-1.5 leading-normal">
              Plays high-fidelity algorithmic synthesizer chime sounds when daily thresholds are achieved.
            </p>
          </div>

          {/* Browser notification master toggle */}
          <div className="p-3 bg-neutral-950 border border-neutral-800">
            <div className="flex items-center justify-between">
              <span className="font-sans font-bold text-xs text-neutral-200">On-Screen & Browser Alerts</span>
              <input
                type="checkbox"
                checked={settings.browserAlertsEnabled}
                onChange={(e) => updateField('browserAlertsEnabled', e.target.checked)}
                className="w-4 h-4 text-emerald-600 bg-black border-neutral-700 focus:ring-emerald-500 focus:ring-1 focus:ring-offset-0 focus:outline-none"
              />
            </div>
            <p className="text-[10px] text-neutral-500 mt-1.5 leading-normal">
              Triggers visual floating system toasts and requests standard desktop browser notifications.
            </p>
            
            {settings.browserAlertsEnabled && typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
              <button
                type="button"
                onClick={() => Notification.requestPermission()}
                className="mt-2 w-full py-1.5 px-2 border border-dashed border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-500 text-[10px] font-mono transition-all text-center uppercase tracking-wider"
              >
                Request Native Permissions
              </button>
            )}
          </div>

          {/* Specific conditions toggles */}
          <div className="p-3 bg-neutral-950 border border-neutral-800 space-y-2 text-xs">
            <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-400 block mb-2 border-b border-neutral-900 pb-1">Condition Triggers</span>
            
            <div className="flex items-center justify-between">
              <span className="text-neutral-400 font-mono text-[10px] uppercase">Daily Profit Ceiling Hit</span>
              <input
                type="checkbox"
                checked={settings.alertOnProfitHit}
                onChange={(e) => updateField('alertOnProfitHit', e.target.checked)}
                className="w-3.5 h-3.5 bg-black border-neutral-700"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-neutral-400 font-mono text-[10px] uppercase">Daily Drawdown Hit</span>
              <input
                type="checkbox"
                checked={settings.alertOnDrawdownHit}
                onChange={(e) => updateField('alertOnDrawdownHit', e.target.checked)}
                className="w-3.5 h-3.5 bg-black border-neutral-700"
              />
            </div>
          </div>

          {/* Procedural Audio test buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              disabled={!settings.soundEnabled}
              onClick={() => playNotificationTone('test_profit')}
              className="py-1.5 px-2 bg-neutral-900 border border-neutral-800 text-[9px] font-mono uppercase tracking-widest text-emerald-400 hover:text-emerald-300 hover:border-emerald-500 disabled:opacity-30 disabled:border-neutral-800 disabled:text-neutral-500 transition-all font-bold text-center"
            >
              Test Profit Chime
            </button>
            <button
              type="button"
              disabled={!settings.soundEnabled}
              onClick={() => playNotificationTone('test_drawdown')}
              className="py-1.5 px-2 bg-neutral-900 border border-neutral-800 text-[9px] font-mono uppercase tracking-widest text-rose-550 hover:text-rose-450 hover:border-rose-500 disabled:opacity-30 disabled:border-neutral-800 disabled:text-neutral-500 transition-all font-bold text-center"
            >
              Test Drawdown Alarm
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
