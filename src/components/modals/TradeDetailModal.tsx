/**
 * Learner HAMZA - Universal Trade Detail Inspection Modal
 * Displays comprehensive execution data: Strategy, Timeframe, Exact Execution Time,
 * Description, Remark, Improvement Box, Rule Breach details, and Zoomable Screenshots.
 */

import React, { useState } from 'react';
import {
  X,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  Camera,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  BookOpen,
  Sparkles,
  FileText,
  MessageSquare
} from 'lucide-react';
import { Trade } from '../../types';

interface TradeDetailModalProps {
  trade: Trade | null;
  onClose: () => void;
  onEdit?: (trade: Trade) => void;
  onDelete?: (tradeId: string) => void;
  strategyNameMap?: Record<string, string>;
}

export const TradeDetailModal: React.FC<TradeDetailModalProps> = ({
  trade,
  onClose,
  onEdit,
  onDelete,
  strategyNameMap = {}
}) => {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  if (!trade) return null;

  const isLong = trade.direction === 'LONG';
  const isWin = (trade.netPnL || 0) > 0;
  const isLoss = (trade.netPnL || 0) < 0;

  // Format execution time
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '—';
    try {
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) return timeStr;
      return `${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} (UTC: ${d.toISOString().substring(11, 19)})`;
    } catch {
      return timeStr;
    }
  };

  const stratName =
    trade.strategyName || strategyNameMap[trade.strategyId || ''] || trade.strategyId || 'Discretionary';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4">
        <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden text-xs">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-extrabold ${
                  isLong
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {isLong ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {trade.direction}
              </span>

              <span className="font-extrabold text-slate-100 text-sm">
                {trade.asset}
              </span>

              <span className="rounded bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 text-[11px] font-mono text-blue-300 font-bold">
                {trade.timeframe || '15m'}
              </span>

              <span className="text-slate-400 font-mono text-[11px]">
                {trade.id}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {onEdit && (
                <button
                  onClick={() => {
                    onClose();
                    onEdit(trade);
                  }}
                  className="flex items-center gap-1 rounded-lg bg-blue-600/20 px-2.5 py-1 text-xs font-semibold text-blue-300 hover:bg-blue-600/30 transition border border-blue-500/30"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </button>
              )}

              {onDelete && (
                <button
                  onClick={() => {
                    onDelete(trade.id);
                  }}
                  className="flex items-center gap-1 rounded-lg bg-rose-600/20 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-600/30 transition border border-rose-500/30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Financial Summary KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-xl border border-slate-800 bg-slate-950/70 p-3 font-mono">
              <div className="rounded-lg bg-slate-900/60 p-2.5">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Net P&L</div>
                <div
                  className={`text-lg font-black mt-0.5 ${
                    isWin ? 'text-[#20C997]' : isLoss ? 'text-[#FF5263]' : 'text-slate-300'
                  }`}
                >
                  {trade.netPnL !== undefined
                    ? `${trade.netPnL >= 0 ? '+' : ''}$${trade.netPnL.toFixed(2)}`
                    : 'Open'}
                </div>
              </div>

              <div className="rounded-lg bg-slate-900/60 p-2.5">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Actual R</div>
                <div className="text-lg font-black mt-0.5 text-slate-100">
                  {trade.actualR !== undefined ? (
                    <span className={trade.actualR > 0 ? 'text-emerald-400' : trade.actualR < 0 ? 'text-rose-400' : ''}>
                      {trade.actualR > 0 ? `+${trade.actualR}R` : `${trade.actualR}R`}
                    </span>
                  ) : (
                    '—'
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-slate-900/60 p-2.5">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Risk Budget</div>
                <div className="text-lg font-black mt-0.5 text-amber-400">
                  ${trade.plannedRiskAmount?.toFixed(2) || '0.00'}
                </div>
              </div>

              <div className="rounded-lg bg-slate-900/60 p-2.5">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Lot Size</div>
                <div className="text-lg font-black mt-0.5 text-slate-200">
                  {trade.positionSize} <span className="text-xs font-normal text-slate-400">{trade.asset.includes('XAU') ? 'Lots' : 'Units'}</span>
                </div>
              </div>
            </div>

            {/* Execution Timing & Specs */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5 space-y-2 font-mono">
              <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider pb-1 border-b border-slate-800/80 font-sans flex items-center justify-between">
                <span>Execution Timing & Prices</span>
                <span className="text-slate-500 font-mono text-[10px]">{trade.tradeDate}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400 flex items-center gap-1 font-sans">
                    <Clock className="h-3 w-3 text-blue-400" />
                    <span>Execution Time:</span>
                  </span>
                  <span className="text-slate-200 font-bold">{formatTime(trade.entryTime)}</span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400 font-sans">Session:</span>
                  <span className="text-blue-300 font-semibold font-sans">{trade.session}</span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400 font-sans">Strategy:</span>
                  <span className="text-amber-300 font-bold font-sans">{stratName}</span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400 font-sans">Timeframe:</span>
                  <span className="text-blue-400 font-bold">{trade.timeframe || '15m'}</span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400 font-sans">Entry Price:</span>
                  <span className="text-slate-200">${trade.entryPrice}</span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400 font-sans">Exit Price:</span>
                  <span className="text-slate-200 font-bold">
                    {trade.exitPrice !== undefined ? `$${trade.exitPrice}` : <span className="text-purple-400">Still Open</span>}
                  </span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400 font-sans">Stop Loss:</span>
                  <span className="text-rose-400">${trade.stopLossPrice}</span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400 font-sans">Take Profit:</span>
                  <span className="text-emerald-400">${trade.takeProfitPrice || '—'}</span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400 font-sans">Target R:R:</span>
                  <span className="text-slate-200">1:{trade.plannedRR || 2.0}</span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400 font-sans">Fees / Friction:</span>
                  <span className="text-slate-400">
                    ${((trade.entryFees || 0) + (trade.exitFees || 0) + (trade.slippage || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Narrative Boxes: Description, Remark, Improvement */}
            <div className="space-y-2.5">
              {/* Description Box */}
              {(trade.description || trade.entryReason) && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 space-y-1">
                  <div className="font-bold text-blue-300 flex items-center gap-1.5 font-sans">
                    <FileText className="h-3.5 w-3.5 text-blue-400" />
                    <span>Trade Description / Setup Narrative</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed font-sans">
                    {trade.description || trade.entryReason}
                  </p>
                </div>
              )}

              {/* Remark Box */}
              {trade.remark && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 space-y-1">
                  <div className="font-bold text-purple-300 flex items-center gap-1.5 font-sans">
                    <MessageSquare className="h-3.5 w-3.5 text-purple-400" />
                    <span>Execution Remarks & Observations</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed font-sans">{trade.remark}</p>
                </div>
              )}

              {/* Improvement Box */}
              {trade.lessonsLearned && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-3 space-y-1">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5 font-sans">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    <span>Improvement Box / Lessons Learned</span>
                  </div>
                  <p className="text-amber-200/90 leading-relaxed font-sans">{trade.lessonsLearned}</p>
                </div>
              )}

              {/* Discipline & Rule Breach Box */}
              {!trade.ruleFollowed ? (
                <div className="rounded-xl border border-rose-900/50 bg-rose-950/30 p-3 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-rose-400 font-sans">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Trading Rule Breach Details</span>
                  </div>
                  <p className="text-rose-200 font-sans font-medium">
                    {trade.ruleBreachedReason || 'Trader recorded a discipline violation for this execution.'}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-2.5 flex items-center gap-2 text-emerald-400 font-sans">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-semibold">Trading Plan Followed Disciplined</span>
                </div>
              )}
            </div>

            {/* Screenshots Gallery */}
            {trade.attachments && trade.attachments.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="font-bold text-slate-300 flex items-center gap-1.5 font-sans">
                  <Camera className="h-4 w-4 text-blue-400" />
                  <span>Chart Screenshots ({trade.attachments.length})</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {trade.attachments.map(att => (
                    <div
                      key={att.id}
                      onClick={() => setZoomedImage(att.dataUrl)}
                      className="group relative rounded-lg border border-slate-800 overflow-hidden bg-slate-950 cursor-pointer hover:border-blue-500 transition"
                    >
                      <img src={att.dataUrl} alt={att.type} className="h-32 w-full object-cover" />
                      <div className="absolute top-1 left-1 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white font-mono">
                        {att.fileName || att.type}
                      </div>
                      <div className="absolute inset-0 bg-blue-600/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-bold text-white transition">
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

      {/* Fullscreen Zoom Modal */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/95 p-4 cursor-pointer"
        >
          <div className="relative max-h-full max-w-full">
            <img src={zoomedImage} alt="Zoomed screenshot" className="max-h-[92vh] max-w-[92vw] rounded-lg object-contain shadow-2xl" />
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute top-2 right-2 rounded-full bg-slate-900/90 p-2 text-white hover:bg-rose-600 transition"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
