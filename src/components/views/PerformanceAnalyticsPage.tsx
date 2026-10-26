/**
 * Learner HAMZA - Advanced Performance Intelligence View
 * Quantitative trading statistics, Strategy-wise & Timeframe-wise analysis,
 * Day-of-Week breakdown, Date-to-date range picker, and Clickable Trade Detail Modal.
 */

import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  Award,
  ShieldCheck,
  Percent,
  DollarSign,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  BookOpen,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Calendar
} from 'lucide-react';
import { Trade, Account, Strategy } from '../../types';
import { calculatePerformanceMetrics } from '../../services/calculationEngine';
import { TradeDetailModal } from '../modals/TradeDetailModal';

interface PerformanceAnalyticsPageProps {
  trades: Trade[];
  account: Account | null;
  strategies: Strategy[];
  onEditTrade?: (trade: Trade) => void;
}

const TIMEFRAME_OPTIONS = [
  'ALL',
  '1m',
  '2m',
  '5m',
  '15m',
  '30m',
  '1hr',
  '2hr',
  '4hr',
  '1D',
  '1W'
];

const DAYS_OF_WEEK = [
  { label: 'All Days', value: 'ALL' },
  { label: 'Monday', value: '1' },
  { label: 'Tuesday', value: '2' },
  { label: 'Wednesday', value: '3' },
  { label: 'Thursday', value: '4' },
  { label: 'Friday', value: '5' },
  { label: 'Saturday', value: '6' },
  { label: 'Sunday', value: '0' }
];

export const PerformanceAnalyticsPage: React.FC<PerformanceAnalyticsPageProps> = ({
  trades,
  account,
  strategies,
  onEditTrade
}) => {
  // Filters
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | '7d' | '30d' | '90d' | 'ytd' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [assetFilter, setAssetFilter] = useState<string>('ALL');
  const [directionFilter, setDirectionFilter] = useState<string>('ALL');
  const [dayOfWeekFilter, setDayOfWeekFilter] = useState<string>('ALL');
  const [strategyFilter, setStrategyFilter] = useState<string>('ALL');
  const [timeframeFilter, setTimeframeFilter] = useState<string>('ALL');

  // Selected trade for detail modal
  const [inspectedTrade, setInspectedTrade] = useState<Trade | null>(null);

  const startingCapital = account?.startingCapital || 10000;

  const stratMap = useMemo(() => {
    const map: Record<string, string> = {};
    strategies.forEach(s => {
      map[s.id] = s.name;
    });
    return map;
  }, [strategies]);

  // Filter trades
  const filteredTrades = useMemo(() => {
    let list = trades.filter(t => t.status === 'Closed' && !t.isDraft);

    if (assetFilter !== 'ALL') {
      list = list.filter(t => t.asset.toUpperCase().includes(assetFilter.toUpperCase()));
    }
    if (directionFilter !== 'ALL') {
      list = list.filter(t => t.direction === directionFilter);
    }
    if (strategyFilter !== 'ALL') {
      list = list.filter(t => t.strategyId === strategyFilter || t.strategyName === strategyFilter);
    }
    if (timeframeFilter !== 'ALL') {
      list = list.filter(t => (t.timeframe || '15m') === timeframeFilter);
    }
    if (dayOfWeekFilter !== 'ALL') {
      const targetDay = parseInt(dayOfWeekFilter, 10);
      list = list.filter(t => {
        const d = new Date(t.tradeDate + 'T12:00:00Z');
        return d.getUTCDay() === targetDay;
      });
    }

    const now = new Date();
    if (periodFilter === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      list = list.filter(t => t.tradeDate === todayStr);
    } else if (periodFilter === '7d') {
      const past7 = new Date(now.getTime() - 7 * 86400000);
      list = list.filter(t => new Date(t.tradeDate) >= past7);
    } else if (periodFilter === '30d') {
      const past30 = new Date(now.getTime() - 30 * 86400000);
      list = list.filter(t => new Date(t.tradeDate) >= past30);
    } else if (periodFilter === '90d') {
      const past90 = new Date(now.getTime() - 90 * 86400000);
      list = list.filter(t => new Date(t.tradeDate) >= past90);
    } else if (periodFilter === 'ytd') {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      list = list.filter(t => new Date(t.tradeDate) >= yearStart);
    } else if (periodFilter === 'custom') {
      list = list.filter(t => t.tradeDate >= startDate && t.tradeDate <= endDate);
    }

    return list.sort((a, b) => new Date(b.entryTime || b.tradeDate).getTime() - new Date(a.entryTime || a.tradeDate).getTime());
  }, [
    trades,
    assetFilter,
    directionFilter,
    strategyFilter,
    timeframeFilter,
    dayOfWeekFilter,
    periodFilter,
    startDate,
    endDate
  ]);

  const metrics = useMemo(() => {
    return calculatePerformanceMetrics(filteredTrades, startingCapital);
  }, [filteredTrades, startingCapital]);

  // Strategy Breakdown
  const strategyBreakdown = useMemo(() => {
    const groups: Record<string, Trade[]> = {};
    filteredTrades.forEach(t => {
      const key = t.strategyName || stratMap[t.strategyId || ''] || 'Discretionary / Other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });

    return Object.entries(groups).map(([name, groupTrades]) => {
      const total = groupTrades.length;
      const wins = groupTrades.filter(t => (t.netPnL || 0) > 0);
      const losses = groupTrades.filter(t => (t.netPnL || 0) < 0);
      const winRate = total > 0 ? (wins.length / total) * 100 : 0;
      const netPnL = groupTrades.reduce((sum, t) => sum + (t.netPnL || 0), 0);
      const grossWins = wins.reduce((sum, t) => sum + (t.netPnL || 0), 0);
      const grossLosses = Math.abs(losses.reduce((sum, t) => sum + (t.netPnL || 0), 0));
      const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? 99 : 0;
      const avgR = groupTrades.reduce((sum, t) => sum + (t.actualR || 0), 0) / (total || 1);

      return {
        name,
        total,
        winsCount: wins.length,
        lossesCount: losses.length,
        winRate: Number(winRate.toFixed(1)),
        netPnL: Number(netPnL.toFixed(2)),
        profitFactor: Number(profitFactor.toFixed(2)),
        avgR: Number(avgR.toFixed(2))
      };
    }).sort((a, b) => b.netPnL - a.netPnL);
  }, [filteredTrades, stratMap]);

  // Timeframe Breakdown
  const timeframeBreakdown = useMemo(() => {
    const groups: Record<string, Trade[]> = {};
    filteredTrades.forEach(t => {
      const tf = t.timeframe || '15m';
      if (!groups[tf]) groups[tf] = [];
      groups[tf].push(t);
    });

    return Object.entries(groups).map(([tf, groupTrades]) => {
      const total = groupTrades.length;
      const wins = groupTrades.filter(t => (t.netPnL || 0) > 0);
      const losses = groupTrades.filter(t => (t.netPnL || 0) < 0);
      const winRate = total > 0 ? (wins.length / total) * 100 : 0;
      const netPnL = groupTrades.reduce((sum, t) => sum + (t.netPnL || 0), 0);

      return {
        timeframe: tf,
        total,
        winsCount: wins.length,
        lossesCount: losses.length,
        winRate: Number(winRate.toFixed(1)),
        netPnL: Number(netPnL.toFixed(2))
      };
    }).sort((a, b) => b.netPnL - a.netPnL);
  }, [filteredTrades]);

  // Long vs Short
  const longTrades = filteredTrades.filter(t => t.direction === 'LONG');
  const shortTrades = filteredTrades.filter(t => t.direction === 'SHORT');
  const longMetrics = useMemo(() => calculatePerformanceMetrics(longTrades, startingCapital), [longTrades, startingCapital]);
  const shortMetrics = useMemo(() => calculatePerformanceMetrics(shortTrades, startingCapital), [shortTrades, startingCapital]);

  // Day of Week Analysis
  const dayOfWeekBreakdown = useMemo(() => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const groups: Record<number, Trade[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 0: [] };

    filteredTrades.forEach(t => {
      const d = new Date(t.tradeDate + 'T12:00:00Z');
      const day = d.getUTCDay();
      if (groups[day]) groups[day].push(t);
    });

    return [1, 2, 3, 4, 5, 6, 0].map(dayIdx => {
      const group = groups[dayIdx];
      const total = group.length;
      const wins = group.filter(t => (t.netPnL || 0) > 0);
      const winRate = total > 0 ? (wins.length / total) * 100 : 0;
      const net = group.reduce((sum, t) => sum + (t.netPnL || 0), 0);

      return {
        dayName: dayNames[dayIdx],
        total,
        winRate: Number(winRate.toFixed(1)),
        netPnL: Number(net.toFixed(2))
      };
    }).filter(d => d.total > 0);
  }, [filteredTrades]);

  const formatExecutionTime = (timeStr?: string) => {
    if (!timeStr) return '—';
    try {
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) return timeStr;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return timeStr;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-400" />
            <span>Performance Intelligence & Analytics</span>
          </h2>
          <p className="text-xs text-slate-400">
            Validated trading metrics calculated from {filteredTrades.length} eligible closed trades
          </p>
        </div>

        {/* Filter Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex rounded-lg border border-slate-800 bg-slate-900/60 p-1 text-xs">
            {(['all', 'today', '7d', '30d', '90d', 'ytd', 'custom'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriodFilter(p)}
                className={`rounded px-2.5 py-1 font-medium transition ${
                  periodFilter === p ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p === 'all' ? 'All Time' : p === 'today' ? 'Today' : p === '7d' ? '7D' : p === '30d' ? '30D' : p === '90d' ? '90D' : p === 'ytd' ? 'YTD' : 'Date Range'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* FILTER BAR: Date to Date, Day-of-week, Long/Short, Strategy, Timeframe */}
      <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-4 space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 border-b border-slate-800 pb-2">
          <Filter className="h-3.5 w-3.5 text-blue-400" />
          <span>Multi-Dimensional Filtering</span>
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 uppercase font-semibold block">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                setPeriodFilter('custom');
              }}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase font-semibold block">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => {
                setEndDate(e.target.value);
                setPeriodFilter('custom');
              }}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase font-semibold block">Day of Week</label>
            <select
              value={dayOfWeekFilter}
              onChange={e => setDayOfWeekFilter(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              {DAYS_OF_WEEK.map(d => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase font-semibold block">Direction</label>
            <select
              value={directionFilter}
              onChange={e => setDirectionFilter(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Directions</option>
              <option value="LONG">Longs Only (Buy)</option>
              <option value="SHORT">Shorts Only (Sell)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase font-semibold block">Strategy</label>
            <select
              value={strategyFilter}
              onChange={e => setStrategyFilter(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Strategies</option>
              {strategies.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase font-semibold block">Timeframe</label>
            <select
              value={timeframeFilter}
              onChange={e => setTimeframeFilter(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              {TIMEFRAME_OPTIONS.map(tf => (
                <option key={tf} value={tf}>
                  {tf === 'ALL' ? 'All Timeframes' : `${tf} Chart`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main KPI Matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-3.5 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Net Trading P&L</span>
          <div className={`mt-1 font-mono text-xl font-extrabold ${metrics.netPnL >= 0 ? 'text-[#20C997]' : 'text-[#FF5263]'}`}>
            {metrics.netPnL >= 0 ? '+' : ''}${metrics.netPnL.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {metrics.returnOnCapitalPercent >= 0 ? '+' : ''}{metrics.returnOnCapitalPercent}% return
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-3.5 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Win Rate</span>
          <div className="mt-1 font-mono text-xl font-extrabold text-slate-100">
            {metrics.winRate}%
          </div>
          <span className="text-[10px] text-slate-500">
            {metrics.winningTrades}W / {metrics.losingTrades}L ({metrics.breakEvenTrades} BE)
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-3.5 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Profit Factor</span>
          <div className="mt-1 font-mono text-xl font-extrabold text-slate-100">
            {metrics.profitFactor !== null ? metrics.profitFactor : 'N/A'}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Wins ${metrics.grossProfit.toFixed(0)} / Losses ${metrics.grossLoss.toFixed(0)}
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-3.5 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Expectancy</span>
          <div className={`mt-1 font-mono text-xl font-extrabold ${metrics.expectancy >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {metrics.expectancy >= 0 ? '+' : ''}${metrics.expectancy.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Avg R: {metrics.expectancyR > 0 ? `+${metrics.expectancyR}R` : `${metrics.expectancyR}R`}
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-3.5 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Max Drawdown</span>
          <div className="mt-1 font-mono text-xl font-extrabold text-rose-400">
            -{metrics.maxDrawdownPercent}%
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            -${metrics.maxDrawdownAmount.toFixed(2)}
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-3.5 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Plan Compliance</span>
          <div className="mt-1 font-mono text-xl font-extrabold text-blue-400">
            {metrics.ruleAdherenceRate}%
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {metrics.winningTrades + metrics.losingTrades} Closed
          </span>
        </div>
      </div>

      {/* STRATEGY & TIMEFRAME INTELLIGENCE TABLES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strategy Breakdown */}
        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-amber-400" />
              <span>Strategy-Wise Intelligence</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">{strategyBreakdown.length} setups</span>
          </div>

          {strategyBreakdown.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">No trades match filter criteria.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-slate-800 bg-slate-900/60 text-[10px] uppercase text-slate-400">
                  <tr>
                    <th className="py-2 px-2.5">Strategy</th>
                    <th className="py-2 px-2 text-center">Trades</th>
                    <th className="py-2 px-2 text-center">Win Rate</th>
                    <th className="py-2 px-2 text-right">Net P&L</th>
                    <th className="py-2 px-2 text-right">PF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {strategyBreakdown.map(s => (
                    <tr key={s.name} className="hover:bg-slate-800/30 transition">
                      <td className="py-2.5 px-2.5 font-sans font-semibold text-slate-200">
                        {s.name}
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-300">
                        {s.total} <span className="text-[10px] text-slate-500">({s.winsCount}W/{s.lossesCount}L)</span>
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-100">
                        {s.winRate}%
                      </td>
                      <td className={`py-2.5 px-2 text-right font-extrabold ${s.netPnL >= 0 ? 'text-[#20C997]' : 'text-[#FF5263]'}`}>
                        {s.netPnL >= 0 ? '+' : ''}${s.netPnL.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-300 font-bold">
                        {s.profitFactor}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Timeframe Breakdown */}
        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-blue-400" />
              <span>Timeframe-Wise Intelligence</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">{timeframeBreakdown.length} timeframes</span>
          </div>

          {timeframeBreakdown.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">No trades match filter criteria.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-slate-800 bg-slate-900/60 text-[10px] uppercase text-slate-400">
                  <tr>
                    <th className="py-2 px-2.5">Timeframe</th>
                    <th className="py-2 px-2 text-center">Trades</th>
                    <th className="py-2 px-2 text-center">Win Rate</th>
                    <th className="py-2 px-2 text-right">Net P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {timeframeBreakdown.map(tf => (
                    <tr key={tf.timeframe} className="hover:bg-slate-800/30 transition">
                      <td className="py-2.5 px-2.5">
                        <span className="rounded bg-blue-500/20 border border-blue-500/30 px-1.5 py-0.5 text-[11px] font-bold text-blue-300">
                          {tf.timeframe}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-300">
                        {tf.total} <span className="text-[10px] text-slate-500">({tf.winsCount}W/{tf.lossesCount}L)</span>
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-100">
                        {tf.winRate}%
                      </td>
                      <td className={`py-2.5 px-2 text-right font-extrabold ${tf.netPnL >= 0 ? 'text-[#20C997]' : 'text-[#FF5263]'}`}>
                        {tf.netPnL >= 0 ? '+' : ''}${tf.netPnL.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* DIRECTION (LONG VS SHORT) & DAY-OF-WEEK CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Long vs Short */}
        <div className="rounded-xl border border-slate-800 bg-[#111C2D] overflow-hidden shadow-xs">
          <div className="border-b border-slate-800 px-4 py-3 font-bold text-xs text-slate-200 flex items-center justify-between">
            <span>Directional Breakdown: Long vs Short</span>
          </div>
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900/40 text-[10px] text-slate-400 uppercase">
              <tr>
                <th className="py-2 px-3">Direction</th>
                <th className="py-2 px-3">Trades</th>
                <th className="py-2 px-3">Win %</th>
                <th className="py-2 px-3">Net P&L</th>
                <th className="py-2 px-3">Profit Factor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              <tr>
                <td className="py-2.5 px-3 font-sans font-bold text-emerald-400 flex items-center gap-1">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>LONG</span>
                </td>
                <td className="py-2.5 px-3 text-slate-300">{longMetrics.totalTrades}</td>
                <td className="py-2.5 px-3 text-slate-300">{longMetrics.winRate}%</td>
                <td className={`py-2.5 px-3 font-bold ${longMetrics.netPnL >= 0 ? 'text-[#20C997]' : 'text-[#FF5263]'}`}>
                  {longMetrics.netPnL >= 0 ? '+' : ''}${longMetrics.netPnL.toFixed(2)}
                </td>
                <td className="py-2.5 px-3 text-slate-300">{longMetrics.profitFactor ?? 'N/A'}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-sans font-bold text-rose-400 flex items-center gap-1">
                  <ArrowDownRight className="h-3.5 w-3.5" />
                  <span>SHORT</span>
                </td>
                <td className="py-2.5 px-3 text-slate-300">{shortMetrics.totalTrades}</td>
                <td className="py-2.5 px-3 text-slate-300">{shortMetrics.winRate}%</td>
                <td className={`py-2.5 px-3 font-bold ${shortMetrics.netPnL >= 0 ? 'text-[#20C997]' : 'text-[#FF5263]'}`}>
                  {shortMetrics.netPnL >= 0 ? '+' : ''}${shortMetrics.netPnL.toFixed(2)}
                </td>
                <td className="py-2.5 px-3 text-slate-300">{shortMetrics.profitFactor ?? 'N/A'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Day of Week */}
        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-4 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block border-b border-slate-800 pb-2">
            Day-Of-Week Results
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-xs pt-1">
            {dayOfWeekBreakdown.map(d => (
              <div key={d.dayName} className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                <div className="flex justify-between items-center text-[10px] font-sans font-bold text-slate-300">
                  <span>{d.dayName}</span>
                  <span className="text-slate-500">{d.total} trd</span>
                </div>
                <div className={`mt-1 font-bold ${d.netPnL >= 0 ? 'text-[#20C997]' : 'text-[#FF5263]'}`}>
                  {d.netPnL >= 0 ? '+' : ''}${d.netPnL.toFixed(0)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">WR: {d.winRate}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RECENT EXECUTIONS LIST WITH CLICKABLE PROFIT/LOSS FOR DETAILS */}
      <div className="rounded-xl border border-slate-800 bg-[#111C2D] overflow-hidden shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              <span>Execution Log ({filteredTrades.length} Trades)</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Click on any Profit or Loss to open full trade detail inspection
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-slate-800 bg-slate-900/70 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              <tr>
                <th className="py-3 px-3">Date / Time</th>
                <th className="py-3 px-3">Asset</th>
                <th className="py-3 px-2">TF</th>
                <th className="py-3 px-3">Dir</th>
                <th className="py-3 px-3">Strategy</th>
                <th className="py-3 px-3">Entry → Exit</th>
                <th className="py-3 px-2 text-center">Lots</th>
                <th className="py-3 px-4 text-center">Net P&L ($)</th>
                <th className="py-3 px-2 text-center">Actual R</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredTrades.slice(0, 50).map(trade => {
                const isLong = trade.direction === 'LONG';
                const isWin = (trade.netPnL || 0) > 0;
                const isLoss = (trade.netPnL || 0) < 0;

                return (
                  <tr
                    key={trade.id}
                    onClick={() => setInspectedTrade(trade)}
                    className="cursor-pointer hover:bg-slate-800/40 transition group"
                  >
                    <td className="py-3 px-3 font-sans">
                      <div className="font-semibold text-slate-200 text-xs">{trade.tradeDate}</div>
                      <div className="text-[10px] text-blue-400 font-mono flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3 inline text-slate-500" />
                        <span>{formatExecutionTime(trade.entryTime)}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-sans font-bold">
                      <span className={trade.asset.includes('XAU') ? 'text-amber-400' : 'text-orange-400'}>
                        {trade.asset}
                      </span>
                    </td>

                    <td className="py-3 px-2">
                      <span className="rounded bg-blue-500/10 border border-blue-500/20 px-1 py-0.5 text-[10px] font-bold text-blue-300">
                        {trade.timeframe || '15m'}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-sans font-bold">
                      <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] ${
                        isLong
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}>
                        {isLong ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {trade.direction}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-sans text-slate-300 truncate max-w-[130px]">
                      {trade.strategyName || stratMap[trade.strategyId || ''] || 'Discretionary'}
                    </td>

                    <td className="py-3 px-3 text-slate-300">
                      ${trade.entryPrice} → {trade.exitPrice !== undefined ? `$${trade.exitPrice}` : 'Open'}
                    </td>

                    <td className="py-3 px-2 text-center text-slate-300">
                      {trade.positionSize}
                    </td>

                    {/* Net P&L Clickable Badge */}
                    <td className="py-3 px-4 text-center">
                      <div className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-black shadow-xs transition group-hover:scale-105 ${
                        isWin
                          ? 'bg-emerald-500/20 text-[#20C997] border border-emerald-500/40'
                          : isLoss
                          ? 'bg-rose-500/20 text-[#FF5263] border border-rose-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        <span>
                          {trade.netPnL !== undefined
                            ? `${trade.netPnL >= 0 ? '+' : ''}$${trade.netPnL.toFixed(2)}`
                            : 'Open'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-2 text-center font-bold">
                      {trade.actualR !== undefined ? (
                        <span className={trade.actualR > 0 ? 'text-emerald-400' : trade.actualR < 0 ? 'text-rose-400' : 'text-slate-400'}>
                          {trade.actualR > 0 ? `+${trade.actualR}R` : `${trade.actualR}R`}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-sans">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setInspectedTrade(trade);
                        }}
                        className="rounded p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trade Detail Inspection Modal */}
      {inspectedTrade && (
        <TradeDetailModal
          trade={inspectedTrade}
          onClose={() => setInspectedTrade(null)}
          onEdit={onEditTrade}
          strategyNameMap={stratMap}
        />
      )}
    </div>
  );
};
