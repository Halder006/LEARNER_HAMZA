/**
 * Learner HAMZA - Advanced Reports Center
 * Comprehensive Part-by-Part Financial & Quantitative Report:
 * Day-wise, Long/Short-wise, Date-to-Date range picker, Strategy-wise, Timeframe-wise,
 * Execution Timing (Exact Time & Session), and Clickable Profit/Loss Trade Detail Drawer.
 */

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Printer,
  Download,
  Calendar,
  Layers,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Clock,
  BookOpen,
  ArrowUpRight,
  ArrowDownRight,
  BarChart2,
  CheckCircle,
  XCircle,
  Eye,
  Filter,
  Activity,
  Award
} from 'lucide-react';
import { Trade, Account, Strategy, KillSwitchSettings } from '../../types';
import { calculatePerformanceMetrics } from '../../services/calculationEngine';
import { exportExcelWorkbook } from '../../services/exportImportService';
import { TradeDetailModal } from '../modals/TradeDetailModal';

interface ReportsCenterPageProps {
  trades: Trade[];
  account: Account | null;
  strategies: Strategy[];
  killSwitchSettings: KillSwitchSettings;
  onEditTrade?: (trade: Trade) => void;
  onRefreshData?: () => void;
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

export const ReportsCenterPage: React.FC<ReportsCenterPageProps> = ({
  trades,
  account,
  strategies,
  killSwitchSettings,
  onEditTrade,
  onRefreshData
}) => {
  // 1. Period / Date Range Filters
  const [periodPreset, setPeriodPreset] = useState<'today' | '7d' | '30d' | '90d' | 'ytd' | 'all' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // 2. Multidimensional Filters
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');
  const [dayOfWeekFilter, setDayOfWeekFilter] = useState<string>('ALL');
  const [strategyFilter, setStrategyFilter] = useState<string>('ALL');
  const [timeframeFilter, setTimeframeFilter] = useState<string>('ALL');
  const [assetFilter, setAssetFilter] = useState<string>('ALL');
  const [activeReportTab, setActiveReportTab] = useState<'all' | 'strategy' | 'timeframe' | 'execution' | 'timing'>('all');

  // Selected trade for inspection modal
  const [inspectedTrade, setInspectedTrade] = useState<Trade | null>(null);

  const startingCapital = account?.startingCapital || 10000;

  // Strategies lookup map
  const stratMap = useMemo(() => {
    const map: Record<string, string> = {};
    strategies.forEach(s => {
      map[s.id] = s.name;
    });
    return map;
  }, [strategies]);

  // List of distinct assets present in trades
  const availableAssets = useMemo(() => {
    const set = new Set<string>();
    trades.forEach(t => {
      if (t.asset) set.add(t.asset);
    });
    return Array.from(set);
  }, [trades]);

  // Comprehensive Filtering Engine
  const filteredTrades = useMemo(() => {
    let list = trades.filter(t => t.status === 'Closed' && !t.isDraft);

    // Direction Filter
    if (directionFilter !== 'ALL') {
      list = list.filter(t => t.direction === directionFilter);
    }

    // Asset Filter
    if (assetFilter !== 'ALL') {
      list = list.filter(t => t.asset.toUpperCase().includes(assetFilter.toUpperCase()));
    }

    // Strategy Filter
    if (strategyFilter !== 'ALL') {
      list = list.filter(t => t.strategyId === strategyFilter || t.strategyName === strategyFilter);
    }

    // Timeframe Filter
    if (timeframeFilter !== 'ALL') {
      list = list.filter(t => (t.timeframe || '15m') === timeframeFilter);
    }

    // Day of Week Filter
    if (dayOfWeekFilter !== 'ALL') {
      const targetDay = parseInt(dayOfWeekFilter, 10);
      list = list.filter(t => {
        const d = new Date(t.tradeDate + 'T12:00:00Z');
        return d.getUTCDay() === targetDay;
      });
    }

    // Date / Period Filter
    const now = new Date();
    if (periodPreset === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      list = list.filter(t => t.tradeDate === todayStr);
    } else if (periodPreset === '7d') {
      const start = new Date(now.getTime() - 7 * 86400000);
      list = list.filter(t => new Date(t.tradeDate) >= start);
    } else if (periodPreset === '30d') {
      const start = new Date(now.getTime() - 30 * 86400000);
      list = list.filter(t => new Date(t.tradeDate) >= start);
    } else if (periodPreset === '90d') {
      const start = new Date(now.getTime() - 90 * 86400000);
      list = list.filter(t => new Date(t.tradeDate) >= start);
    } else if (periodPreset === 'ytd') {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      list = list.filter(t => new Date(t.tradeDate) >= yearStart);
    } else if (periodPreset === 'custom') {
      list = list.filter(t => t.tradeDate >= startDate && t.tradeDate <= endDate);
    }

    return list.sort((a, b) => new Date(b.entryTime || b.tradeDate).getTime() - new Date(a.entryTime || a.tradeDate).getTime());
  }, [
    trades,
    directionFilter,
    assetFilter,
    strategyFilter,
    timeframeFilter,
    dayOfWeekFilter,
    periodPreset,
    startDate,
    endDate
  ]);

  // Overall Performance Metrics
  const metrics = useMemo(() => {
    return calculatePerformanceMetrics(filteredTrades, startingCapital);
  }, [filteredTrades, startingCapital]);

  // Part B: Strategy-wise Breakdown
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
      const avgR =
        groupTrades.reduce((sum, t) => sum + (t.actualR || 0), 0) / (total || 1);

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

  // Part C: Timeframe-wise Breakdown
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
      const avgR =
        groupTrades.reduce((sum, t) => sum + (t.actualR || 0), 0) / (total || 1);

      return {
        timeframe: tf,
        total,
        winsCount: wins.length,
        lossesCount: losses.length,
        winRate: Number(winRate.toFixed(1)),
        netPnL: Number(netPnL.toFixed(2)),
        avgR: Number(avgR.toFixed(2))
      };
    }).sort((a, b) => b.netPnL - a.netPnL);
  }, [filteredTrades]);

  // Part D: Direction Analysis (Long vs Short)
  const directionBreakdown = useMemo(() => {
    const longs = filteredTrades.filter(t => t.direction === 'LONG');
    const shorts = filteredTrades.filter(t => t.direction === 'SHORT');

    const getStats = (list: Trade[]) => {
      const total = list.length;
      const wins = list.filter(t => (t.netPnL || 0) > 0);
      const losses = list.filter(t => (t.netPnL || 0) < 0);
      const winRate = total > 0 ? (wins.length / total) * 100 : 0;
      const net = list.reduce((sum, t) => sum + (t.netPnL || 0), 0);
      return { total, wins: wins.length, losses: losses.length, winRate: Number(winRate.toFixed(1)), net: Number(net.toFixed(2)) };
    };

    return {
      long: getStats(longs),
      short: getStats(shorts)
    };
  }, [filteredTrades]);

  // Part E: Day of Week Breakdown
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
      const losses = group.filter(t => (t.netPnL || 0) < 0);
      const winRate = total > 0 ? (wins.length / total) * 100 : 0;
      const net = group.reduce((sum, t) => sum + (t.netPnL || 0), 0);

      return {
        dayIndex: dayIdx,
        dayName: dayNames[dayIdx],
        total,
        wins: wins.length,
        losses: losses.length,
        winRate: Number(winRate.toFixed(1)),
        netPnL: Number(net.toFixed(2))
      };
    });
  }, [filteredTrades]);

  // Part F: Execution Sessions & Hourly Breakdown
  const sessionBreakdown = useMemo(() => {
    const groups: Record<string, Trade[]> = {};
    filteredTrades.forEach(t => {
      const sess = t.session || 'London';
      if (!groups[sess]) groups[sess] = [];
      groups[sess].push(t);
    });

    return Object.entries(groups).map(([session, groupTrades]) => {
      const total = groupTrades.length;
      const wins = groupTrades.filter(t => (t.netPnL || 0) > 0);
      const winRate = total > 0 ? (wins.length / total) * 100 : 0;
      const net = groupTrades.reduce((sum, t) => sum + (t.netPnL || 0), 0);

      return {
        session,
        total,
        winRate: Number(winRate.toFixed(1)),
        netPnL: Number(net.toFixed(2))
      };
    }).sort((a, b) => b.netPnL - a.netPnL);
  }, [filteredTrades]);

  // Format execution time
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

  // CSV Export Action
  const handleExportCSV = () => {
    const headers = [
      'Trade ID',
      'Date',
      'Execution Time',
      'Session',
      'Asset',
      'Direction',
      'Timeframe',
      'Strategy',
      'Entry Price',
      'Exit Price',
      'Size',
      'Gross PnL',
      'Fees',
      'Net PnL',
      'Actual R',
      'Rule Followed',
      'Rule Breach Reason',
      'Description',
      'Remark',
      'Lessons Learned'
    ];

    const rows = filteredTrades.map(t => [
      t.id,
      t.tradeDate,
      t.entryTime || '',
      t.session,
      t.asset,
      t.direction,
      t.timeframe || '15m',
      t.strategyName || stratMap[t.strategyId || ''] || 'Discretionary',
      t.entryPrice,
      t.exitPrice !== undefined ? t.exitPrice : '',
      t.positionSize,
      t.grossPnL || 0,
      ((t.entryFees || 0) + (t.exitFees || 0) + (t.slippage || 0)).toFixed(2),
      t.netPnL !== undefined ? t.netPnL : 0,
      t.actualR !== undefined ? t.actualR : '',
      t.ruleFollowed ? 'YES' : 'NO',
      `"${(t.ruleBreachedReason || '').replace(/"/g, '""')}"`,
      `"${(t.description || t.entryReason || '').replace(/"/g, '""')}"`,
      `"${(t.remark || '').replace(/"/g, '""')}"`,
      `"${(t.lessonsLearned || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HAMZA_Performance_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Export Tools */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 print:hidden">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-400" />
            <span>Quantitative Performance & Statement Report</span>
          </h2>
          <p className="text-xs text-slate-400">
            A-to-Z Multi-Dimensional Intelligence: Strategy, Timeframe, Day-of-Week, Execution Timing & Trade Audit
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Report</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-600/20 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-600/30 transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => exportExcelWorkbook()}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* FILTER BAR: Date to Date, Day wise, Long/Short wise, Strategy, Timeframe, Asset */}
      <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-4 space-y-3 print:hidden">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-blue-400" />
            <span>Multi-Factor Filters ({filteredTrades.length} trades selected)</span>
          </span>

          {/* Quick Period Presets */}
          <div className="flex items-center gap-1">
            {(['all', 'today', '7d', '30d', '90d', 'ytd', 'custom'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriodPreset(p)}
                className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                  periodPreset === p
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {p === 'all' ? 'All Time' : p === 'today' ? 'Today' : p === '7d' ? '7D' : p === '30d' ? '30D' : p === '90d' ? '90D' : p === 'ytd' ? 'YTD' : 'Date Range'}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          {/* 1. Date to Date Pickers */}
          <div>
            <label className="text-[10px] text-slate-400 uppercase font-semibold block">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                setPeriodPreset('custom');
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
                setPeriodPreset('custom');
              }}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none"
            />
          </div>

          {/* 2. Day-of-Week Filter */}
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

          {/* 3. Direction Filter (Long / Short) */}
          <div>
            <label className="text-[10px] text-slate-400 uppercase font-semibold block">Direction</label>
            <select
              value={directionFilter}
              onChange={e => setDirectionFilter(e.target.value as any)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Directions</option>
              <option value="LONG">Longs Only (Buy)</option>
              <option value="SHORT">Shorts Only (Sell)</option>
            </select>
          </div>

          {/* 4. Strategy Filter */}
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

          {/* 5. Timeframe Filter */}
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

      {/* PART A: Executive Summary & A-to-Z Metrics */}
      <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Part A: Executive Financial Summary & A-to-Z KPIs
            </h3>
            <p className="text-[11px] text-slate-400">
              Validated calculations across {metrics.totalTrades} closed trades
            </p>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-mono block">Net Realized Result:</span>
            <span
              className={`text-xl font-black font-mono ${
                metrics.netPnL >= 0 ? 'text-[#20C997]' : 'text-[#FF5263]'
              }`}
            >
              {metrics.netPnL >= 0 ? '+' : ''}${metrics.netPnL.toFixed(2)}
            </span>
          </div>
        </div>

        {/* 12-Card Comprehensive KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Win Rate</span>
            <div className="text-base font-extrabold text-slate-100 mt-1">{metrics.winRate}%</div>
            <span className="text-[10px] text-slate-400 font-normal">{metrics.winningTrades}W / {metrics.losingTrades}L</span>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Profit Factor</span>
            <div className="text-base font-extrabold text-emerald-400 mt-1">{metrics.profitFactor !== null ? metrics.profitFactor : 'N/A'}</div>
            <span className="text-[10px] text-slate-400 font-normal">${metrics.grossProfit.toFixed(0)} / ${metrics.grossLoss.toFixed(0)}</span>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Total Trades</span>
            <div className="text-base font-extrabold text-slate-200 mt-1">{metrics.totalTrades}</div>
            <span className="text-[10px] text-slate-400 font-normal">{metrics.breakEvenTrades} break-even</span>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Avg Win</span>
            <div className="text-base font-extrabold text-emerald-400 mt-1">+${metrics.averageWin.toFixed(2)}</div>
            <span className="text-[10px] text-slate-400 font-normal">per winner</span>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Avg Loss</span>
            <div className="text-base font-extrabold text-rose-400 mt-1">-${metrics.averageLoss.toFixed(2)}</div>
            <span className="text-[10px] text-slate-400 font-normal">per loser</span>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Expectancy</span>
            <div className={`text-base font-extrabold mt-1 ${metrics.expectancy >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {metrics.expectancy >= 0 ? '+' : ''}${metrics.expectancy.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-400 font-normal">per trade</span>
          </div>
        </div>
      </div>

      {/* PART B & PART C: Strategy & Timeframe Breakdowns (Side by Side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Part B: Strategy-wise Breakdown */}
        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-amber-400" />
              <span>Part B: Strategy-Wise Performance</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">{strategyBreakdown.length} setups</span>
          </div>

          {strategyBreakdown.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">No trades for selected filters.</div>
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

        {/* Part C: Timeframe-wise Breakdown */}
        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-blue-400" />
              <span>Part C: Timeframe-Wise Performance</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">{timeframeBreakdown.length} timeframes</span>
          </div>

          {timeframeBreakdown.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">No trades for selected filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-slate-800 bg-slate-900/60 text-[10px] uppercase text-slate-400">
                  <tr>
                    <th className="py-2 px-2.5">Timeframe</th>
                    <th className="py-2 px-2 text-center">Trades</th>
                    <th className="py-2 px-2 text-center">Win Rate</th>
                    <th className="py-2 px-2 text-right">Net P&L</th>
                    <th className="py-2 px-2 text-right">Avg R</th>
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
                      <td className="py-2.5 px-2 text-right text-slate-300">
                        {tf.avgR > 0 ? `+${tf.avgR}R` : `${tf.avgR}R`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* PART D & PART E: Direction (Long vs Short) & Day-of-Week Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Part D: Direction Analysis */}
        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2">
            Part D: Directional Intelligence (Long vs Short)
          </h3>

          <div className="grid grid-cols-2 gap-3 font-mono">
            {/* Long Card */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-400 text-xs flex items-center gap-1 font-sans">
                  <ArrowUpRight className="h-4 w-4" />
                  <span>LONG Trades</span>
                </span>
                <span className="text-[10px] text-slate-400">{directionBreakdown.long.total} trades</span>
              </div>
              <div className={`text-xl font-black ${directionBreakdown.long.net >= 0 ? 'text-[#20C997]' : 'text-[#FF5263]'}`}>
                {directionBreakdown.long.net >= 0 ? '+' : ''}${directionBreakdown.long.net.toFixed(2)}
              </div>
              <div className="flex justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                <span>Win Rate: <strong className="text-slate-200">{directionBreakdown.long.winRate}%</strong></span>
                <span>Wins: <strong className="text-emerald-400">{directionBreakdown.long.wins}</strong> / Losses: <strong className="text-rose-400">{directionBreakdown.long.losses}</strong></span>
              </div>
            </div>

            {/* Short Card */}
            <div className="rounded-xl border border-rose-500/30 bg-rose-950/15 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-400 text-xs flex items-center gap-1 font-sans">
                  <ArrowDownRight className="h-4 w-4" />
                  <span>SHORT Trades</span>
                </span>
                <span className="text-[10px] text-slate-400">{directionBreakdown.short.total} trades</span>
              </div>
              <div className={`text-xl font-black ${directionBreakdown.short.net >= 0 ? 'text-[#20C997]' : 'text-[#FF5263]'}`}>
                {directionBreakdown.short.net >= 0 ? '+' : ''}${directionBreakdown.short.net.toFixed(2)}
              </div>
              <div className="flex justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                <span>Win Rate: <strong className="text-slate-200">{directionBreakdown.short.winRate}%</strong></span>
                <span>Wins: <strong className="text-emerald-400">{directionBreakdown.short.wins}</strong> / Losses: <strong className="text-rose-400">{directionBreakdown.short.losses}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Part E: Day-of-Week Breakdown */}
        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Part E: Day-Of-Week Analysis (Mon - Sun)
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Day distribution</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
            {dayOfWeekBreakdown.filter(d => d.total > 0).map(d => (
              <div key={d.dayName} className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                <div className="flex justify-between items-center text-[10px] font-sans font-bold text-slate-300">
                  <span>{d.dayName}</span>
                  <span className="text-slate-500">{d.total} trd</span>
                </div>
                <div className={`mt-1 font-bold ${d.netPnL >= 0 ? 'text-[#20C997]' : 'text-[#FF5263]'}`}>
                  {d.netPnL >= 0 ? '+' : ''}${d.netPnL.toFixed(0)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  WR: <strong className="text-slate-200">{d.winRate}%</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PART F: Granular Execution Log with Timing & Clickable Profit/Loss Cells */}
      <div className="rounded-xl border border-slate-800 bg-[#111C2D] overflow-hidden shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-4 border-b border-slate-800 bg-slate-950/60">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              <span>Part F: Granular Execution Audit Log ({filteredTrades.length} Trades)</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              💡 <strong>Tip:</strong> Click on any <strong className="text-emerald-400">Profit</strong> or <strong className="text-rose-400">Loss</strong> cell to view complete trade details, screenshots & notes!
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>Filtered Net: <strong className={metrics.netPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}>${metrics.netPnL.toFixed(2)}</strong></span>
          </div>
        </div>

        {filteredTrades.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            No trade records match the chosen filter configuration.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-slate-800 bg-slate-900/70 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <tr>
                  <th className="py-3 px-3">Date / Time</th>
                  <th className="py-3 px-3">Asset</th>
                  <th className="py-3 px-2">TF</th>
                  <th className="py-3 px-3">Dir</th>
                  <th className="py-3 px-3">Strategy</th>
                  <th className="py-3 px-3">Execution Prices</th>
                  <th className="py-3 px-2 text-center">Lots</th>
                  <th className="py-3 px-4 text-center cursor-pointer hover:text-slate-200">
                    Net P&L ($) <span className="text-[9px] text-blue-400">(Click to View)</span>
                  </th>
                  <th className="py-3 px-2 text-center">R</th>
                  <th className="py-3 px-2 text-center">Plan</th>
                  <th className="py-3 px-3 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTrades.map(trade => {
                  const isLong = trade.direction === 'LONG';
                  const isWin = (trade.netPnL || 0) > 0;
                  const isLoss = (trade.netPnL || 0) < 0;

                  return (
                    <tr
                      key={trade.id}
                      onClick={() => setInspectedTrade(trade)}
                      className="cursor-pointer hover:bg-slate-800/40 transition group"
                      title="Click to view complete trade details"
                    >
                      {/* Date & Exact Execution Time */}
                      <td className="py-3 px-3 font-sans">
                        <div className="font-semibold text-slate-200 text-xs">{trade.tradeDate}</div>
                        <div className="text-[10px] text-blue-400 font-mono flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3 inline text-slate-500" />
                          <span>{formatExecutionTime(trade.entryTime)}</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-400">{trade.session}</span>
                        </div>
                      </td>

                      {/* Asset */}
                      <td className="py-3 px-3 font-sans font-bold">
                        <span className={trade.asset.includes('XAU') ? 'text-amber-400' : 'text-orange-400'}>
                          {trade.asset}
                        </span>
                      </td>

                      {/* Timeframe */}
                      <td className="py-3 px-2">
                        <span className="rounded bg-blue-500/10 border border-blue-500/20 px-1 py-0.5 text-[10px] font-bold text-blue-300">
                          {trade.timeframe || '15m'}
                        </span>
                      </td>

                      {/* Direction */}
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

                      {/* Strategy */}
                      <td className="py-3 px-3 font-sans text-slate-300 truncate max-w-[130px]">
                        {trade.strategyName || stratMap[trade.strategyId || ''] || 'Discretionary'}
                      </td>

                      {/* Entry & Exit Prices */}
                      <td className="py-3 px-3 text-slate-300">
                        ${trade.entryPrice.toLocaleString()} →{' '}
                        {trade.exitPrice !== undefined ? `$${trade.exitPrice.toLocaleString()}` : <span className="text-blue-400">Open</span>}
                      </td>

                      {/* Lot Size */}
                      <td className="py-3 px-2 text-center text-slate-300">
                        {trade.positionSize}
                      </td>

                      {/* Net P&L (Clickable cell highlighted) */}
                      <td className="py-3 px-4 text-center">
                        <div className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-black shadow-xs transition group-hover:scale-105 ${
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

                      {/* Actual R */}
                      <td className="py-3 px-2 text-center font-bold">
                        {trade.actualR !== undefined ? (
                          <span className={trade.actualR > 0 ? 'text-emerald-400' : trade.actualR < 0 ? 'text-rose-400' : 'text-slate-400'}>
                            {trade.actualR > 0 ? `+${trade.actualR}R` : `${trade.actualR}R`}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Discipline */}
                      <td className="py-3 px-2 text-center font-sans">
                        <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold ${
                          trade.ruleFollowed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {trade.ruleFollowed ? <CheckCircle className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                          {trade.ruleFollowed ? 'YES' : 'BREACH'}
                        </span>
                      </td>

                      {/* View Action */}
                      <td className="py-3 px-3 text-right font-sans">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setInspectedTrade(trade);
                          }}
                          className="rounded p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition"
                          title="Open Full Trade Details"
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
        )}
      </div>

      {/* Reusable Universal Trade Detail Inspection Modal */}
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
