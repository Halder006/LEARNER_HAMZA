/**
 * Learner HAMZA - Trade Journal View
 * Complete search, filtering, table & detailed trade drawer with local screenshot inspection
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Edit2,
  Trash2,
  Camera,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Calendar,
  X
} from 'lucide-react';
import { Trade, Strategy, InstrumentConfig } from '../../types';
import { db, logAudit } from '../../db/db';

interface TradeJournalPageProps {
  trades: Trade[];
  strategies: Strategy[];
  instruments: Record<string, InstrumentConfig>;
  onNavigateAddTrade: () => void;
  onEditTrade: (trade: Trade) => void;
  onRefreshData: () => void;
}

export const TradeJournalPage: React.FC<TradeJournalPageProps> = ({
  trades,
  strategies,
  instruments,
  onNavigateAddTrade,
  onEditTrade,
  onRefreshData
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [assetFilter, setAssetFilter] = useState<string>('ALL');
  const [directionFilter, setDirectionFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [strategyFilter, setStrategyFilter] = useState<string>('ALL');
  const [ruleFilter, setRuleFilter] = useState<string>('ALL');

  // Selected trade for detail modal
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Filtered trades
  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      if (assetFilter !== 'ALL' && !t.asset.toUpperCase().includes(assetFilter)) return false;
      if (directionFilter !== 'ALL' && t.direction !== directionFilter) return false;
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (strategyFilter !== 'ALL' && t.strategyId !== strategyFilter) return false;
      if (ruleFilter === 'YES' && !t.ruleFollowed) return false;
      if (ruleFilter === 'NO' && t.ruleFollowed) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = t.id.toLowerCase().includes(q);
        const matchesSetup = (t.setupType || '').toLowerCase().includes(q);
        const matchesReason = (t.entryReason || '').toLowerCase().includes(q);
        const matchesNotes = (t.notes || '').toLowerCase().includes(q);
        const matchesMistake = (t.mistakeCategory || '').toLowerCase().includes(q);
        if (!matchesId && !matchesSetup && !matchesReason && !matchesNotes && !matchesMistake) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => new Date(b.entryTime || b.tradeDate).getTime() - new Date(a.entryTime || a.tradeDate).getTime());
  }, [trades, assetFilter, directionFilter, statusFilter, strategyFilter, ruleFilter, searchQuery]);

  const handleDeleteTrade = async (tradeId: string) => {
    if (confirm(`Are you sure you want to permanently delete trade ${tradeId}? This action cannot be undone.`)) {
      await db.trades.delete(tradeId);
      // Remove attachments linked to trade
      const atts = await db.attachments.where('tradeId').equals(tradeId).toArray();
      if (atts.length > 0) {
        await db.attachments.bulkDelete(atts.map(a => a.id));
      }
      await logAudit('trade', 'TRADE_DELETED', `Permanently deleted trade ${tradeId}`);
      if (selectedTrade?.id === tradeId) setSelectedTrade(null);
      onRefreshData();
    }
  };

  const stratMap = useMemo(() => {
    const map: Record<string, string> = {};
    strategies.forEach(s => {
      map[s.id] = s.name;
    });
    return map;
  }, [strategies]);

  return (
    <div className="space-y-5">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-100">Trade Execution Journal</h2>
          <p className="text-xs text-slate-400">
            {filteredTrades.length} of {trades.length} recorded executions
          </p>
        </div>

        <button
          onClick={onNavigateAddTrade}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Record Trade</span>
        </button>
      </div>

      {/* Filter Matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 rounded-xl border border-slate-800 bg-[#111C2D] p-3.5 text-xs">
        {/* Search Input */}
        <div className="col-span-2 relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search Trade ID, notes, setup..."
            className="w-full rounded border border-slate-700 bg-slate-800/80 pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Asset Filter */}
        <div>
          <select
            value={assetFilter}
            onChange={e => setAssetFilter(e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-800/80 px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
          >
            <option value="ALL">All Assets</option>
            <option value="XAUUSD">Gold (XAUUSD)</option>
            <option value="BTCUSD">Bitcoin (BTCUSD)</option>
          </select>
        </div>

        {/* Direction Filter */}
        <div>
          <select
            value={directionFilter}
            onChange={e => setDirectionFilter(e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-800/80 px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
          >
            <option value="ALL">All Directions</option>
            <option value="LONG">Long (Buy)</option>
            <option value="SHORT">Short (Sell)</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-800/80 px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="Closed">Closed</option>
            <option value="Open">Open</option>
            <option value="Planned">Planned</option>
          </select>
        </div>

        {/* Rule Filter */}
        <div>
          <select
            value={ruleFilter}
            onChange={e => setRuleFilter(e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-800/80 px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
          >
            <option value="ALL">All Discipline</option>
            <option value="YES">Plan Followed</option>
            <option value="NO">Rule Breached</option>
          </select>
        </div>
      </div>

      {/* Trades Table */}
      <div className="rounded-xl border border-slate-800 bg-[#111C2D] overflow-hidden shadow-xs">
        {filteredTrades.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            No trades match the current filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-900/50 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <tr>
                  <th className="py-3 px-4">ID / Date</th>
                  <th className="py-3 px-3">Asset / TF</th>
                  <th className="py-3 px-3">Direction</th>
                  <th className="py-3 px-3">Strategy</th>
                  <th className="py-3 px-3">Entry / Exit</th>
                  <th className="py-3 px-3">Size</th>
                  <th className="py-3 px-3">Net P&L ($)</th>
                  <th className="py-3 px-3">Actual R</th>
                  <th className="py-3 px-3">Discipline</th>
                  <th className="py-3 px-3">Chart</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredTrades.map(trade => {
                  const isLong = trade.direction === 'LONG';
                  const isWin = (trade.netPnL || 0) > 0;
                  const isLoss = (trade.netPnL || 0) < 0;

                  return (
                    <tr
                      key={trade.id}
                      onClick={() => setSelectedTrade(trade)}
                      className="cursor-pointer hover:bg-slate-800/30 transition"
                    >
                      <td className="py-3 px-4 font-sans">
                        <div className="font-semibold text-slate-200">{trade.id}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{trade.tradeDate}</div>
                      </td>
                      <td className="py-3 px-3 font-sans font-bold">
                        <span className={trade.asset.includes('XAU') ? 'text-amber-400' : 'text-orange-400'}>
                          {trade.asset}
                        </span>
                        <div className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                          <span className="text-blue-400 font-mono font-semibold">{trade.timeframe || '15m'}</span>
                          <span>•</span>
                          <span>{trade.session}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-sans font-semibold">
                        <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${
                          isLong
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {isLong ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {trade.direction}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-300">
                        {trade.strategyName || stratMap[trade.strategyId || ''] || 'Discretionary'}
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        ${trade.entryPrice.toLocaleString()} →{' '}
                        {trade.exitPrice !== undefined ? `$${trade.exitPrice.toLocaleString()}` : <span className="text-blue-400">Open</span>}
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {trade.positionSize} {trade.asset.includes('XAU') ? 'lots' : 'btc'}
                      </td>
                      <td className="py-3 px-3 font-bold">
                        {trade.status === 'Open' ? (
                          <span className="text-blue-400 font-sans">Open</span>
                        ) : (
                          <span className={isWin ? 'text-[#20C997]' : isLoss ? 'text-[#FF5263]' : 'text-slate-400'}>
                            {isWin ? '+' : ''}${trade.netPnL?.toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {trade.actualR !== undefined ? (
                          <span className={trade.actualR > 0 ? 'text-emerald-400 font-bold' : ''}>
                            {trade.actualR > 0 ? `+${trade.actualR}R` : `${trade.actualR}R`}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-3 font-sans">
                        <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          trade.ruleFollowed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {trade.ruleFollowed ? <CheckCircle className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                          {trade.ruleFollowed ? 'YES' : 'BREACH'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-sans">
                        {trade.attachments?.length > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-400">
                            <Camera className="h-3 w-3" />
                            {trade.attachments.length}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-sans" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onEditTrade(trade)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-blue-400 transition"
                            title="Edit Trade"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTrade(trade.id)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition"
                            title="Delete Trade"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Trade Detail Drawer Modal */}
      {selectedTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 p-4">
              <div className="flex items-center gap-2.5">
                <span className={`rounded px-2 py-0.5 text-xs font-bold ${
                  selectedTrade.direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                }`}>
                  {selectedTrade.direction}
                </span>
                <span className="font-bold text-slate-100 text-sm">
                  {selectedTrade.asset} • {selectedTrade.id}
                </span>
                <span className="rounded bg-blue-500/20 border border-blue-500/30 px-1.5 py-0.5 text-[10px] font-mono text-blue-300 font-bold">
                  {selectedTrade.timeframe || '15m'}
                </span>
                <span className="text-xs text-slate-400 font-mono">({selectedTrade.tradeDate})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const t = selectedTrade;
                    setSelectedTrade(null);
                    onEditTrade(t);
                  }}
                  className="flex items-center gap-1 rounded-lg bg-blue-600/20 px-2.5 py-1 text-xs font-semibold text-blue-300 hover:bg-blue-600/30 transition border border-blue-500/30"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => handleDeleteTrade(selectedTrade.id)}
                  className="flex items-center gap-1 rounded-lg bg-rose-600/20 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-600/30 transition border border-rose-500/30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
                <button onClick={() => setSelectedTrade(null)} className="rounded-lg p-1 text-slate-400 hover:text-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Financial Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 font-mono">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Net P&L</div>
                  <div className={`text-base font-bold ${
                    (selectedTrade.netPnL || 0) >= 0 ? 'text-[#20C997]' : 'text-[#FF5263]'
                  }`}>
                    {(selectedTrade.netPnL || 0) >= 0 ? '+' : ''}${selectedTrade.netPnL?.toFixed(2) || '0.00'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Actual R</div>
                  <div className="text-base font-bold text-slate-200">
                    {selectedTrade.actualR !== undefined ? `${selectedTrade.actualR}R` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Risk Budget</div>
                  <div className="text-base font-bold text-amber-400">
                    ${selectedTrade.plannedRiskAmount.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Position Size</div>
                  <div className="text-base font-bold text-slate-200">
                    {selectedTrade.positionSize} {selectedTrade.asset.includes('XAU') ? 'Lots' : 'Units'}
                  </div>
                </div>
              </div>

              {/* Execution Details Table */}
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Trading Strategy:</span>
                  <span className="text-amber-300 font-sans font-semibold">
                    {selectedTrade.strategyName || stratMap[selectedTrade.strategyId || ''] || 'Discretionary'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Chart Timeframe:</span>
                  <span className="text-blue-300 font-bold">{selectedTrade.timeframe || '15m'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Entry Price:</span>
                  <span className="text-slate-200">${selectedTrade.entryPrice}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Exit Price:</span>
                  <span className="text-slate-200">{selectedTrade.exitPrice !== undefined ? `$${selectedTrade.exitPrice}` : 'Open'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Stop Loss:</span>
                  <span className="text-rose-400">${selectedTrade.stopLossPrice}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Take Profit:</span>
                  <span className="text-emerald-400">${selectedTrade.takeProfitPrice || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Target R:R:</span>
                  <span className="text-slate-200">1:{selectedTrade.plannedRR || 2.0}</span>
                </div>
              </div>

              {/* Description Box */}
              {(selectedTrade.description || selectedTrade.entryReason) && (
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <div className="font-semibold text-blue-300 flex items-center gap-1.5">
                    <span>Trade Description / Setup:</span>
                  </div>
                  <p className="mt-1 text-slate-300 leading-relaxed">
                    {selectedTrade.description || selectedTrade.entryReason}
                  </p>
                </div>
              )}

              {/* Remark Box */}
              {selectedTrade.remark && (
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <div className="font-semibold text-purple-300 flex items-center gap-1.5">
                    <span>Execution Remarks:</span>
                  </div>
                  <p className="mt-1 text-slate-300 leading-relaxed">{selectedTrade.remark}</p>
                </div>
              )}

              {/* Improvement / Lessons Learned */}
              {selectedTrade.lessonsLearned && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-950/15 p-3">
                  <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <span>Improvement Box / Lessons Learned:</span>
                  </div>
                  <p className="mt-1 text-amber-200/90 leading-relaxed">{selectedTrade.lessonsLearned}</p>
                </div>
              )}

              {/* Rule Breach Notice */}
              {!selectedTrade.ruleFollowed && (
                <div className="rounded-lg border border-rose-900/50 bg-rose-950/20 p-3 text-rose-300 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-rose-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Rule Breach Recorded:</span>
                  </div>
                  <p className="text-rose-200">
                    {selectedTrade.ruleBreachedReason || 'Trader marked rule breach for this execution.'}
                  </p>
                </div>
              )}

              {/* Screenshots Gallery */}
              {selectedTrade.attachments?.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Camera className="h-4 w-4 text-blue-400" />
                    <span>Chart Attachments ({selectedTrade.attachments.length})</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedTrade.attachments.map(att => (
                      <div
                        key={att.id}
                        onClick={() => setZoomedImage(att.dataUrl)}
                        className="group relative rounded-lg border border-slate-800 overflow-hidden bg-slate-950 cursor-pointer hover:border-blue-500 transition"
                      >
                        <img src={att.dataUrl} alt={att.type} className="h-28 w-full object-cover" />
                        <div className="absolute top-1 left-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                          {att.type}
                        </div>
                        <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold text-white transition">
                          Click to Enlarge
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Zoom Modal */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4 cursor-pointer"
        >
          <img src={zoomedImage} alt="Chart zoom" className="max-h-[90vh] max-w-[95vw] rounded-lg shadow-2xl object-contain" />
        </div>
      )}
    </div>
  );
};
