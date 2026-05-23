import React from 'react';
import { BotStats, StrategySettings } from '../types';
import { DollarSign, ShieldAlert, Award, Compass, RefreshCw, Key } from 'lucide-react';

interface BotMetricsProps {
  stats: BotStats;
  settings: StrategySettings;
  onResetStats: () => void;
}

export function BotMetrics({ stats, settings, onResetStats }: BotMetricsProps) {
  const profitLossPercent = ((stats.currentBalance - stats.initialBalance) / stats.initialBalance) * 100;
  const isProfit = profitLossPercent >= 0;
  
  const totalTrades = stats.totalWon + stats.totalLost;
  const winRate = totalTrades > 0 ? (stats.totalWon / totalTrades) * 100 : 0;

  // Progress relative to risk constraints
  const profitProgress = Math.min(100, Math.max(0, (profitLossPercent / settings.maxProfitDailyPercent) * 100));
  const lossProgress = Math.min(100, Math.max(0, (Math.abs(profitLossPercent) / settings.maxLossDailyPercent) * 100));

  return (
    <div className="space-y-6 mb-8">
      
      {/* MONUMENTAL HERO STATS HEADER BAR */}
      <div className="border border-neutral-800 bg-black p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 selection:bg-neutral-800">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-emerald-500">Live Trade Stream</span>
          </div>
          <div className={`text-6xl sm:text-7xl lg:text-9xl font-black leading-none -ml-1 sm:-ml-2 tracking-tighter ${isProfit ? 'text-white' : 'text-rose-500'}`}>
            {isProfit ? '+' : ''}{profitLossPercent.toFixed(2)}
            <span className="text-2xl sm:text-4xl align-top font-light text-neutral-500 ml-1">%</span>
          </div>
          <div className="text-xs uppercase tracking-[0.4em] font-bold text-neutral-500 mt-2">Daily Profit Realized</div>
        </div>
        
        <div className="flex flex-col md:items-end">
          <div className="text-4xl sm:text-6xl font-black tracking-tighter text-white font-mono">
            {stats.totalOrdersToday}<span className="text-xl sm:text-2xl text-neutral-600 font-sans">/{settings.maxOrdersPerDay}</span>
          </div>
          <div className="text-xs uppercase tracking-[0.4em] font-bold text-neutral-500 mt-1 md:text-right">Orders Executed Today</div>
        </div>
      </div>

      {/* DETAILED BRUTALIST METRICS CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* CARD 1: PLATFORM ACCESS ENGINE */}
        <div className="bg-black p-5 border border-neutral-800 flex flex-col justify-between h-42">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Platform Integration</span>
              <div className="text-xl font-black text-white tracking-tight">{settings.platform}</div>
            </div>
            <div className="p-2 border border-neutral-800 text-emerald-500">
              <Compass className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-900">
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-neutral-500 tracking-wider mb-2">
              <Key className="w-3.5 h-3.5 text-neutral-600" />
              <span>Target Connection</span>
            </div>
            <div className="flex items-center justify-between">
              <code className="text-[11px] text-emerald-400 font-mono tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5">
                {settings.apiKey.slice(0, 4)}•••{settings.apiKey.slice(-3)}
              </code>
              <span className="text-[9px] uppercase font-bold tracking-widest text-emerald-500 flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/25">
                ACTIVE
              </span>
            </div>
          </div>
        </div>

        {/* CARD 2: REAL-TIME SECURE CAPITAL */}
        <div className="bg-black p-5 border border-neutral-800 flex flex-col justify-between h-42">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Available Capital</span>
              <div className="text-2xl font-black text-white tracking-tight font-mono">
                ${stats.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-2 border border-neutral-800 text-white">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-2 text-xs flex justify-between items-center bg-neutral-950 p-2.5 border border-neutral-800 font-mono">
            <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wide">
              Initial: <span className="text-white ml-1">${stats.initialBalance}</span>
            </div>
            <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wide">
              Allocation: <span className="text-white ml-1">{settings.riskPerOrderPercent}%</span>
            </div>
          </div>
        </div>

        {/* CARD 3: RISK LEVEL PROTECTIONS */}
        <div className="bg-black p-4 border border-neutral-800 flex flex-col justify-between h-42">
          <div className="flex justify-between items-start mb-2">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Safeguards Protection</span>
              <div className="text-[11px] font-serif text-neutral-400 italic">
                Cap Limits: +{settings.maxProfitDailyPercent}% / -{settings.maxLossDailyPercent}%
              </div>
            </div>
            <div className="p-1.5 border border-neutral-800 text-rose-500">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-2">
            {/* Profit target ceiling bar */}
            <div>
              <div className="flex justify-between text-[9px] font-mono text-neutral-500 mb-0.5 font-bold uppercase tracking-wider">
                <span>Profit Roof (+{settings.maxProfitDailyPercent}%)</span>
                <span className={stats.maxProfitLimitReached ? 'text-emerald-500' : 'text-neutral-450'}>
                  {stats.maxProfitLimitReached ? 'LOCKED' : `${profitProgress.toFixed(0)}%`}
                </span>
              </div>
              <div className="w-full h-1 bg-neutral-900 overflow-hidden border border-neutral-800">
                <div 
                  className={`h-full transition-all duration-550 ${stats.maxProfitLimitReached ? 'bg-emerald-500' : 'bg-emerald-400'}`}
                  style={{ width: `${profitProgress}%` }}
                />
              </div>
            </div>

            {/* Emergency loss floor bar */}
            <div>
              <div className="flex justify-between text-[9px] font-mono text-neutral-500 mb-0.5 font-bold uppercase tracking-wider">
                <span>Drawdown Floor (-{settings.maxLossDailyPercent}%)</span>
                <span className={stats.maxLossLimitReached ? 'text-rose-500' : 'text-neutral-450'}>
                  {stats.maxLossLimitReached ? 'TRIPPED' : `${lossProgress.toFixed(0)}%`}
                </span>
              </div>
              <div className="w-full h-1 bg-neutral-900 overflow-hidden border border-neutral-800">
                <div 
                  className={`h-full transition-all duration-550 ${stats.maxLossLimitReached ? 'bg-rose-500 animate-pulse' : 'bg-rose-450'}`}
                  style={{ width: `${lossProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* CARD 4: PERFORMANCE METRIC SYSTEM */}
        <div className="bg-black p-5 border border-neutral-800 flex flex-col justify-between h-42">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Quantitative Ratio</span>
              <div className="text-2xl font-black text-white tracking-tight font-mono">{winRate.toFixed(1)}%</div>
            </div>
            <div className="p-2 border border-neutral-800 text-neutral-400">
              <Award className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-2 flex justify-between items-end">
            <div className="text-[9px] font-mono space-y-0.5 text-neutral-400 uppercase font-semibold">
              <div className="flex items-center gap-1">Won Realized: <span className="text-emerald-400 font-bold">{stats.totalWon}</span></div>
              <div className="flex items-center gap-1">Loss Realized: <span className="text-rose-400 font-bold">{stats.totalLost}</span></div>
            </div>

            <button
              onClick={onResetStats}
              title="Reset Statistics"
              className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors flex items-center gap-1 font-sans"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
