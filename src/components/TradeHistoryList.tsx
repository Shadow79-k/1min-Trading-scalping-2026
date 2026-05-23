import React from 'react';
import { Trade, StrategySettings } from '../types';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Clock, Disc, Download } from 'lucide-react';

interface TradeHistoryListProps {
  trades: Trade[];
  settings: StrategySettings;
}

export function TradeHistoryList({ trades, settings }: TradeHistoryListProps) {
  const activeTrades = trades.filter((t) => t.status === 'ACTIVE' || t.status === 'TRAILING_ACTIVE');
  const completedTrades = trades.filter((t) => t.status !== 'ACTIVE' && t.status !== 'TRAILING_ACTIVE').reverse();

  const handleDownloadCSV = () => {
    if (completedTrades.length === 0) return;

    const headers = [
      'Trade ID',
      'Simulated Timestamp',
      'Currency Asset Pair',
      'Direction',
      'Entry Rate',
      'Exit Rate',
      'Resolution Status',
      'Pips Profit/Loss',
      'Dynamic Lot Profit ($)',
      'Stop Loss (Initial)',
      'Take Profit (Initial)',
      'Strategy Trigger Reason',
      'Holding Duration (Mins)',
      'External News Filter Alert Notes'
    ];

    const rows = completedTrades.map(trade => [
      trade.id,
      trade.timestamp,
      trade.pair,
      trade.direction,
      trade.entryPrice,
      trade.exitPrice !== undefined ? trade.exitPrice : 'N/A',
      trade.status,
      trade.pipsProfit.toFixed(2),
      trade.pnlAmount.toFixed(2),
      trade.initialStopLoss,
      trade.initialTakeProfit,
      trade.triggerType,
      trade.durationMins !== undefined ? trade.durationMins.toFixed(1) : '——',
      trade.newsFilterAlert || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(cell => {
          const val = String(cell);
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const timestampStr = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 16);
    link.setAttribute('download', `hft_scalper_trade_history_${timestampStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-black p-5 border border-neutral-800 h-full flex flex-col justify-between min-h-[450px]">
      <div>
        
        {/* HEADER BLOCK */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800">
          <h3 className="text-xs font-black uppercase tracking-[0.25em] text-neutral-450 flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-400" />
            <span>Trades Ledger</span>
          </h3>
          <div className="flex gap-1.5 font-mono text-[10px]">
            <span className="bg-neutral-900 border border-neutral-800 text-neutral-400 px-2 py-0.5">
              ACT: {activeTrades.length}
            </span>
            <span className="bg-neutral-900 border border-neutral-800 text-neutral-400 px-2 py-0.5">
              CMP: {completedTrades.length}
            </span>
          </div>
        </div>

        {/* ACTIVE TRADES SUBSECTION */}
        {activeTrades.length > 0 && (
          <div className="mb-6 space-y-2">
            <div className="text-[10px] font-mono tracking-widest text-cyan-400 font-bold uppercase mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
              <span>Active Scalps</span>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              {activeTrades.map((trade) => {
                const pipDelta = trade.pipsProfit;
                const pnlIsProfit = pipDelta >= 0;

                return (
                  <div 
                    key={trade.id} 
                    className="p-3 bg-neutral-950 border border-neutral-800 relative flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 border border-neutral-800 ${trade.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-450'}`}>
                        {trade.direction === 'BUY' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-black text-neutral-200">{trade.pair}</span>
                          <span className={`text-[9px] font-mono font-bold px-1.5 ${
                            trade.direction === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {trade.direction}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-neutral-500">
                          In: <strong className="text-neutral-300">{trade.entryPrice.toFixed(5)}</strong> | Live: <strong className="text-neutral-300">{trade.currentPrice.toFixed(5)}</strong>
                        </div>
                        <div className="text-[8px] font-mono text-cyan-400 mt-0.5 flex items-center gap-1">
                          <Disc className="w-2.5 h-2.5 animate-spin text-cyan-400" />
                          <span>Stop: {trade.currentStopLoss.toFixed(5)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className={`text-xs font-black leading-none ${pnlIsProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {pnlIsProfit ? '+' : ''}{trade.pipsProfit.toFixed(1)} pip
                      </div>
                      <div className={`text-[11px] font-bold mt-1 ${pnlIsProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {pnlIsProfit ? '+' : ''}${trade.pnlAmount.toFixed(2)}
                      </div>
                      <div className="text-[8px] text-neutral-600 mt-0.5">
                        {trade.triggerType}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* COMPLETED TRADES SUBSECTION */}
        <div className="flex items-center justify-between mb-2.5 pt-4 mt-2 border-t border-neutral-900">
          <span className="text-[10px] font-mono tracking-widest text-neutral-550 font-black uppercase">
            Completed Orders Logs
          </span>
          {completedTrades.length > 0 ? (
            <button
              onClick={handleDownloadCSV}
              type="button"
              className="py-1 px-2.5 bg-neutral-900 hover:bg-neutral-850 hover:text-white text-neutral-300 border border-neutral-800 hover:border-neutral-700 text-[9px] font-mono font-bold tracking-widest uppercase flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Download className="w-3 h-3 text-purple-400" />
              <span>Download History</span>
            </button>
          ) : (
            <span className="text-[8px] font-mono text-neutral-600 block uppercase tracking-wider">Empty Ledger</span>
          )}
        </div>

        <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
          {completedTrades.length === 0 ? (
            <div className="text-center py-12 border border-neutral-800 bg-neutral-950 text-neutral-500">
              <span className="text-[11px] font-mono leading-relaxed inline-block max-w-[180px]">Automated contracts will execute dynamically according to the rules...</span>
            </div>
          ) : (
            completedTrades.map((trade) => {
              const pnlIsProfit = trade.pipsProfit >= 0;
              const isTP = trade.status === 'TP';
              const isSL = trade.status === 'SL';

              return (
                <div 
                  key={trade.id} 
                  className="p-2.5 bg-neutral-950/40 border border-neutral-900 flex items-center justify-between text-xs hover:border-neutral-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1 border border-neutral-800 ${
                      trade.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-450'
                    }`}>
                      {trade.direction === 'BUY' ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1 font-mono">
                        <span className="font-bold text-neutral-200">{trade.pair}</span>
                        <span className={`text-[8px] font-bold px-1 ${
                          trade.direction === 'BUY' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-rose-900/40 text-rose-400'
                        }`}>
                          {trade.direction}
                        </span>
                        <span className="text-[8px] text-neutral-600">{trade.timestamp}</span>
                      </div>
                      <div className="text-[10px] font-mono text-neutral-500 flex items-center gap-1.5 mt-0.5">
                        <span>In: <strong className="text-neutral-400">{trade.entryPrice.toFixed(5)}</strong></span>
                        <span>Out: <strong className="text-neutral-400">{trade.exitPrice?.toFixed(5)}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono flex items-center gap-2">
                    <div className="space-y-0.5">
                      <div className={`text-[11px] font-black ${pnlIsProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {pnlIsProfit ? '+' : ''}{trade.pipsProfit.toFixed(1)}
                      </div>
                      <div className={`text-[10px] font-bold ${pnlIsProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {pnlIsProfit ? '+' : ''}${trade.pnlAmount.toFixed(2)}
                      </div>
                    </div>

                    <div className={`w-12 text-center py-0.5 text-[8px] font-black tracking-widest uppercase ${
                      isTP ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                      isSL ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 
                      'bg-neutral-800 text-neutral-400'
                    }`}>
                      {trade.status}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="border-t border-neutral-800 pt-3 mt-4 text-[9px] font-mono text-neutral-500 flex flex-col gap-1 uppercase tracking-wider">
        <div className="flex justify-between">
          <span>Daily Order Cap:</span>
          <span className="text-neutral-300 font-bold">750 Orders</span>
        </div>
        <div className="flex justify-between">
          <span>Profit target / loss safeguard:</span>
          <span className="text-neutral-350 font-bold">+{settings.maxProfitDailyPercent}% / -{settings.maxLossDailyPercent}%</span>
        </div>
      </div>
    </div>
  );
}
