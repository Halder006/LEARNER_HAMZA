/**
 * Learner HAMZA - Premium Responsive Financial Charts
 * High-performance SVG charts for Equity, Drawdown, Daily P&L and Asset comparisons
 */

import React, { useState } from 'react';

interface EquityPoint {
  date: string;
  equity: number;
  tradeId?: string;
}

interface EquityCurveProps {
  data: EquityPoint[];
  startingCapital: number;
  height?: number;
}

export const EquityCurveChart: React.FC<EquityCurveProps> = ({ data, startingCapital, height = 240 }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-56 w-full items-center justify-center rounded-lg border border-slate-800 bg-slate-900/40 text-slate-500 text-sm">
        No trade data available to plot Equity Curve.
      </div>
    );
  }

  // Prepend starting point if only trades exist
  const points: EquityPoint[] = data[0]?.equity === startingCapital
    ? data
    : [{ date: 'Start', equity: startingCapital }, ...data];

  const equities = points.map(p => p.equity);
  const minEquity = Math.min(...equities, startingCapital * 0.95);
  const maxEquity = Math.max(...equities, startingCapital * 1.05);
  const range = maxEquity - minEquity || 1;

  const width = 600; // viewBox units
  const chartHeight = height;
  const padding = { top: 20, right: 30, bottom: 30, left: 55 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;

  const coords = points.map((p, i) => {
    const x = padding.left + (i / (points.length - 1 || 1)) * graphWidth;
    const y = padding.top + graphHeight - ((p.equity - minEquity) / range) * graphHeight;
    return { x, y, ...p };
  });

  const pathD = coords.reduce((acc, c, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`, '');
  const baselineY = padding.top + graphHeight - ((startingCapital - minEquity) / range) * graphHeight;

  // Area path
  const areaD = `${pathD} L ${coords[coords.length - 1].x} ${padding.top + graphHeight} L ${coords[0].x} ${padding.top + graphHeight} Z`;

  const hoveredPoint = hoveredIdx !== null ? coords[hoveredIdx] : null;

  return (
    <div className="relative w-full overflow-hidden select-none">
      <svg
        viewBox={`0 0 ${width} ${chartHeight}`}
        className="w-full h-auto overflow-visible"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4F8CFF" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#4F8CFF" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
          const val = minEquity + pct * range;
          const y = padding.top + graphHeight - pct * graphHeight;
          return (
            <g key={idx}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#1E293B" strokeDasharray="3 3" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fill="#64748B" fontSize="10" fontFamily="monospace">
                ${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </text>
            </g>
          );
        })}

        {/* Baseline starting capital */}
        <line
          x1={padding.left}
          y1={baselineY}
          x2={width - padding.right}
          y2={baselineY}
          stroke="#475569"
          strokeDasharray="4 4"
          strokeWidth="1"
        />

        {/* Fill Area */}
        <path d={areaD} fill="url(#equityGrad)" />

        {/* Line */}
        <path d={pathD} fill="none" stroke="#4F8CFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={hoveredIdx === i ? 5 : coords.length < 30 ? 3 : 1.5}
            fill={c.equity >= startingCapital ? '#20C997' : '#FF5263'}
            stroke="#0B132B"
            strokeWidth="1.5"
            className="cursor-pointer transition-all duration-150"
            onMouseEnter={() => setHoveredIdx(i)}
          />
        ))}

        {/* Active Hover Guide */}
        {hoveredPoint && (
          <g>
            <line
              x1={hoveredPoint.x}
              y1={padding.top}
              x2={hoveredPoint.x}
              y2={padding.top + graphHeight}
              stroke="#94A3B8"
              strokeDasharray="2 2"
            />
            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="6" fill="#FFFFFF" stroke="#4F8CFF" strokeWidth="2" />
          </g>
        )}
      </svg>

      {/* Tooltip */}
      {hoveredPoint && (
        <div
          className="pointer-events-none absolute z-20 rounded bg-slate-900/95 border border-slate-700 px-3 py-1.5 shadow-xl text-xs backdrop-blur-sm"
          style={{
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${(hoveredPoint.y / chartHeight) * 100}%`,
            transform: 'translate(-50%, -125%)'
          }}
        >
          <div className="font-semibold text-slate-200">${hoveredPoint.equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div className="text-slate-400 font-mono text-[10px]">{hoveredPoint.date}</div>
          <div className={`text-[10px] font-medium ${hoveredPoint.equity >= startingCapital ? 'text-emerald-400' : 'text-rose-400'}`}>
            {hoveredPoint.equity >= startingCapital ? '+' : ''}
            {(((hoveredPoint.equity - startingCapital) / startingCapital) * 100).toFixed(2)}%
          </div>
        </div>
      )}
    </div>
  );
};

interface DailyPnLBar {
  date: string;
  pnl: number;
  tradesCount: number;
}

export const DailyPnLBarChart: React.FC<{ data: DailyPnLBar[]; height?: number }> = ({ data, height = 200 }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-lg border border-slate-800 bg-slate-900/40 text-slate-500 text-sm">
        No daily records yet.
      </div>
    );
  }

  const values = data.map(d => d.pnl);
  const maxVal = Math.max(...values, 50);
  const minVal = Math.min(...values, -50);
  const absMax = Math.max(Math.abs(maxVal), Math.abs(minVal));

  const width = 600;
  const padding = { top: 15, right: 25, bottom: 25, left: 55 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  const zeroY = padding.top + (absMax / (absMax * 2)) * graphHeight;

  const barWidth = Math.max(4, Math.min(28, (graphWidth / data.length) * 0.7));

  return (
    <div className="relative w-full overflow-hidden select-none">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {/* Zero Axis */}
        <line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY} stroke="#475569" strokeWidth="1.2" />

        {/* Labels for Max/Min */}
        <text x={padding.left - 8} y={padding.top + 10} textAnchor="end" fill="#20C997" fontSize="10" fontFamily="monospace">
          +${absMax.toFixed(0)}
        </text>
        <text x={padding.left - 8} y={zeroY + 3} textAnchor="end" fill="#64748B" fontSize="10" fontFamily="monospace">
          $0
        </text>
        <text x={padding.left - 8} y={padding.top + graphHeight} textAnchor="end" fill="#FF5263" fontSize="10" fontFamily="monospace">
          -${absMax.toFixed(0)}
        </text>

        {/* Bars */}
        {data.map((d, i) => {
          const x = padding.left + (i / data.length) * graphWidth + (graphWidth / data.length - barWidth) / 2;
          const barHeight = Math.abs(d.pnl) / (absMax * 2) * graphHeight;
          const y = d.pnl >= 0 ? zeroY - barHeight : zeroY;
          const isPos = d.pnl >= 0;

          return (
            <g key={i} onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)} className="cursor-pointer">
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(2, barHeight)}
                rx="2"
                fill={isPos ? '#20C997' : '#FF5263'}
                opacity={hoveredIdx === i ? 1 : 0.85}
                className="transition-all"
              />
            </g>
          );
        })}
      </svg>

      {hoveredIdx !== null && data[hoveredIdx] && (
        <div className="absolute top-2 right-4 rounded border border-slate-700 bg-slate-900/95 px-3 py-1.5 text-xs text-slate-200 shadow-lg">
          <div className="font-mono text-slate-400">{data[hoveredIdx].date}</div>
          <div className={`font-semibold ${data[hoveredIdx].pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {data[hoveredIdx].pnl >= 0 ? '+' : ''}${data[hoveredIdx].pnl.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-400">{data[hoveredIdx].tradesCount} trade(s)</div>
        </div>
      )}
    </div>
  );
};

export const DrawdownCurveChart: React.FC<{ data: { date: string; ddPercent: number }[]; height?: number }> = ({
  data,
  height = 180
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-lg border border-slate-800 bg-slate-900/40 text-slate-500 text-sm">
        No drawdown recorded.
      </div>
    );
  }

  const maxDD = Math.max(...data.map(d => d.ddPercent), 5);
  const width = 600;
  const padding = { top: 15, right: 25, bottom: 25, left: 55 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  const coords = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1 || 1)) * graphWidth;
    const y = padding.top + (d.ddPercent / maxDD) * graphHeight;
    return { x, y, ...d };
  });

  const pathD = coords.reduce((acc, c, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`, '');
  const areaD = `${pathD} L ${coords[coords.length - 1].x} ${padding.top} L ${coords[0].x} ${padding.top} Z`;

  return (
    <div className="w-full select-none">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        <defs>
          <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF5263" stopOpacity="0.0" />
            <stop offset="100%" stopColor="#FF5263" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Top 0% line */}
        <line x1={padding.left} y1={padding.top} x2={width - padding.right} y2={padding.top} stroke="#475569" />
        <text x={padding.left - 8} y={padding.top + 4} textAnchor="end" fill="#64748B" fontSize="10" fontFamily="monospace">
          0.0%
        </text>
        <text x={padding.left - 8} y={padding.top + graphHeight} textAnchor="end" fill="#FF5263" fontSize="10" fontFamily="monospace">
          -{maxDD.toFixed(1)}%
        </text>

        <path d={areaD} fill="url(#ddGrad)" />
        <path d={pathD} fill="none" stroke="#FF5263" strokeWidth="2" />
      </svg>
    </div>
  );
};
