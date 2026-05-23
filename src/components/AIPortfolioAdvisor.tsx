import React, { useState } from 'react';
import { BotStats, StrategySettings, Trade } from '../types';
import { Cpu, AlertCircle, RefreshCcw, BookOpen } from 'lucide-react';

interface AIPortfolioAdvisorProps {
  settings: StrategySettings;
  stats: BotStats;
  trades: Trade[];
}

export function AIPortfolioAdvisor({ settings, stats, trades }: AIPortfolioAdvisorProps) {
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategySettings: settings,
          botStats: stats,
          tradeHistory: trades.slice(-15), // send last 15 trades to avoid payload size overhead
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Gateway response failed');
      }

      const data = await response.json();
      setAdvice(data.analysis);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed connecting to server-side AI model.');
    } finally {
      setLoading(false);
    }
  };

  // Safe custom markdown mini-parser to avoid dependency overload and keep styling hyper-polished
  const renderAdviceMarkdown = (mdText: string) => {
    const lines = mdText.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('# ')) {
        return (
          <h2 key={idx} className="text-sm font-black text-white mt-4 mb-2 border-b border-neutral-800 pb-1 uppercase tracking-widest font-sans">
            {trimmed.slice(2)}
          </h2>
        );
      }
      if (trimmed.startsWith('## ')) {
        return (
          <h3 key={idx} className="text-xs font-black text-cyan-400 mt-3 mb-1.5 uppercase tracking-wider font-sans">
            {trimmed.slice(3)}
          </h3>
        );
      }
      if (trimmed.startsWith('### ')) {
        return (
          <h4 key={idx} className="text-[10px] font-bold text-amber-500 mt-2 mb-1 uppercase font-sans">
            {trimmed.slice(4)}
          </h4>
        );
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const listContent = trimmed.slice(2);
        return (
          <li key={idx} className="text-xs text-neutral-300 ml-4 list-disc leading-relaxed mb-1 font-sans">
            {parseInlines(listContent)}
          </li>
        );
      }
      if (trimmed.startsWith('1.') || trimmed.startsWith('2.') || trimmed.startsWith('3.') || trimmed.startsWith('4.')) {
        return (
          <div key={idx} className="text-xs text-neutral-300 ml-1 py-0.5 leading-relaxed font-sans mb-1 pl-2 border-l border-neutral-800">
            {parseInlines(trimmed)}
          </div>
        );
      }
      if (trimmed === '') {
        return <div key={idx} className="h-1.5" />;
      }
      
      return (
        <p key={idx} className="text-xs text-neutral-400 leading-relaxed mb-1.5 font-sans">
          {parseInlines(trimmed)}
        </p>
      );
    });
  };

  // Helper helper to handle mock inline bold **bold text**
  const parseInlines = (text: string) => {
    const parts = text.split(/\*\*([^*]+)\*\*/g);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <strong key={index} className="text-white font-black font-mono">{part}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="bg-black p-5 border border-neutral-800 h-full flex flex-col justify-between min-h-[450px]">
      <div>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-black uppercase tracking-[0.25em] text-neutral-450">
              AI Strategy Advisor
            </h3>
          </div>
          <span className="text-[9px] font-mono tracking-widest font-black text-cyan-400 uppercase bg-neutral-900 border border-neutral-800 px-2 py-0.5">
            GEMINI
          </span>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-rose-300 text-xs font-mono leading-relaxed">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
            <div>
              <span className="font-bold uppercase tracking-wider block mb-1">Audit Failed:</span> {error}
              <p className="text-[9px] text-neutral-500 mt-1 uppercase">
                Add GEMINI_API_KEY in Settings to enable live audits.
              </p>
            </div>
          </div>
        )}

        {advice ? (
          <div className="bg-neutral-950 p-4 border border-neutral-800 max-h-[310px] overflow-y-auto font-mono">
            <div className="space-y-1">
              {renderAdviceMarkdown(advice)}
            </div>
          </div>
        ) : (
          <div className="text-center py-16 border border-neutral-850 bg-neutral-950 text-neutral-500 flex flex-col items-center justify-center">
            <BookOpen className="w-8 h-8 text-neutral-700 mb-3 animate-pulse" />
            <span className="text-[11px] font-mono leading-relaxed max-w-[280px] uppercase tracking-wider text-center">
              No audit records loaded. Click button below to trigger diagnostic review.
            </span>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-neutral-800 mt-4">
        <button
          onClick={requestAnalysis}
          disabled={loading}
          className={`w-full py-3 px-4 font-sans font-black text-xs tracking-widest flex items-center justify-center gap-2 transition-colors uppercase ${
            loading
              ? 'bg-neutral-950 text-neutral-500 border border-neutral-850 cursor-not-allowed'
              : 'bg-white hover:bg-cyan-500 text-black'
          }`}
        >
          {loading ? (
            <>
              <RefreshCcw className="w-4 h-4 animate-spin shrink-0" />
              <span>RUNNING QUANT DIAGNOSTICS...</span>
            </>
          ) : (
            <>
              <Cpu className="w-4 h-4 shrink-0" />
              <span>ANALYZE SCALPER STRATEGY</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
