import React, { useState } from 'react';
import { Candle, Trade } from '../types';
import { Lock, Unlock, Pin, Info, TrendingUp, TrendingDown, Eye, Clock } from 'lucide-react';

interface TradingChartProps {
  candles: Candle[];
  trades: Trade[];
  currentTicker: string;
}

export function TradingChart({ candles, trades, currentTicker }: TradingChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // SVG dimensions
  const width = 800;
  const mainHeight = 240;
  const indicatorHeight = 100;
  const paddingRight = 60;
  const paddingLeft = 10;
  const paddingTop = 20;
  const paddingBottom = 20;

  if (candles.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center bg-black border border-neutral-800">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent animate-spin mx-auto mb-2" />
          <span className="text-xs text-neutral-500 font-mono tracking-widest uppercase">Synchronizing market depth...</span>
        </div>
      </div>
    );
  }

  // Determine slice for the viewport (last 35 candles to keep it dense and legible)
  const maxCandlesVisible = 35;
  const visibleCandles = candles.slice(-maxCandlesVisible);
  const startIndex = Math.max(0, candles.length - maxCandlesVisible);

  // Find min/max price for scaling the main candlestick chart
  let maxPrice = -Infinity;
  let minPrice = Infinity;

  visibleCandles.forEach((c) => {
    maxPrice = Math.max(maxPrice, c.high, c.ema9 || 0, c.ema21 || 0);
    minPrice = Math.min(minPrice, c.low, c.ema9 || 9999, c.ema21 || 9999);
  });

  // Safe buffer
  const priceRange = maxPrice - minPrice || 0.001;
  maxPrice += priceRange * 0.08;
  minPrice -= priceRange * 0.08;
  const finalPriceRange = maxPrice - minPrice;

  // Coordinate math helpers
  const getX = (index: number) => {
    const colWidth = (width - paddingLeft - paddingRight) / maxCandlesVisible;
    return paddingLeft + index * colWidth + colWidth / 2;
  };

  const getY = (price: number) => {
    return (
      paddingTop +
      (1 - (price - minPrice) / finalPriceRange) * (mainHeight - paddingTop - paddingBottom)
    );
  };

  // RSI scale (RSI is strictly 0 to 100)
  const getRsiY = (rsiVal: number) => {
    const rsiPadding = 10;
    return (
      rsiPadding +
      (1 - rsiVal / 100) * (indicatorHeight - rsiPadding * 2)
    );
  };

  // Draw indicators path
  let ema9Points = '';
  let ema21Points = '';

  visibleCandles.forEach((c, idx) => {
    if (c.ema9 !== undefined) {
      ema9Points += `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(c.ema9)} `;
    }
    if (c.ema21 !== undefined) {
      ema21Points += `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(c.ema21)} `;
    }
  });

  // Draw RSI indicator paths
  let rsiClosePoints = '';
  let rsiOpenPoints = '';

  visibleCandles.forEach((c, idx) => {
    if (c.rsiClose5 !== undefined) {
      rsiClosePoints += `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getRsiY(c.rsiClose5)} `;
    }
    if (c.rsiOpen5 !== undefined) {
      rsiOpenPoints += `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getRsiY(c.rsiOpen5)} `;
    }
  });

  // Find index of selected time in the visible slice
  const selectedIndex = selectedTime !== null 
    ? visibleCandles.findIndex(c => c.time === selectedTime) 
    : -1;

  // Get current active candle or hovered candle for metadata
  const activeHoverIndex = hoveredIndex !== null 
    ? hoveredIndex 
    : (selectedIndex !== -1 ? selectedIndex : visibleCandles.length - 1);
  const activeCandle = visibleCandles[activeHoverIndex] || visibleCandles[visibleCandles.length - 1];

  // Map simulated trades to visible coordinates
  const visTrades = trades.filter((t) => {
    const idx = candles.findIndex((c) => c.time === t.timestamp);
    return idx >= startIndex;
  });

  return (
    <div className="bg-black p-5 border border-neutral-800">
      
      {/* HUD Header displaying highlighted bar details */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full live-beacon" />
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-200">
            {currentTicker} <span className="text-neutral-500 font-normal ml-1">Real-Time M1 Feed</span>
          </h3>
        </div>
        
        {activeCandle && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-neutral-400">
            <span>TIME: <strong className="text-neutral-200">{activeCandle.time}</strong></span>
            <span>OPEN: <strong className="text-neutral-100 font-bold">{(activeCandle.open).toFixed(5)}</strong></span>
            <span>HIGH: <strong className="text-emerald-400 font-bold">{(activeCandle.high).toFixed(5)}</strong></span>
            <span>LOW: <strong className="text-rose-400 font-bold">{(activeCandle.low).toFixed(5)}</strong></span>
            <span>CLOSE: <strong className="text-neutral-100 font-bold">{(activeCandle.close).toFixed(5)}</strong></span>
            <span className="text-cyan-400 border-l border-neutral-800 pl-3">EMA9: <strong>{activeCandle.ema9 ? activeCandle.ema9.toFixed(5) : 'N/A'}</strong></span>
            <span className="text-amber-400">EMA21: <strong>{activeCandle.ema21 ? activeCandle.ema21.toFixed(5) : 'N/A'}</strong></span>
          </div>
        )}
      </div>

      {/* Main Candlestick SVG Chart Area */}
      <div className="relative w-full overflow-x-auto">
        <div className="relative min-w-[800px]">
          <svg viewBox={`0 0 ${width} ${mainHeight + indicatorHeight}`} className="w-full h-auto overflow-visible select-none">
            {/* Background Grid Lines for Main Candle Area */}
            {Array.from({ length: 5 }).map((_, i) => {
              const yRatio = i / 4;
              const price = minPrice + (1 - yRatio) * finalPriceRange;
              const yCoords = paddingTop + yRatio * (mainHeight - paddingTop - paddingBottom);
              return (
                <g key={`grid-${i}`}>
                  <line x1={0} y1={yCoords} x2={width - paddingRight} y2={yCoords} stroke="#262626" strokeWidth={0.75} strokeDasharray="2,2" />
                  <text x={width - paddingRight + 5} y={yCoords + 4} fill="#525252" className="font-mono text-[10px]" textAnchor="start">
                    {price.toFixed(5)}
                  </text>
                </g>
              );
            })}

            {/* Render Candlesticks */}
            {visibleCandles.map((candle, idx) => {
              const oY = getY(candle.open);
              const cY = getY(candle.close);
              const hY = getY(candle.high);
              const lY = getY(candle.low);
              const isBullish = candle.close >= candle.open;
              const candleX = getX(idx);
              const colWidth = (width - paddingLeft - paddingRight) / maxCandlesVisible;
              const wickX = candleX;
              const bodyW = colWidth * 0.65;

              const isPinned = selectedTime === candle.time;
              const isActiveHighlight = hoveredIndex === idx || 
                (hoveredIndex === null && isPinned) ||
                (hoveredIndex === null && selectedTime === null && idx === visibleCandles.length - 1);

              return (
                <g 
                  key={`candle-${idx}`} 
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => {
                    if (selectedTime === candle.time) {
                      setSelectedTime(null);
                    } else {
                      setSelectedTime(candle.time);
                    }
                  }}
                >
                  {/* Highlight bar selection background with focus indicators */}
                  {isActiveHighlight && (
                    <g>
                      <rect x={candleX - colWidth / 2} y={0} width={colWidth} height={mainHeight} fill="#1c1c1c" fillOpacity={0.4} />
                      <line x1={candleX} y1={0} x2={candleX} y2={mainHeight} stroke={isPinned ? '#f59e0b' : 'rgba(255,255,255,0.12)'} strokeWidth={isPinned ? 1.25 : 0.75} strokeDasharray={isPinned ? 'none' : '3,3'} />
                    </g>
                  )}

                  {/* High-Low Wick */}
                  <line x1={wickX} y1={hY} x2={wickX} y2={lY} stroke={isBullish ? '#10b981' : '#f43f5e'} strokeWidth={1.5} />

                  {/* Open-Close Body */}
                  <rect
                    x={candleX - bodyW / 2}
                    y={Math.min(oY, cY)}
                    width={bodyW}
                    height={Math.max(1.5, Math.abs(oY - cY))}
                    fill={isBullish ? '#10b981' : '#f43f5e'}
                  />
                </g>
              );
            })}

            {/* Render EMA Lines overlay */}
            {ema9Points && (
              <path d={ema9Points} fill="none" stroke="#22d3ee" strokeWidth={1.5} className="transition-all" strokeLinecap="square" />
            )}
            {ema21Points && (
              <path d={ema21Points} fill="none" stroke="#f59e0b" strokeWidth={1.5} className="transition-all" strokeLinecap="square" />
            )}

            {/* Draw Simulated Executions Labels on Chart */}
            {visTrades.map((trade) => {
              const candleIdx = candles.findIndex((c) => c.time === trade.timestamp) - startIndex;
              if (candleIdx < 0 || candleIdx >= maxCandlesVisible) return null;
              const tX = getX(candleIdx);
              // Draw Buy indicators slightly below low price; Sell indicators slightly above high price
              const candle = candles[candles.findIndex((c) => c.time === trade.timestamp)];
              const tY = trade.direction === 'BUY' 
                ? getY(candle.low) + 12 
                : getY(candle.high) - 15;

              return (
                <g key={`chart-trade-${trade.id}`}>
                  {/* Glowing bubble anchor */}
                  <circle cx={tX} cy={trade.direction === 'BUY' ? getY(candle.low) : getY(candle.high)} r={3} fill={trade.direction === 'BUY' ? '#10b981' : '#f43f5e'} />
                  
                  {/* Label arrow background */}
                  <polygon
                    points={
                      trade.direction === 'BUY'
                        ? `${tX},${tY - 4} ${tX - 6},${tY + 12} ${tX + 6},${tY + 12}`
                        : `${tX},${tY + 4} ${tX - 6},${tY - 12} ${tX + 6},${tY - 12}`
                    }
                    fill={trade.direction === 'BUY' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(244, 63, 94, 0.95)'}
                  />
                  <text
                    x={tX}
                    y={trade.direction === 'BUY' ? tY + 10 : tY - 4}
                    fill="white"
                    fontWeight="bold"
                    fontSize="7px"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {trade.direction === 'BUY' ? '▲ B' : '▼ S'}
                  </text>
                </g>
              );
            })}

            {/* ----------------- RSI Sub-Panel Section ----------------- */}
            <g transform={`translate(0, ${mainHeight})`}>
              {/* Plot Header separator */}
              <line x1={0} y1={0} x2={width - paddingRight} y2={0} stroke="#262626" strokeWidth={1} />
              
              {/* Background labels and overbought/oversold bands */}
              {/* Bands background between 30 and 70 */}
              <rect x={0} y={getRsiY(70)} width={width - paddingRight} height={getRsiY(30) - getRsiY(70)} fill="rgba(255, 255, 255, 0.02)" />
              
              {/* 70 overbought limit line */}
              <line x1={0} y1={getRsiY(70)} x2={width - paddingRight} y2={getRsiY(70)} stroke="rgba(244, 63, 94, 0.3)" strokeWidth={1} strokeDasharray="3,3" />
              <text x={width - paddingRight + 5} y={getRsiY(70) + 3} fill="#f43f5e" className="font-mono text-[9px]">70 (OB)</text>

              {/* 50 median line */}
              <line x1={0} y1={getRsiY(50)} x2={width - paddingRight} y2={getRsiY(50)} stroke="rgba(255, 255, 255, 0.1)" strokeWidth={1} strokeDasharray="4,4" />
              <text x={width - paddingRight + 5} y={getRsiY(50) + 3} fill="#525252" className="font-mono text-[9px]">50</text>

              {/* 30 oversold limit line */}
              <line x1={0} y1={getRsiY(30)} x2={width - paddingRight} y2={getRsiY(30)} stroke="rgba(16, 185, 129, 0.3)" strokeWidth={1} strokeDasharray="3,3" />
              <text x={width - paddingRight + 5} y={getRsiY(30) + 3} fill="#10b981" className="font-mono text-[9px]">30 (OS)</text>

              {/* Horizontal time indexes on X-axis */}
              {visibleCandles.map((candle, idx) => {
                // Return times in 6-bar steps
                if (idx % 6 !== 0) return null;
                const cX = getX(idx);
                return (
                  <g key={`time-${idx}`}>
                    <line x1={cX} y1={indicatorHeight - 20} x2={cX} y2={indicatorHeight - 15} stroke="#262626" strokeWidth={1} />
                    <text x={cX} y={indicatorHeight - 5} fill="#737373" className="font-mono text-[8px]" textAnchor="middle">
                      {candle.time}
                    </text>
                  </g>
                );
              })}

              {/* RSI close paths */}
              {rsiClosePoints && (
                <path d={rsiClosePoints} fill="none" stroke="#a855f7" strokeWidth={1.5} />
              )}
              {/* RSI open paths */}
              {rsiOpenPoints && (
                <path d={rsiOpenPoints} fill="none" stroke="#0ea5e9" strokeWidth={1} />
              )}

              {/* Focus Bar on RSI panel */}
              {activeHoverIndex !== null && (
                <line x1={getX(activeHoverIndex)} y1={0} x2={getX(activeHoverIndex)} y2={indicatorHeight - 15} stroke="rgba(255, 255, 255, 0.15)" strokeDasharray="2,3" />
              )}
            </g>
          </svg>

          {/* Interactive, Persistent Indicator HUD Tooltip */}
          {activeCandle && (
            (() => {
              const tooltipLeftPercent = (getX(activeHoverIndex) / width) * 100;
              const isNearRightEdge = activeHoverIndex > maxCandlesVisible - 11;
              const isPinned = selectedTime === activeCandle.time;
              const isLive = activeHoverIndex === visibleCandles.length - 1 && selectedTime === null;
              
              const delta = activeCandle.close - activeCandle.open;
              const isBullish = delta >= 0;
              const pDelta = (delta / activeCandle.open) * 100;

              // Compute EMA Alignment
              const ema9 = activeCandle.ema9;
              const ema21 = activeCandle.ema21;
              const emaBullish = ema9 !== undefined && ema21 !== undefined ? ema9 > ema21 : false;

              // Compute RSI Assessment
              const rsi = activeCandle.rsiClose5;
              const rsiStatus = rsi === undefined ? 'N/A' : rsi >= 70 ? 'OVERBOUGHT' : rsi <= 30 ? 'OVERSOLD' : 'NEUTRAL';

              // Position properties
              const placementStyle = isNearRightEdge
                ? { right: `calc(${100 - tooltipLeftPercent}% + 12px)`, top: '15px' }
                : { left: `calc(${tooltipLeftPercent}% + 12px)`, top: '15px' };

              return (
                <div 
                  className="absolute z-30 w-64 bg-black/95 backdrop-blur-md border border-neutral-800 p-3.5 shadow-2xl rounded text-xs leading-normal select-none pointer-events-auto transition-all duration-150"
                  style={placementStyle}
                >
                  {/* Tooltip Header */}
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-2 mb-2 font-mono text-[10px]">
                    <div className="flex items-center gap-1.5 text-neutral-200">
                      <Clock className="w-3.5 h-3.5 text-neutral-500" />
                      <span className="font-bold">{activeCandle.time}</span>
                    </div>

                    {isPinned ? (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-500 rounded-sm font-black uppercase text-[8px] animate-pulse">
                        <Lock className="w-2.5 h-2.5" /> PINNED
                      </span>
                    ) : hoveredIndex !== null ? (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-sky-500/15 border border-sky-500/20 text-sky-400 rounded-sm font-black uppercase text-[8px]">
                        <Eye className="w-2.5 h-2.5" /> INSPECT
                      </span>
                    ) : isLive ? (
                      <span className="flex items-center gap-1.5 px-1.5 py-0.5 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 rounded-sm font-black uppercase text-[8px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" /> LIVE
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 text-neutral-450 rounded-sm font-black uppercase text-[8px]">
                        PREVIEW
                      </span>
                    )}
                  </div>

                  {/* Candle Price Breakdown */}
                  <div className="space-y-1.5 mb-2.5 bg-neutral-950/40 p-2 border border-neutral-900/60 rounded-sm">
                    <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500">
                      <span>OPEN</span>
                      <span className="text-neutral-300 font-bold">{activeCandle.open.toFixed(5)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500">
                      <span>CLOSE</span>
                      <span className="text-neutral-300 font-bold">{activeCandle.close.toFixed(5)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500">
                      <span>HIGH / LOW</span>
                      <span className="text-neutral-300 font-bold">
                        <span className="text-emerald-400">{activeCandle.high.toFixed(5)}</span>
                        <span className="text-neutral-700 mx-1">/</span>
                        <span className="text-rose-405">{activeCandle.low.toFixed(5)}</span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-neutral-900/50 text-[10px] font-mono">
                      <span className="text-neutral-500">CHANGE</span>
                      <span className={`font-bold flex items-center gap-0.5 ${isBullish ? 'text-emerald-400' : 'text-rose-455'}`}>
                        {isBullish ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isBullish ? '+' : ''}{pDelta.toFixed(3)}%
                      </span>
                    </div>
                  </div>

                  {/* Interactive Indicator Metrics Section */}
                  <div className="space-y-2">
                    {/* EMA Block */}
                    <div className="border-t border-neutral-800/40 pt-1.5">
                      <div className="flex justify-between text-[10px] font-mono text-neutral-500 mb-1">
                        <span>EMA METRICS</span>
                        <span className={`font-bold text-[8px] px-1 tracking-wide uppercase rounded-sm ${emaBullish ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-455'}`}>
                          {emaBullish ? 'Bullish Alignment' : 'Bearish Alignment'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                        <div className="flex justify-between items-center bg-neutral-950 p-1 border border-neutral-900 rounded-sm">
                          <span className="text-[#22d3ee] font-bold text-[9px]">EMA 9</span>
                          <span className="text-neutral-300 font-bold">{ema9 ? ema9.toFixed(5) : 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center bg-neutral-950 p-1 border border-neutral-900 rounded-sm">
                          <span className="text-[#f59e0b] font-bold text-[9px]">EMA 21</span>
                          <span className="text-neutral-300 font-bold">{ema21 ? ema21.toFixed(5) : 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* RSI Block */}
                    <div className="border-t border-neutral-800/40 pt-1.5">
                      <div className="flex justify-between text-[10px] font-mono text-neutral-500 mb-1">
                        <span>RSI OSCILLATOR (5)</span>
                        <span className={`font-bold text-[8px] px-1 tracking-wide uppercase rounded-sm ${
                          rsiStatus === 'OVERBOUGHT' ? 'bg-rose-500/15 text-rose-455' :
                          rsiStatus === 'OVERSOLD' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-neutral-800 text-neutral-400'
                        }`}>
                          {rsiStatus}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                        <div className="flex justify-between items-center bg-neutral-950 p-1 border border-neutral-900 rounded-sm">
                          <span className="text-[#a855f7] font-bold text-[9px]">CLOSE</span>
                          <span className="text-neutral-300 font-bold">{rsi ? rsi.toFixed(2) : 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center bg-neutral-950 p-1 border border-neutral-900 rounded-sm">
                          <span className="text-[#0ea5e9] font-bold text-[9px]">OPEN</span>
                          <span className="text-neutral-300 font-bold">{activeCandle.rsiOpen5 ? activeCandle.rsiOpen5.toFixed(2) : 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* MACD Block */}
                    <div className="border-t border-neutral-800/40 pt-1.5 pb-0.5">
                      <div className="flex justify-between text-[10px] font-mono text-neutral-500 mb-1">
                        <span>MACD SCHEME (12, 26, 9)</span>
                        {activeCandle.macdHist !== undefined && (
                          <span className={`font-bold text-[8px] px-1 tracking-wide uppercase rounded-sm ${activeCandle.macdHist >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-455'}`}>
                            {activeCandle.macdHist >= 0 ? '+Momentum' : '-Momentum'}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-1 font-mono text-[9px]">
                        <div className="flex flex-col justify-between bg-neutral-950 p-1 border border-neutral-900 rounded-sm text-center">
                          <span className="text-neutral-500 text-[8px] uppercase">MACD</span>
                          <span className="text-neutral-300 font-bold truncate">{activeCandle.macdLine ? activeCandle.macdLine.toFixed(5) : 'N/A'}</span>
                        </div>
                        <div className="flex flex-col justify-between bg-neutral-950 p-1 border border-neutral-900 rounded-sm text-center">
                          <span className="text-neutral-500 text-[8px] uppercase">SIGNAL</span>
                          <span className="text-neutral-300 font-bold truncate">{activeCandle.macdSignal ? activeCandle.macdSignal.toFixed(5) : 'N/A'}</span>
                        </div>
                        <div className="flex flex-col justify-between bg-neutral-950 p-1 border border-neutral-900 rounded-sm text-center">
                          <span className="text-neutral-500 text-[8px] uppercase">HIST</span>
                          <span className={`font-bold truncate ${activeCandle.macdHist !== undefined && activeCandle.macdHist >= 0 ? 'text-emerald-400' : 'text-rose-455'}`}>
                            {activeCandle.macdHist ? activeCandle.macdHist.toFixed(5) : '0.00000'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pin/Unpin Interactive Hint */}
                  <div className="border-t border-neutral-800 pt-2 mt-2.5 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isPinned) {
                          setSelectedTime(null);
                        } else {
                          setSelectedTime(activeCandle.time);
                        }
                      }}
                      className="w-full flex items-center justify-center gap-1 py-1 text-[9px] uppercase font-mono tracking-wider font-bold text-neutral-400 hover:text-white transition-colors duration-200"
                    >
                      {isPinned ? (
                        <>
                          <Unlock className="w-3 h-3 text-amber-500" /> Click to Unlock Candle
                        </>
                      ) : (
                        <>
                          <Pin className="w-3 h-3 text-neutral-500" /> Click Candle to lock HUD
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>

      {/* Mini Legend */}
      <div className="flex flex-wrap gap-4 mt-3 text-[10px] font-mono justify-end text-neutral-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-[#22d3ee]" /> FAST EMA (9)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-[#f59e0b]" /> SLOW EMA (21)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-[#a855f7]" /> RSI CLOSE (5)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-[#0ea5e9]" /> RSI OPEN (5)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-500" /> LONG</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-rose-500" /> SHORT</span>
      </div>
    </div>
  );
}
