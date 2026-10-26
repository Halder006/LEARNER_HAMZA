/**
 * Learner HAMZA - Calendar & Daily Loss Tracker View
 * Monthly interactive P&L calendar with daily risk allowance monitor
 */

import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Calendar as CalendarIcon,
  DollarSign,
  TrendingUp,
  TrendingDown,
  X
} from 'lucide-react';
import { Trade, KillSwitchSettings, Account } from '../../types';

interface CalendarViewPageProps {
  trades: Trade[];
  killSwitchSettings: KillSwitchSettings;
  account: Account | null;
  dailyLossConsumed: number;
  dailyLossLimit: number;
  remainingDailyLoss: number;
  onSelectTrade: (trade: Trade) => void;
}

export const CalendarViewPage: React.FC<CalendarViewPageProps> = ({
  trades,
  killSwitchSettings,
  account,
  dailyLossConsumed,
  dailyLossLimit,
  remainingDailyLoss,
  onSelectTrade
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayTrades, setSelectedDayTrades] = useState<{ date: string; trades: Trade[] } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Aggregate trades by day
  const dailyDataMap = useMemo(() => {
    const map: Record<string, { pnl: number; count: number; wins: number; losses: number; trades: Trade[] }> = {};

    trades.forEach(t => {
      const d = t.tradeDate;
      if (!map[d]) {
        map[d] = { pnl: 0, count: 0, wins: 0, losses: 0, trades: [] };
      }
      const net = t.netPnL || 0;
      map[d].pnl += net;
      map[d].count += 1;
      if (net > 0) map[d].wins += 1;
      else if (net < 0) map[d].losses += 1;
      map[d].trades.push(t);
    });

    return map;
  }, [trades]);

  // Calendar math
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Monthly stats
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthTrades = trades.filter(t => t.tradeDate.startsWith(monthPrefix));
  const monthNetPnL = monthTrades.reduce((sum, t) => sum + (t.netPnL || 0), 0);
  const monthWins = monthTrades.filter(t => (t.netPnL || 0) > 0).length;
  const monthWinRate = monthTrades.length > 0 ? ((monthWins / monthTrades.length) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-blue-400" />
            <span>Trading Calendar & Daily Loss Monitor</span>
          </h2>
          <p className="text-xs text-slate-400">
            Daily P&L aggregation and risk threshold tracking
          </p>
        </div>

        {/* Month Selector Controls */}
        <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
          <button
            onClick={prevMonth}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-semibold text-xs text-slate-200 px-3 font-mono">
            {monthNames[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Persistent Daily Loss Monitor Widget */}
      <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-4 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Today's Realized Loss</span>
          <div className="font-mono text-base font-bold text-slate-100 mt-1">
            ${dailyLossConsumed.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500">From closed trades today</span>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Daily Loss Limit</span>
          <div className="font-mono text-base font-bold text-slate-300 mt-1">
            ${dailyLossLimit.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500">Configured in Master Control</span>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Remaining Allowance</span>
          <div className={`font-mono text-base font-bold mt-1 ${remainingDailyLoss > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            ${remainingDailyLoss.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500">
            {remainingDailyLoss > 0 ? 'Safe to trade within limit' : 'Limit fully consumed'}
          </span>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Monthly Net P&L</span>
          <div className={`font-mono text-base font-bold mt-1 ${monthNetPnL >= 0 ? 'text-[#20C997]' : 'text-[#FF5263]'}`}>
            {monthNetPnL >= 0 ? '+' : ''}${monthNetPnL.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {monthTrades.length} trades ({monthWinRate}% win rate)
          </span>
        </div>
      </div>

      {/* Monthly Calendar Grid */}
      <div className="rounded-xl border border-slate-800 bg-[#111C2D] overflow-hidden shadow-xs">
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-900/60 text-center text-[11px] font-bold text-slate-400 uppercase py-2.5">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-800/60">
          {/* Leading empty slots */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-24 bg-slate-950/20 p-2" />
          ))}

          {/* Month days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dayString = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const dayData = dailyDataMap[dayString];
            const isToday = dayString === new Date().toISOString().split('T')[0];

            return (
              <div
                key={dayString}
                onClick={() => {
                  if (dayData && dayData.count > 0) {
                    setSelectedDayTrades({ date: dayString, trades: dayData.trades });
                  }
                }}
                className={`min-h-24 p-2 transition flex flex-col justify-between ${
                  dayData && dayData.count > 0 ? 'cursor-pointer hover:bg-slate-800/40' : ''
                } ${isToday ? 'bg-blue-950/20 ring-1 ring-blue-500/30' : ''}`}
              >
                {/* Day Number */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-mono font-semibold ${isToday ? 'text-blue-400 font-bold' : 'text-slate-400'}`}>
                    {dayNum}
                  </span>
                  {dayData && dayData.count > 0 && (
                    <span className="rounded bg-slate-800 px-1 py-0.2 text-[9px] font-mono text-slate-400">
                      {dayData.count}t
                    </span>
                  )}
                </div>

                {/* Daily P&L Indicator */}
                {dayData && dayData.count > 0 ? (
                  <div className="mt-2 text-center">
                    <div className={`font-mono text-xs font-bold ${
                      dayData.pnl >= 0 ? 'text-[#20C997]' : 'text-[#FF5263]'
                    }`}>
                      {dayData.pnl >= 0 ? '+' : ''}${dayData.pnl.toFixed(0)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {dayData.wins}W / {dayData.losses}L
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-600 text-center">—</div>
                )}

                {/* Kill Switch Marker if net loss on this day reached limit */}
                {dayData && dayData.pnl <= -killSwitchSettings.maxDailyNetLoss && (
                  <div className="mt-1 flex items-center justify-center gap-1 rounded bg-red-950/40 text-[9px] font-bold text-red-400 border border-red-500/20 py-0.5">
                    <ShieldAlert className="h-2.5 w-2.5" />
                    <span>LIMIT HIT</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Trades Modal */}
      {selectedDayTrades && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 p-4">
              <div>
                <h3 className="font-bold text-slate-100 text-sm">
                  Trades for {selectedDayTrades.date}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedDayTrades.trades.length} executions logged
                </p>
              </div>
              <button
                onClick={() => setSelectedDayTrades(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2">
              {selectedDayTrades.trades.map(trade => (
                <div
                  key={trade.id}
                  onClick={() => {
                    setSelectedDayTrades(null);
                    onSelectTrade(trade);
                  }}
                  className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 hover:border-slate-700 cursor-pointer transition flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${trade.direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {trade.direction}
                      </span>
                      <span className="font-bold text-slate-200">{trade.asset}</span>
                      <span className="text-slate-500 font-mono text-[10px]">{trade.id}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      ${trade.entryPrice} → {trade.exitPrice ? `$${trade.exitPrice}` : 'Open'} ({trade.positionSize} lots)
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className={`font-bold text-sm ${
                      (trade.netPnL || 0) >= 0 ? 'text-[#20C997]' : 'text-[#FF5263]'
                    }`}>
                      {(trade.netPnL || 0) >= 0 ? '+' : ''}${trade.netPnL?.toFixed(2) || 'Open'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {trade.actualR !== undefined ? `${trade.actualR}R` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
