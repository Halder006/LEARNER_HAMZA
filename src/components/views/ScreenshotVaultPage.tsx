/**
 * Learner HAMZA - Screenshot Vault View
 * Local chart image gallery with full-size zoom and trade ID references
 */

import React, { useState, useMemo } from 'react';
import { Camera, Image as ImageIcon, Filter, ZoomIn, X, ExternalLink, Trash2 } from 'lucide-react';
import { Trade, TradeAttachment } from '../../types';
import { db, logAudit } from '../../db/db';

interface ScreenshotVaultPageProps {
  trades: Trade[];
  onOpenTrade: (trade: Trade) => void;
  onRefreshData: () => void;
}

export const ScreenshotVaultPage: React.FC<ScreenshotVaultPageProps> = ({
  trades,
  onOpenTrade,
  onRefreshData
}) => {
  const [selectedStage, setSelectedStage] = useState<'ALL' | 'before' | 'entry' | 'exit' | 'post'>('ALL');
  const [selectedAsset, setSelectedAsset] = useState<string>('ALL');
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string; trade?: Trade } | null>(null);

  // Flatten all attachments with trade metadata
  const allScreenshots = useMemo(() => {
    const list: Array<{ attachment: TradeAttachment; trade: Trade }> = [];
    trades.forEach(t => {
      (t.attachments || []).forEach(att => {
        list.push({ attachment: att, trade: t });
      });
    });
    return list;
  }, [trades]);

  const filteredScreenshots = useMemo(() => {
    return allScreenshots.filter(({ attachment, trade }) => {
      if (selectedStage !== 'ALL' && attachment.type !== selectedStage) return false;
      if (selectedAsset !== 'ALL' && !trade.asset.toUpperCase().includes(selectedAsset)) return false;
      return true;
    });
  }, [allScreenshots, selectedStage, selectedAsset]);

  const handleDeleteScreenshot = async (attachmentId: string, tradeId: string) => {
    if (confirm('Delete this chart screenshot?')) {
      await db.attachments.delete(attachmentId);
      // Also update trade
      const trade = await db.trades.get(tradeId);
      if (trade) {
        trade.attachments = (trade.attachments || []).filter(a => a.id !== attachmentId);
        await db.trades.put(trade);
      }
      await logAudit('trade', 'SCREENSHOT_DELETED', `Deleted screenshot ${attachmentId} from trade ${tradeId}`);
      if (zoomedImage?.url) setZoomedImage(null);
      onRefreshData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Camera className="h-5 w-5 text-blue-400" />
            <span>Screenshot Vault & Chart Review</span>
          </h2>
          <p className="text-xs text-slate-400">
            {filteredScreenshots.length} of {allScreenshots.length} locally stored chart attachments
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          {/* Stage Filter */}
          <div className="flex rounded-lg border border-slate-800 bg-slate-900/60 p-1 text-xs">
            {(['ALL', 'before', 'entry', 'exit', 'post'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSelectedStage(s)}
                className={`rounded px-2.5 py-1 font-semibold uppercase text-[10px] transition ${
                  selectedStage === s ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Asset Filter */}
          <select
            value={selectedAsset}
            onChange={e => setSelectedAsset(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-200 focus:outline-none"
          >
            <option value="ALL">All Assets</option>
            <option value="XAUUSD">Gold (XAUUSD)</option>
            <option value="BTCUSD">Bitcoin (BTCUSD)</option>
          </select>
        </div>
      </div>

      {/* Gallery Grid */}
      {filteredScreenshots.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-[#111C2D] py-20 text-center text-slate-500 text-xs">
          <ImageIcon className="mx-auto h-8 w-8 text-slate-600 mb-2" />
          <span>No trade chart screenshots match the current filters.</span>
          <p className="text-[11px] text-slate-600 mt-1">Upload screenshots while logging or editing trades in the journal.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredScreenshots.map(({ attachment, trade }) => (
            <div
              key={attachment.id}
              className="group relative rounded-xl border border-slate-800 bg-[#111C2D] overflow-hidden shadow-xs hover:border-slate-700 transition flex flex-col"
            >
              {/* Image Thumbnail */}
              <div
                onClick={() => setZoomedImage({ url: attachment.dataUrl, title: `${trade.asset} (${attachment.type.toUpperCase()})`, trade })}
                className="relative h-44 w-full bg-slate-950 cursor-pointer overflow-hidden"
              >
                <img
                  src={attachment.dataUrl}
                  alt={attachment.type}
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
                <div className="absolute top-2 left-2 rounded bg-black/75 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur-xs">
                  {attachment.type}
                </div>
                <div className="absolute inset-0 bg-blue-600/15 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                  <ZoomIn className="h-6 w-6 text-white drop-shadow" />
                </div>
              </div>

              {/* Meta bar */}
              <div className="p-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <span className={trade.asset.includes('XAU') ? 'text-amber-400' : 'text-orange-400'}>
                      {trade.asset}
                    </span>
                    <span className={`text-[10px] ${trade.direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {trade.direction}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">{trade.tradeDate} • {trade.id}</div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onOpenTrade(trade)}
                    className="rounded p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-800"
                    title="View Trade in Journal"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteScreenshot(attachment.id, trade.id)}
                    className="rounded p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                    title="Delete Screenshot"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen Zoom Modal */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4 cursor-pointer"
        >
          <div className="relative max-h-[92vh] max-w-[95vw] overflow-hidden rounded-xl bg-slate-950 p-2 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-2 px-2 border-b border-slate-800 text-xs">
              <span className="font-bold text-slate-200">{zoomedImage.title}</span>
              <button onClick={() => setZoomedImage(null)} className="rounded p-1 text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <img src={zoomedImage.url} alt="Zoomed chart" className="max-h-[82vh] max-w-full rounded mt-2 object-contain mx-auto" />
          </div>
        </div>
      )}
    </div>
  );
};
