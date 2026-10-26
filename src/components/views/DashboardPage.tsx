/**
 * Learner HAMZA - Real-Time Dashboard View
 * Primary quantitative overview, key performance indicators and interactive financial charts
 */

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  ShieldAlert,
  Calendar,
  Layers,
  ChevronRight,
  Award,
  Clock
} from 'lucide-react';
import { Trade, Account, KillSwitchSettings, PerformanceMetrics } from '../../types';
import { calculatePerformanceMetrics } from '../../services/calculationEngine';
import { EquityCurveChart, DailyPnLBarChart, DrawdownCurveChart } from '../charts/FinancialCharts';

interface DashboardPageProps {
  trades: Trade[];
  account: Account | null;
  killSwitchSettings: KillSwitchSettings;
  isLocked: boolean;
  warningPercent: number;
  remainingDailyLoss: number;
  onNavigate: (page: any) => void;
  onOpenTradeDetail: (trade: Trade) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  trades,
  account,
  killSwitchSettings,
  isLocked,
  warningPercent,
  remainingDailyLoss,
  onNavigate,
  onOpenTradeDetail
}) => {
  const [dateFilter, setDateFilter] = useState<'today' | '7d' | '30d' | '90d' | 'all'>('all');
  const [assetFilter, setAssetFilter] = useState<'ALL' | 'XAUUSD' | 'BTCUSD'>('ALL');

  const startingCapital = account?.startingCapital || 10000;

  // Filter trades based on date & asset
  const filteredTrades = useMemo(() => {
    let list = trades.filter(t => !t.isDraft);

    if (assetFilter !== 'ALL') {
      list = list.filter(t => t.asset.toUpperCase().includes(assetFilter));
    }

    const now = new Date();
    if (dateFilter === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      list = list.filter(t => t.tradeDate === todayStr);
    } else if (dateFilter === '7d') {
      const past7 = new Date(now.getTime() - 7 * 86400000);
      list = list.filter(t => new Date(t.tradeDate) >= past7);
    } else if (dateFilter === '30d') {
      const past30 = new Date(now.getTime() - 30 * 86400000);
      list = list.filter(t => new Date(t.tradeDate) >= past30);
    } else if (dateFilter === '90d') {
      const past90 = new Date(now.getTime() - 90 * 86400000);
      list = list.filter(t => new Date(t.tradeDate) >= past90);
    }

    return list;
  }, [trades, dateFilter, assetFilter]);

  const metrics: PerformanceMetrics = useMemo(() => {
    return calculatePerformanceMetrics(filteredTrades, startingCapital);
  }, [filteredTrades, startingCapital]);

  const currentEquity = startingCapital + metrics.netPnL;

  // Chart data preparation
  const equitySeries = useMemo(() => {
    const closed = filteredTrades
      .filter(t => t.status === 'Closed' && t.exitPrice)
      .sort((a, b) => new Date(a.exitTime || a.tradeDate).getTime() - new Date(b.exitTime || b.tradeDate).getTime());

    let running = startingCapital;
    return closed.map(t => {
      running += (t.netPnL || 0);
      return {
        date: t.tradeDate,
        equity: Number(running.toFixed(2)),
        tradeId: t.id
      };
    });
  }, [filteredTrades, startingCapital]);

  const dailyPnLSeries = useMemo(() => {
    const closed = filteredTrades.filter(t => t.status === 'Closed');
    const dayMap: Record<string, { pnl: number; count: number }> = {};

    closed.forEach(t => {
      const d = t.tradeDate;
      if (!dayMap[d]) dayMap[d] = { pnl: 0, count: 0 };
      dayMap[d].pnl += (t.netPnL || 0);
      dayMap[d].count += 1;
    });

    return Object.entries(dayMap)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([date, val]) => ({
        date,
        pnl: Number(val.pnl.toFixed(2)),
        tradesCount: val.count
      }));
  }, [filteredTrades]);

  const drawdownSeries = useMemo(() => {
    const closed = filteredTrades
      .filter(t => t.status === 'Closed')
      .sort((a, b) => new Date(a.exitTime || a.tradeDate).getTime() - new Date(b.exitTime || b.tradeDate).getTime());

    let peak = startingCapital;
    let running = startingCapital;

    return closed.map(t => {
      running += (t.netPnL || 0);
      if (running > peak) peak = running;
      const dd = peak > 0 ? ((peak - running) / peak) * 100 : 0;
      return {
        date: t.tradeDate,
        ddPercent: Number(dd.toFixed(2))
      };
    });
  }, [filteredTrades, startingCapital]);

  // Gold vs BTC Breakdown
  const goldTrades = filteredTrades.filter(t => t.asset.toUpperCase().includes('XAU') || t.asset.toUpperCase().includes('GOLD'));
  const btcTrades = filteredTrades.filter(t => t.asset.toUpperCase().includes('BTC') || t.asset.toUpperCase().includes('BITCOIN'));
  const goldPnL = goldTrades.reduce((sum, t) => sum + (t.netPnL || 0), 0);
  const btcPnL = btcTrades.reduce((sum, t) => sum + (t.netPnL || 0), 0);

  // Recent 5 trades
  const recentTrades = useMemo(() => {
    return [...trades]
      .sort((a, b) => new Date(b.entryTime || b.tradeDate).getTime() - new Date(a.entryTime || a.tradeDate).getTime())
      .slice(0, 7);
  }, [trades]);

  return (
    <div className="space-y-6">
      {/* Top Filter & Quick Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        {/* Date Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 p-1 text-xs">
          {(['all', 'today', '7d', '30d', '90d'] as const).map(f => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={`rounded px-2.5 py-1 font-medium transition ${
                dateFilter === f
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f === 'all' ? 'All Time' : f === 'today' ? 'Today' : f === '7d' ? 'Last 7D' : f === '30d' ? '30D' : '90D'}
            </button>
          ))}
        </div>

        {/* Asset Filter & Add Trade CTA */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex rounded-lg border border-slate-800 bg-slate-900/60 p-1 text-xs">
            <button
              onClick={() => setAssetFilter('ALL')}
              className={`rounded px-2.5 py-1 font-medium transition ${
                assetFilter === 'ALL' ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Assets
            </button>
            <button
              onClick={() => setAssetFilter('XAUUSD')}
              className={`rounded px-2.5 py-1 font-medium transition ${
                assetFilter === 'XAUUSD' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              XAUUSD (Gold)
            </button>
            <button
              onClick={() => setAssetFilter('BTCUSD')}
              className={`rounded px-2.5 py-1 font-medium transition ${
                assetFilter === 'BTCUSD' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              BTCUSD (BTC)
            </button>
          </div>

          <button
            onClick={() => onNavigate('add_trade')}
            disabled={isLocked}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-md transition ${
              isLocked
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/20'
            }`}
          >
            <Plus className="h-4 w-4" />
            <span>New Trade</span>
          </button>
        </div>
      </div>

      {/* Kill Switch Banner if Warning or Locked */}
      {isLocked && (
        <div className="rounded-xl border border-red-500/50 bg-red-950/30 p-4 shadow-lg shadow-red-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-500/20 p-2 text-red-400 animate-pulse">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-red-200">TRADING LOCK ACTIVE</div>
              <div className="text-xs text-red-300/80">
                {killSwitchSettings.emergencyLockReason || 'Daily loss limit or risk threshold reached. New trade authorizations are locked.'}
              </div>
            </div>
          </div>
          <div className="font-mono text-xs bg-red-950/80 px-3 py-1.5 rounded-lg border border-red-500/30 text-red-200 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-red-400" />
            <span>Auto-unlocks at 12:00 AM Midnight</span>
          </div>
        </div>
      )}

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Net P&L */}
        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
            <span>Net P&L</span>
            <DollarSign className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <div className={`mt-2 font-mono text-xl font-extrabold ${metrics.netPnL >= 0 ? 'text-[#20C997]' : 'text-[#FF5263]'}`}>
            {metrics.netPnL >= 0 ? '+' : ''}${metrics.netPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            Return: <strong className={metrics.returnOnCapitalPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {metrics.returnOnCapitalPercent >= 0 ? '+' : ''}{metrics.returnOnCapitalPercent}%
            </strong>
          </div>
        </div>

        {/* Win Rate */}
        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
            <span>Win Rate</span>
            <Percent className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <div className="mt-2 font-mono text-xl font-extrabold text-slate-100">
            {metrics.winRate}%
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            {metrics.winningTrades}W / {metrics.losingTrades}L ({metrics.breakEvenTrades} BE)
          </div>
        </div>

        {/* Profit Factor */}
        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
            <span>Profit Factor</span>
            <TrendingUp className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <div className="mt-2 font-mono text-xl font-extrabold text-slate-100">
            {metrics.profitFactor !== null ? metrics.profitFactor : 'N/A — 0 Losses'}
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            Gross: +${metrics.grossProfit.toFixed(0)} / -${metrics.grossLoss.toFixed(0)}
          </div>
        </div>

        {/* Expectancy */}
        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
            <span>Expectancy</span>
            <Activity className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <div className={`mt-2 font-mono text-xl font-extrabold ${metrics.expectancy >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {metrics.expectancy >= 0 ? '+' : ''}${metrics.expectancy.toFixed(2)}
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            Per Trade ({metrics.expectancyR > 0 ? `+${metrics.expectancyR}R` : `${metrics.expectancyR}R`})
          </div>
        </div>

        {/* Max Drawdown */}
        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
            <span>Max Drawdown</span>
            <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
          </div>
          <div className="mt-2 font-mono text-xl font-extrabold text-rose-400">
            -{metrics.maxDrawdownPercent}%
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            -${metrics.maxDrawdownAmount.toFixed(2)}
          </div>
        </div>

        {/* Plan Discipline */}
        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
            <span>Rule Compliance</span>
            <Award className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <div className="mt-2 font-mono text-xl font-extrabold text-blue-400">
            {metrics.ruleAdherenceRate}%
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            Streak: <span className="text-emerald-400 font-bold">{metrics.currentWinningStreak}W</span> / <span className="text-rose-400 font-bold">{metrics.currentLosingStreak}L</span>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Equity Curve (2 cols) */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-[#111C2D] p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100">Account Equity Curve</h3>
              <p className="text-[11px] text-slate-400">Cumulative balance progression starting at ${startingCapital.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <span className="font-mono text-xs text-slate-400">Current Equity: </span>
              <span className="font-mono text-sm font-bold text-slate-100">${currentEquity.toFixed(2)}</span>
            </div>
          </div>
          <div className="pt-4">
            <EquityCurveChart data={equitySeries} startingCapital={startingCapital} height={230} />
          </div>
        </div>

        {/* Daily P&L Bars (1 col) */}
        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100">Daily P&L Distribution</h3>
              <p className="text-[11px] text-slate-400">Profit and loss per trading session</p>
            </div>
          </div>
          <div className="pt-4">
            <DailyPnLBarChart data={dailyPnLSeries} height={230} />
          </div>
        </div>
      </div>

      {/* Secondary Row: Gold vs Bitcoin Breakdown & Risk Allowance Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gold Performance Card */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="text-xs font-bold text-amber-300">XAUUSD (Gold)</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">{goldTrades.length} Trades</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className={`font-mono text-xl font-bold ${goldPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {goldPnL >= 0 ? '+' : ''}${goldPnL.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400">
              Win Rate: <strong className="text-slate-200">
                {goldTrades.length > 0
                  ? ((goldTrades.filter(t => (t.netPnL || 0) > 0).length / goldTrades.length) * 100).toFixed(0)
                  : 0}%
              </strong>
            </div>
          </div>
        </div>

        {/* Bitcoin Performance Card */}
        <div className="rounded-xl border border-orange-500/20 bg-orange-950/10 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-orange-400" />
              <span className="text-xs font-bold text-orange-300">BTCUSD (Bitcoin)</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">{btcTrades.length} Trades</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className={`font-mono text-xl font-bold ${btcPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {btcPnL >= 0 ? '+' : ''}${btcPnL.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400">
              Win Rate: <strong className="text-slate-200">
                {btcTrades.length > 0
                  ? ((btcTrades.filter(t => (t.netPnL || 0) > 0).length / btcTrades.length) * 100).toFixed(0)
                  : 0}%
              </strong>
            </div>
          </div>
        </div>

        {/* Kill Switch Risk Gauge */}
        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Daily Risk Capacity</span>
              <span className="font-mono text-slate-400">${killSwitchSettings.maxDailyNetLoss} limit</span>
            </div>
            <div className="mt-2.5 h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  warningPercent >= 100 ? 'bg-rose-500' : warningPercent >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, warningPercent)}%` }}
              />
            </div>
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-slate-400">
            <span>Remaining: <strong className="text-emerald-400 font-mono">${remainingDailyLoss.toFixed(2)}</strong></span>
            <button
              onClick={() => onNavigate('risk')}
              className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
            >
              <span>Audit limits</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Trades Table */}
      <div className="rounded-xl border border-slate-800 bg-[#111C2D] overflow-hidden shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div>
            <h3 className="text-sm font-bold text-slate-100">Recent Trades</h3>
            <p className="text-[11px] text-slate-400">Latest logged executions</p>
          </div>
          <button
            onClick={() => onNavigate('journal')}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
          >
            <span>View All in Journal</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {recentTrades.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No trades logged yet. Click <strong className="text-blue-400">"New Trade"</strong> above to log your first execution.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-900/40 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-3">Asset</th>
                  <th className="py-2.5 px-3">Direction</th>
                  <th className="py-2.5 px-3">Entry / Exit</th>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3">Net P&L</th>
                  <th className="py-2.5 px-3">Actual R</th>
                  <th className="py-2.5 px-3">Rule Followed</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {recentTrades.map(trade => {
                  const isLong = trade.direction === 'LONG';
                  const isWin = (trade.netPnL || 0) > 0;
                  const isLoss = (trade.netPnL || 0) < 0;

                  return (
                    <tr key={trade.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-2.5 px-4 text-slate-300">{trade.tradeDate}</td>
                      <td className="py-2.5 px-3 font-sans font-bold">
                        <span className={trade.asset.includes('XAU') ? 'text-amber-400' : 'text-orange-400'}>
                          {trade.asset}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans font-semibold">
                        <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${
                          isLong ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {isLong ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {trade.direction}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        ${trade.entryPrice.toLocaleString()} → {trade.exitPrice ? `$${trade.exitPrice.toLocaleString()}` : 'Open'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {trade.positionSize} {trade.asset.includes('XAU') ? 'lots' : 'btc'}
                      </td>
                      <td className="py-2.5 px-3 font-bold">
                        {trade.status === 'Open' ? (
                          <span className="text-blue-400 font-sans">Open</span>
                        ) : (
                          <span className={isWin ? 'text-[#20C997]' : isLoss ? 'text-[#FF5263]' : 'text-slate-400'}>
                            {isWin ? '+' : ''}${trade.netPnL?.toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {trade.actualR !== undefined ? `${trade.actualR > 0 ? '+' : ''}${trade.actualR}R` : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          trade.ruleFollowed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                        }`}>
                          {trade.ruleFollowed ? 'YES' : 'VIOLATION'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => onOpenTradeDetail(trade)}
                          className="font-sans text-xs text-blue-400 hover:text-blue-300 hover:underline"
                        >
                          View
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
    </div>
  );
};
