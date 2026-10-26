/**
 * Learner HAMZA - Fast Trade Recording Workflow
 * Quick script choice, Long/Short, Expected R:R, Strategy selection, Timeframe dropdown,
 * Quick Result with manual exit price override, Improvement box, Rule Breach reason,
 * Description box, Remark box, Optional PNG image upload & Clipboard paste, and bottom Save button.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Save,
  ArrowLeft,
  Upload,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Calculator,
  Lock,
  Camera,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Clipboard,
  Check,
  Clock,
  Sparkles,
  BookOpen,
  FileText,
  MessageSquare
} from 'lucide-react';
import {
  Trade,
  TradeAttachment,
  InstrumentConfig,
  Strategy,
  KillSwitchSettings
} from '../../types';
import {
  calculateGrossPnL,
  calculateNetPnL,
  calculateRMultiple
} from '../../services/calculationEngine';
import { db, logAudit } from '../../db/db';

interface AddEditTradePageProps {
  tradeToEdit: Trade | null;
  instruments: Record<string, InstrumentConfig>;
  strategies: Strategy[];
  killSwitchSettings: KillSwitchSettings;
  isLocked: boolean;
  currentEquity: number;
  onTradeSaved: () => void;
  onCancel: () => void;
}

const TIMEFRAME_OPTIONS = [
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

export const AddEditTradePage: React.FC<AddEditTradePageProps> = ({
  tradeToEdit,
  instruments,
  strategies,
  killSwitchSettings,
  isLocked,
  currentEquity,
  onTradeSaved,
  onCancel
}) => {
  const isEditing = Boolean(tradeToEdit);

  // 1. Script / Asset
  const [asset, setAsset] = useState<string>(tradeToEdit?.asset || 'XAUUSD');
  const [customAsset, setCustomAsset] = useState<string>('');

  // 2. Direction
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>(tradeToEdit?.direction || 'LONG');

  // 3. Timeframe Dropdown (1m, 2m, 5m, 15m, 30m, 1hr, 2hr, 4hr, 1D, 1W)
  const [timeframe, setTimeframe] = useState<string>(tradeToEdit?.timeframe || '15m');

  // 4. Strategy Selection
  const [strategyId, setStrategyId] = useState<string>(
    tradeToEdit?.strategyId || (strategies[0]?.id || 'strat_custom')
  );
  const [customStrategyName, setCustomStrategyName] = useState<string>(
    tradeToEdit?.strategyName || ''
  );

  // 5. Expected R:R
  const [targetRR, setTargetRR] = useState<number>(tradeToEdit?.plannedRR || 2.0);

  // 6. Position Size (auto-populated with configured recommended lot)
  const defaultRecommended =
    instruments[asset]?.fixedRecommendedLot || (asset === 'XAUUSD' ? 0.10 : 0.05);

  const [positionSize, setPositionSize] = useState<number>(
    tradeToEdit?.positionSize || defaultRecommended
  );

  // 7. Execution Prices
  const [entryPrice, setEntryPrice] = useState<number>(
    tradeToEdit?.entryPrice || (asset === 'XAUUSD' ? 2650.0 : 68000.0)
  );
  const [stopLossPrice, setStopLossPrice] = useState<number>(
    tradeToEdit?.stopLossPrice || (asset === 'XAUUSD' ? 2640.0 : 67000.0)
  );
  const [exitPrice, setExitPrice] = useState<number | undefined>(
    tradeToEdit?.exitPrice
  );

  // 8. Outcome Type: 'WIN' | 'LOSS' | 'BE' | 'OPEN' | 'MANUAL'
  const determineInitialOutcome = (): 'WIN' | 'LOSS' | 'BE' | 'OPEN' | 'MANUAL' => {
    if (!tradeToEdit) return 'WIN';
    if (tradeToEdit.status === 'Open') return 'OPEN';
    const net = tradeToEdit.netPnL || 0;
    if (Math.abs(net) < 1) return 'BE';
    if (net > 0) return 'WIN';
    return 'LOSS';
  };

  const [outcome, setOutcome] = useState<'WIN' | 'LOSS' | 'BE' | 'OPEN' | 'MANUAL'>(
    determineInitialOutcome()
  );

  // 9. Dates & Sessions
  const nowISO = new Date().toISOString();
  const [tradeDate, setTradeDate] = useState<string>(
    tradeToEdit?.tradeDate || nowISO.split('T')[0]
  );
  const [session, setSession] = useState<string>(tradeToEdit?.session || 'London');

  // 10. Discipline & Psychology
  const [ruleFollowed, setRuleFollowed] = useState<boolean>(tradeToEdit?.ruleFollowed ?? true);
  const [ruleBreachedReason, setRuleBreachedReason] = useState<string>(
    tradeToEdit?.ruleBreachedReason || ''
  );

  // 11. Narrative: Description, Remark, Lessons Learned (Improvement)
  const [description, setDescription] = useState<string>(
    tradeToEdit?.description || tradeToEdit?.entryReason || ''
  );
  const [remark, setRemark] = useState<string>(
    tradeToEdit?.remark || ''
  );
  const [lessonsLearned, setLessonsLearned] = useState<string>(
    tradeToEdit?.lessonsLearned || ''
  );

  // 12. Screenshots Attachments (Optional, with Clipboard Paste support)
  const [attachments, setAttachments] = useState<TradeAttachment[]>(
    tradeToEdit?.attachments || []
  );
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);

  // Contract specs
  const instrument = instruments[asset] || {
    contractSize: asset === 'XAUUSD' ? 100 : 1,
    minLot: 0.01,
    maxLot: 50,
    lotStep: 0.01
  };
  const contractSize = instrument.contractSize || (asset === 'XAUUSD' ? 100 : 1);

  // On Asset change, update defaults & recommended lot
  const handleSelectAsset = (newAsset: string) => {
    setAsset(newAsset);
    const rec = instruments[newAsset]?.fixedRecommendedLot || (newAsset === 'XAUUSD' ? 0.10 : 0.05);
    setPositionSize(rec);

    if (newAsset === 'XAUUSD') {
      setEntryPrice(2650.0);
      setStopLossPrice(direction === 'LONG' ? 2640.0 : 2660.0);
    } else if (newAsset === 'BTCUSD') {
      setEntryPrice(68000.0);
      setStopLossPrice(direction === 'LONG' ? 67000.0 : 69000.0);
    } else if (newAsset.includes('SOL')) {
      setEntryPrice(175.0);
      setStopLossPrice(direction === 'LONG' ? 170.0 : 180.0);
    } else if (newAsset.includes('ETH')) {
      setEntryPrice(2600.0);
      setStopLossPrice(direction === 'LONG' ? 2550.0 : 2650.0);
    } else {
      setEntryPrice(100.0);
      setStopLossPrice(direction === 'LONG' ? 95.0 : 105.0);
    }
  };

  // Compute SL distance & Take profit from Target R:R
  const slDistance = Math.abs(entryPrice - stopLossPrice);
  const calculatedTakeProfit =
    direction === 'LONG'
      ? Number((entryPrice + slDistance * targetRR).toFixed(2))
      : Number((entryPrice - slDistance * targetRR).toFixed(2));

  // Quick Outcome Selector changes exit price automatically
  const handleSelectOutcome = (newOutcome: 'WIN' | 'LOSS' | 'BE' | 'OPEN') => {
    setOutcome(newOutcome);
    if (newOutcome === 'WIN') {
      setExitPrice(calculatedTakeProfit);
    } else if (newOutcome === 'LOSS') {
      setExitPrice(stopLossPrice);
    } else if (newOutcome === 'BE') {
      setExitPrice(entryPrice); // Cost to cost
    } else if (newOutcome === 'OPEN') {
      setExitPrice(undefined);
    }
  };

  // Manual Exit Price Edit Handler
  const handleManualExitPriceChange = (valStr: string) => {
    if (valStr === '') {
      setExitPrice(undefined);
      setOutcome('OPEN');
      return;
    }
    const val = parseFloat(valStr);
    setExitPrice(val);
    setOutcome('MANUAL');
  };

  // Live P&L Calculations (reactive to either automatic or manually typed exit price)
  const isTradeClosed = outcome !== 'OPEN' && exitPrice !== undefined;

  const grossPnL = isTradeClosed
    ? calculateGrossPnL(entryPrice, exitPrice!, direction, positionSize, contractSize)
    : undefined;

  const estimatedFees = Number((positionSize * (asset === 'XAUUSD' ? 4 : 5)).toFixed(2));
  const netPnL =
    grossPnL !== undefined
      ? calculateNetPnL(grossPnL, { entryFees: estimatedFees / 2, exitFees: estimatedFees / 2 })
      : undefined;

  const plannedRiskAmount = slDistance * positionSize * contractSize;
  const actualR =
    netPnL !== undefined && plannedRiskAmount > 0
      ? calculateRMultiple(netPnL, plannedRiskAmount)
      : undefined;

  // Clipboard Paste Event Listener (Ctrl+V / Cmd+V)
  const handlePasteImage = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const newAtt: TradeAttachment = {
              id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              tradeId: tradeToEdit?.id || 'temp',
              type: 'entry',
              dataUrl,
              fileName: `chart_${Date.now()}.png`,
              fileSize: file.size,
              uploadedAt: new Date().toISOString()
            };
            setAttachments(prev => [...prev, newAtt]);
            setPasteNotice('Chart screenshot successfully pasted from clipboard (PNG)!');
            setTimeout(() => setPasteNotice(null), 3500);
          };
          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    }
  }, [tradeToEdit]);

  useEffect(() => {
    window.addEventListener('paste', handlePasteImage);
    return () => window.removeEventListener('paste', handlePasteImage);
  }, [handlePasteImage]);

  // File Upload fallback (accepts PNG and JPG, non-mandatory)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const newAtt: TradeAttachment = {
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        tradeId: tradeToEdit?.id || 'temp',
        type: 'entry',
        dataUrl,
        fileName: file.name.endsWith('.png') ? file.name : `${file.name.split('.')[0]}.png`,
        fileSize: file.size,
        uploadedAt: new Date().toISOString()
      };
      setAttachments(prev => [...prev, newAtt]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // Resolve strategy name
  const resolvedStrategyName = useMemo(() => {
    if (strategyId === 'strat_custom') {
      return customStrategyName.trim() || 'Custom Setup';
    }
    const matched = strategies.find(s => s.id === strategyId);
    return matched ? matched.name : (customStrategyName.trim() || 'Default Strategy');
  }, [strategyId, customStrategyName, strategies]);

  // Save / Record Trade Action
  const handleSave = async () => {
    if (isLocked && !isEditing) {
      alert('Kill Switch lock is active. New trades are blocked.');
      return;
    }

    if (entryPrice <= 0 || stopLossPrice <= 0 || positionSize <= 0) {
      alert('Entry price, stop loss, and lot size must be valid positive numbers.');
      return;
    }

    const tradeId =
      tradeToEdit?.id || `TRD-${tradeDate.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const finalAttachments = attachments.map(a => ({ ...a, tradeId }));

    const tradeRecord: Trade = {
      id: tradeId,
      accountId: 'acc_primary',
      asset: asset === 'CUSTOM' ? (customAsset || 'CUSTOM') : asset,
      instrumentSymbol: asset === 'CUSTOM' ? (customAsset || 'CUSTOM') : asset,
      direction,
      status: outcome === 'OPEN' ? 'Open' : 'Closed',
      strategyId,
      strategyName: resolvedStrategyName,
      timeframe,
      session: session as any,
      tradeDate,
      entryTime: tradeToEdit?.entryTime || new Date().toISOString(),
      exitTime: outcome === 'OPEN' ? undefined : (tradeToEdit?.exitTime || new Date().toISOString()),
      timezone: 'UTC',
      entryPrice,
      exitPrice: outcome === 'OPEN' ? undefined : exitPrice,
      stopLossPrice,
      takeProfitPrice: calculatedTakeProfit,
      positionSize,
      contractSize,
      entryFees: estimatedFees / 2,
      exitFees: estimatedFees / 2,
      swapFundingFees: 0,
      slippage: 0,
      otherCosts: 0,
      plannedRiskAmount: Number(plannedRiskAmount.toFixed(2)),
      plannedRiskPercent: Number(((plannedRiskAmount / (currentEquity || 10000)) * 100).toFixed(2)),
      plannedRR: targetRR,
      grossPnL,
      netPnL,
      actualR,
      ruleFollowed,
      ruleBreachedReason: !ruleFollowed ? ruleBreachedReason : undefined,
      entryReason: description || `${direction} ${asset} (${timeframe})`,
      description,
      remark,
      lessonsLearned,
      notes: remark || description,
      attachments: finalAttachments,
      createdAt: tradeToEdit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.trades.put(tradeRecord);
    if (finalAttachments.length > 0) {
      await db.attachments.bulkPut(finalAttachments);
    }

    await logAudit(
      'trade',
      isEditing ? 'TRADE_MODIFIED' : 'TRADE_LOGGED',
      `${isEditing ? 'Modified' : 'Recorded'} ${direction} ${asset} on ${timeframe} (${tradeId}) Result: ${outcome} P&L: ${netPnL !== undefined ? `$${netPnL}` : 'Open'}`,
      tradeId
    );

    onTradeSaved();
  };

  // Delete trade action (Modify / Delete requirement)
  const handleDeleteThisTrade = async () => {
    if (!tradeToEdit) return;
    if (confirm(`Are you sure you want to permanently delete trade ${tradeToEdit.id}? It will immediately adjust your capital balance.`)) {
      await db.trades.delete(tradeToEdit.id);
      await db.attachments.where('tradeId').equals(tradeToEdit.id).delete();
      await logAudit('trade', 'TRADE_DELETED', `Deleted trade ${tradeToEdit.id}`);
      onTradeSaved();
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Top Action Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-100">
              {isEditing && tradeToEdit ? `Modify Trade (${tradeToEdit.id})` : 'Fast Trade Entry'}
            </h2>
            <p className="text-xs text-slate-400">
              Select script, direction, timeframe, strategy, expected R:R, and outcome
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing && (
            <button
              type="button"
              onClick={handleDeleteThisTrade}
              className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-950/20 px-3.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 transition"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Trade</span>
            </button>
          )}

          <button
            type="button"
            disabled={isLocked && !isEditing}
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 disabled:opacity-40 transition"
          >
            <Save className="h-4 w-4" />
            <span>{isEditing ? 'Save Changes' : 'Record Trade'}</span>
          </button>
        </div>
      </div>

      {/* Paste Notice Alert */}
      {pasteNotice && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-300 flex items-center gap-2 animate-pulse">
          <Check className="h-4 w-4 text-emerald-400" />
          <span>{pasteNotice}</span>
        </div>
      )}

      {/* STEP 1: Script Selection */}
      <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-4 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            1. Choose Script / Instrument
          </label>
          <span className="text-[10px] text-slate-500 font-mono">
            {Object.keys(instruments).length} scripts available
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
          {Object.values(instruments).map(inst => (
            <button
              key={inst.symbol}
              type="button"
              onClick={() => handleSelectAsset(inst.symbol)}
              className={`rounded-xl border py-3 px-3 text-center font-bold text-xs transition ${
                asset === inst.symbol
                  ? 'border-blue-500 bg-blue-500/20 text-blue-300 shadow-md ring-1 ring-blue-500'
                  : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="text-sm font-mono">{inst.symbol}</div>
              <div className="text-[10px] text-slate-400 font-normal mt-0.5 truncate">{inst.name}</div>
              {inst.fixedRecommendedLot && (
                <div className="text-[10px] text-emerald-400 font-mono mt-1">
                  Lot: {inst.fixedRecommendedLot}
                </div>
              )}
            </button>
          ))}

          <button
            type="button"
            onClick={() => handleSelectAsset('CUSTOM')}
            className={`rounded-xl border py-3 px-3 text-center font-bold text-xs transition ${
              asset === 'CUSTOM'
                ? 'border-blue-500 bg-blue-500/20 text-blue-300 shadow-md ring-1 ring-blue-500'
                : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="text-sm font-mono">+ Custom</div>
            <div className="text-[10px] text-slate-400 font-normal mt-0.5">Other Asset</div>
          </button>
        </div>

        {asset === 'CUSTOM' && (
          <div className="pt-2">
            <input
              type="text"
              value={customAsset}
              onChange={e => setCustomAsset(e.target.value.toUpperCase())}
              placeholder="Enter symbol (e.g. SOLUSD, EURUSD, US30)..."
              className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 font-mono"
            />
          </div>
        )}
      </div>

      {/* STEP 2: Direction, Timeframe & Strategy */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Direction */}
        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-4 space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            2. Direction
          </label>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setDirection('LONG');
                if (stopLossPrice >= entryPrice) setStopLossPrice(Number((entryPrice * 0.995).toFixed(2)));
              }}
              className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-extrabold transition ${
                direction === 'LONG'
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400 shadow-md ring-1 ring-emerald-500'
                  : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
              }`}
            >
              <ArrowUpRight className="h-4 w-4" />
              <span>LONG</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDirection('SHORT');
                if (stopLossPrice <= entryPrice) setStopLossPrice(Number((entryPrice * 1.005).toFixed(2)));
              }}
              className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-extrabold transition ${
                direction === 'SHORT'
                  ? 'border-rose-500 bg-rose-500/20 text-rose-400 shadow-md ring-1 ring-rose-500'
                  : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
              }`}
            >
              <ArrowDownRight className="h-4 w-4" />
              <span>SHORT</span>
            </button>
          </div>
        </div>

        {/* Timeframe Dropdown (1m,2m,5m,15m,30m,1hr,2hr,4hr,1D,1W) */}
        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-4 space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-blue-400" />
            <span>Time Frame</span>
          </label>
          <div className="pt-1">
            <select
              value={timeframe}
              onChange={e => setTimeframe(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono font-bold text-slate-100 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {TIMEFRAME_OPTIONS.map(tf => (
                <option key={tf} value={tf}>
                  {tf} Chart
                </option>
              ))}
            </select>
          </div>
          <span className="text-[10px] text-slate-500">Execution chart timeframe</span>
        </div>

        {/* Strategy Selector */}
        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-4 space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-amber-400" />
            <span>Trading Strategy</span>
          </label>
          <div className="pt-1">
            <select
              value={strategyId}
              onChange={e => setStrategyId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {strategies.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="strat_custom">+ Custom Strategy Name</option>
            </select>
          </div>

          {strategyId === 'strat_custom' && (
            <input
              type="text"
              value={customStrategyName}
              onChange={e => setCustomStrategyName(e.target.value)}
              placeholder="Enter strategy name..."
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-100 focus:outline-none"
            />
          )}
        </div>
      </div>

      {/* STEP 3: Execution Prices & Target R:R */}
      <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            3. Execution Prices & Position Sizing
          </label>
          <span className="text-[10px] text-slate-400 font-mono">
            Lot Size: <strong className="text-amber-300">{positionSize}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] text-slate-400">Position Size / Lots</label>
            <input
              type="number"
              step="0.01"
              value={positionSize}
              onChange={e => setPositionSize(parseFloat(e.target.value) || 0)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 font-mono font-bold focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400">Entry Price ($)</label>
            <input
              type="number"
              step="any"
              value={entryPrice}
              onChange={e => setEntryPrice(parseFloat(e.target.value) || 0)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-rose-400">Stop Loss Price ($)</label>
            <input
              type="number"
              step="any"
              value={stopLossPrice}
              onChange={e => setStopLossPrice(parseFloat(e.target.value) || 0)}
              className="mt-1 w-full rounded border border-rose-500/40 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-emerald-400">Target R:R Ratio</label>
            <div className="mt-1 flex items-center gap-1">
              <input
                type="number"
                step="0.5"
                value={targetRR}
                onChange={e => setTargetRR(parseFloat(e.target.value) || 1)}
                className="w-16 rounded border border-emerald-500/40 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 font-mono font-bold"
              />
              {[1.5, 2.0, 3.0].map(rr => (
                <button
                  key={rr}
                  type="button"
                  onClick={() => setTargetRR(rr)}
                  className={`rounded border px-2 py-1.5 text-[10px] font-mono transition ${
                    targetRR === rr
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold'
                      : 'border-slate-800 bg-slate-800/40 text-slate-400'
                  }`}
                >
                  {rr}R
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1 font-mono gap-2 border-t border-slate-800/60 mt-1">
          <span>Stop Distance: <strong className="text-slate-200">{slDistance.toFixed(2)} pts</strong></span>
          <span>Target TP: <strong className="text-emerald-400">${calculatedTakeProfit.toFixed(2)}</strong></span>
          <span>Risk Budget: <strong className="text-amber-400">${plannedRiskAmount.toFixed(2)}</strong></span>
        </div>
      </div>

      {/* STEP 4: Outcome, Exit Price (Auto + Manual Edit), and Improvement Box */}
      <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-4 space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
          4. Trade Outcome & Exit Price
        </label>

        {/* Quick Outcome Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => handleSelectOutcome('WIN')}
            className={`rounded-xl border py-3 px-3 text-center transition ${
              outcome === 'WIN'
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400 shadow-md ring-1 ring-emerald-500'
                : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="text-sm font-extrabold text-emerald-400">PROFIT / WIN</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Auto-fills TP (${calculatedTakeProfit})</div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectOutcome('LOSS')}
            className={`rounded-xl border py-3 px-3 text-center transition ${
              outcome === 'LOSS'
                ? 'border-rose-500 bg-rose-500/20 text-rose-400 shadow-md ring-1 ring-rose-500'
                : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="text-sm font-extrabold text-rose-400">LOSS / STOP HIT</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Auto-fills SL (${stopLossPrice})</div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectOutcome('BE')}
            className={`rounded-xl border py-3 px-3 text-center transition ${
              outcome === 'BE'
                ? 'border-blue-500 bg-blue-500/20 text-blue-300 shadow-md ring-1 ring-blue-500'
                : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="text-sm font-extrabold text-blue-300">COST TO COST</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Break-Even (${entryPrice})</div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectOutcome('OPEN')}
            className={`rounded-xl border py-3 px-3 text-center transition ${
              outcome === 'OPEN'
                ? 'border-purple-500 bg-purple-500/20 text-purple-300 shadow-md ring-1 ring-purple-500'
                : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="text-sm font-extrabold text-purple-300">OPEN POSITION</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Currently Running</div>
          </button>
        </div>

        {/* Exit Price Input (Auto-calculated, or can be manually modified by user) */}
        <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-3.5 space-y-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-slate-200">
                Exit Price ($)
              </span>
              <p className="text-[10px] text-slate-400">
                Auto-calculated from outcome, or you can manually type any exact exit price below
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="number"
                step="any"
                value={exitPrice !== undefined ? exitPrice : ''}
                onChange={e => handleManualExitPriceChange(e.target.value)}
                placeholder="Open trade..."
                className="w-full sm:w-44 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 font-mono font-bold focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Real-time Net P&L Summary */}
          <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 font-mono text-xs">
            <div>
              <span className="text-slate-400">Outcome Status: </span>
              <span className="font-bold text-slate-200">{outcome}</span>
            </div>
            <div>
              <span className="text-slate-400">Result Net P&L: </span>
              <span className={`text-sm font-extrabold ${
                netPnL !== undefined
                  ? netPnL >= 0 ? 'text-[#20C997]' : 'text-[#FF5263]'
                  : 'text-purple-400'
              }`}>
                {netPnL !== undefined ? `${netPnL >= 0 ? '+' : ''}$${netPnL.toFixed(2)}` : 'Position Open'}
              </span>
              {actualR !== undefined && (
                <span className="ml-2 text-slate-400 text-[11px]">
                  ({actualR > 0 ? `+${actualR}R` : `${actualR}R`})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Improvement Box (What could be improved? / Lessons) */}
        <div className="space-y-1 pt-1">
          <label className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>Improvement Box / Lessons Learned (What to improve next time?)</span>
          </label>
          <textarea
            value={lessonsLearned}
            onChange={e => setLessonsLearned(e.target.value)}
            rows={2}
            placeholder="e.g. Wait for 15m candle close confirmation, take 50% partials at 2R, avoid moving stop-loss early..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* STEP 5: Discipline & Rule Breach Reason Box */}
      <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-4 space-y-3 text-xs">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
          5. Trading Discipline & Plan Followed
        </label>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span className="text-slate-300 font-medium">Did you follow your trading rules and plan?</span>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setRuleFollowed(true);
                setRuleBreachedReason('');
              }}
              className={`flex-1 sm:flex-initial rounded-lg px-4 py-1.5 text-xs font-bold transition ${
                ruleFollowed
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
              }`}
            >
              YES (Plan Followed)
            </button>
            <button
              type="button"
              onClick={() => setRuleFollowed(false)}
              className={`flex-1 sm:flex-initial rounded-lg px-4 py-1.5 text-xs font-bold transition ${
                !ruleFollowed
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
              }`}
            >
              NO (Rule Breach)
            </button>
          </div>
        </div>

        {/* Conditional Rule Breach Box */}
        {!ruleFollowed && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-950/20 p-3 space-y-2 mt-2">
            <div className="flex items-center gap-2 text-rose-300 font-bold">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              <span>Rule Breach Details (What rule did you breach?)</span>
            </div>
            <input
              type="text"
              value={ruleBreachedReason}
              onChange={e => setRuleBreachedReason(e.target.value)}
              placeholder="e.g. FOMO early entry, moved stop loss, overleveraged, trade outside London session..."
              className="w-full rounded border border-rose-500/40 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder:text-rose-300/40 focus:outline-none focus:border-rose-400"
            />
            {/* Quick breach tags */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                'FOMO Entry',
                'Moved Stop Loss',
                'Overleveraged',
                'Entered Before Candle Close',
                'Revenge Trading',
                'Traded During News'
              ].map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setRuleBreachedReason(prev => prev ? `${prev}, ${tag}` : tag)}
                  className="rounded bg-rose-950/60 border border-rose-800/40 px-2 py-0.5 text-[10px] text-rose-300 hover:bg-rose-900/60 transition"
                >
                  +{tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* STEP 6: Description Box & Remark Box */}
      <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-4 space-y-4 text-xs">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
          6. Trade Description & Remarks
        </label>

        {/* Description Box */}
        <div className="space-y-1">
          <label className="text-slate-300 font-semibold flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-blue-400" />
            <span>Description Box (Setup Context & Technical Narrative)</span>
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="Describe the setup: market structure, key level retest, liquidity sweep, session bias..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Remark Box */}
        <div className="space-y-1">
          <label className="text-slate-300 font-semibold flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-purple-400" />
            <span>Remark Box (Execution Remarks & Broker Notes)</span>
          </label>
          <textarea
            value={remark}
            onChange={e => setRemark(e.target.value)}
            rows={2}
            placeholder="Execution remarks: slippage observations, fill speed, spread conditions, psychological state..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* STEP 7: Chart Screenshot (Explicitly Non-Mandatory / Optional) */}
      <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Camera className="h-4 w-4 text-blue-400" />
            <span>7. Chart Screenshot <span className="text-[10px] text-slate-500 font-normal lowercase">(optional - not mandatory)</span></span>
          </label>
          <span className="text-[10px] text-slate-400 font-mono">
            {attachments.length} attached
          </span>
        </div>

        {/* Paste dropzone box */}
        <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/60 p-5 cursor-pointer hover:border-blue-500 transition group">
          <Clipboard className="h-7 w-7 text-blue-400 group-hover:scale-110 transition" />
          <span className="mt-2 text-xs font-bold text-slate-200">
            Press <kbd className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-blue-300 font-mono">Ctrl + V</kbd> to Paste Screenshot Directly (PNG)
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5">
            Or click to upload PNG/JPG file from your computer (Optional)
          </span>
          <input
            type="file"
            accept="image/png, image/jpeg, image/webp"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {/* Attached Thumbnails */}
        {attachments.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {attachments.map(att => (
              <div
                key={att.id}
                className="group relative rounded-lg border border-slate-800 overflow-hidden bg-slate-950"
              >
                <img src={att.dataUrl} alt="Chart attachment" className="h-24 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="absolute top-1 right-1 rounded bg-rose-600/90 p-1 text-white opacity-0 group-hover:opacity-100 transition shadow"
                  title="Remove image"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOTTOM ACTION BAR (Save Button at the bottom as well) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#111C2D] p-4 shadow-xl">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span>Active Asset: <strong className="text-slate-100">{asset}</strong></span>
          <span>•</span>
          <span>TF: <strong className="text-blue-400">{timeframe}</strong></span>
          <span>•</span>
          <span>Strategy: <strong className="text-amber-300">{resolvedStrategyName}</strong></span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
          >
            Cancel
          </button>

          {isEditing && (
            <button
              type="button"
              onClick={handleDeleteThisTrade}
              className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-2 text-xs font-bold text-rose-300 hover:bg-rose-900/40 transition"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Trade</span>
            </button>
          )}

          <button
            type="button"
            disabled={isLocked && !isEditing}
            onClick={handleSave}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 disabled:opacity-40 transition"
          >
            <Save className="h-4 w-4" />
            <span>{isEditing ? 'Save Changes' : 'Record Trade'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
