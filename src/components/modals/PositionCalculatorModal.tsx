/**
 * Learner HAMZA - Capital-Aware Position Size Calculator Modal
 * High-precision sizing for Gold (lots/ounces) & Bitcoin (quantity/contracts)
 */

import React, { useState, useEffect } from 'react';
import { X, Calculator, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';
import { InstrumentConfig, KillSwitchSettings } from '../../types';
import { calculatePositionSize, PositionSizeResult } from '../../services/calculationEngine';

interface PositionCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  instruments: Record<string, InstrumentConfig>;
  currentEquity: number;
  killSwitchSettings: KillSwitchSettings;
  remainingDailyLoss: number;
  onApplyToTrade?: (params: {
    asset: string;
    direction: 'LONG' | 'SHORT';
    entryPrice: number;
    stopLossPrice: number;
    takeProfitPrice?: number;
    positionSize: number;
    plannedRiskAmount: number;
  }) => void;
}

export const PositionCalculatorModal: React.FC<PositionCalculatorModalProps> = ({
  isOpen,
  onClose,
  instruments,
  currentEquity,
  killSwitchSettings,
  remainingDailyLoss,
  onApplyToTrade
}) => {
  const [selectedAsset, setSelectedAsset] = useState<string>('XAUUSD');
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [equity, setEquity] = useState<number>(currentEquity || 10000);
  const [riskPercent, setRiskPercent] = useState<number>(1.0);
  const [entryPrice, setEntryPrice] = useState<number>(selectedAsset === 'XAUUSD' ? 2650.0 : 68000.0);
  const [stopLossPrice, setStopLossPrice] = useState<number>(selectedAsset === 'XAUUSD' ? 2640.0 : 67000.0);
  const [takeProfitPrice, setTakeProfitPrice] = useState<number>(selectedAsset === 'XAUUSD' ? 2675.0 : 70500.0);
  const [result, setResult] = useState<PositionSizeResult | null>(null);

  // Sync default prices when asset changes
  const handleAssetChange = (sym: string) => {
    setSelectedAsset(sym);
    if (sym === 'XAUUSD') {
      setEntryPrice(2650.0);
      setStopLossPrice(direction === 'LONG' ? 2640.0 : 2660.0);
      setTakeProfitPrice(direction === 'LONG' ? 2675.0 : 2625.0);
    } else if (sym === 'BTCUSD') {
      setEntryPrice(68000.0);
      setStopLossPrice(direction === 'LONG' ? 67000.0 : 69000.0);
      setTakeProfitPrice(direction === 'LONG' ? 70500.0 : 65500.0);
    }
  };

  const handleDirectionChange = (dir: 'LONG' | 'SHORT') => {
    setDirection(dir);
    if (dir === 'LONG') {
      if (stopLossPrice >= entryPrice) setStopLossPrice(Number((entryPrice * 0.995).toFixed(2)));
      if (takeProfitPrice <= entryPrice) setTakeProfitPrice(Number((entryPrice * 1.01).toFixed(2)));
    } else {
      if (stopLossPrice <= entryPrice) setStopLossPrice(Number((entryPrice * 1.005).toFixed(2)));
      if (takeProfitPrice >= entryPrice) setTakeProfitPrice(Number((entryPrice * 0.99).toFixed(2)));
    }
  };

  // Recalculate whenever inputs change
  useEffect(() => {
    const inst = instruments[selectedAsset] || {
      symbol: selectedAsset,
      name: selectedAsset,
      contractSize: selectedAsset === 'XAUUSD' ? 100 : 1,
      minLot: 0.01,
      maxLot: 50,
      lotStep: 0.01,
      tickSize: 0.01,
      tickValue: 1,
      defaultCommission: 5,
      spreadEstimate: 0.2,
      slippageEstimate: 0.05
    };

    const res = calculatePositionSize(
      equity,
      riskPercent,
      entryPrice,
      stopLossPrice,
      takeProfitPrice,
      inst as any,
      direction
    );
    setResult(res);
  }, [selectedAsset, direction, equity, riskPercent, entryPrice, stopLossPrice, takeProfitPrice, instruments]);

  if (!isOpen) return null;

  const inst = instruments[selectedAsset];
  const isLossExceedingDailyAllowance = result && Math.abs(result.estimatedNetLossAtSL) > remainingDailyLoss;
  const isLockActive = killSwitchSettings.emergencyLockActive;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-500/20 p-2 text-blue-400">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Position Size & Risk Sizer</h2>
              <p className="text-xs text-slate-400">Capital-aware exposure calculator for Gold & Bitcoin</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Warning if lock or low allowance */}
        {isLockActive && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <span>Trading lock active! Sizing recommendations are labeled as blocked under risk rules.</span>
          </div>
        )}

        {isLossExceedingDailyAllowance && !isLockActive && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Warning: Proposed risk (${Math.abs(result?.estimatedNetLossAtSL || 0).toFixed(2)}) exceeds remaining daily loss allowance (${remainingDailyLoss.toFixed(2)}).</span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Controls Column */}
          <div className="space-y-3">
            {/* Asset Selection */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Instrument</label>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAssetChange('XAUUSD')}
                  className={`flex-1 rounded-lg border py-2 text-xs font-medium transition ${
                    selectedAsset === 'XAUUSD'
                      ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                      : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  XAUUSD (Gold)
                </button>
                <button
                  type="button"
                  onClick={() => handleAssetChange('BTCUSD')}
                  className={`flex-1 rounded-lg border py-2 text-xs font-medium transition ${
                    selectedAsset === 'BTCUSD'
                      ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                      : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  BTCUSD (Bitcoin)
                </button>
              </div>
            </div>

            {/* Direction */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Direction</label>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleDirectionChange('LONG')}
                  className={`flex-1 rounded-lg border py-1.5 text-xs font-bold transition ${
                    direction === 'LONG'
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                      : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  LONG (BUY)
                </button>
                <button
                  type="button"
                  onClick={() => handleDirectionChange('SHORT')}
                  className={`flex-1 rounded-lg border py-1.5 text-xs font-bold transition ${
                    direction === 'SHORT'
                      ? 'border-rose-500 bg-rose-500/20 text-rose-400'
                      : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  SHORT (SELL)
                </button>
              </div>
            </div>

            {/* Equity & Risk % */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-400">Equity ($)</label>
                <input
                  type="number"
                  value={equity}
                  onChange={e => setEquity(parseFloat(e.target.value) || 0)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400">Risk %</label>
                <input
                  type="number"
                  step="0.25"
                  value={riskPercent}
                  onChange={e => setRiskPercent(parseFloat(e.target.value) || 0)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Risk Presets */}
            <div className="flex gap-1.5">
              {[0.25, 0.5, 1.0, 2.0].map(pct => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setRiskPercent(pct)}
                  className={`flex-1 rounded border py-1 text-[11px] font-mono transition ${
                    riskPercent === pct
                      ? 'border-blue-500 bg-blue-500/20 text-blue-300 font-bold'
                      : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>

            {/* Prices */}
            <div className="space-y-2 pt-1">
              <div>
                <label className="text-xs text-slate-400">Entry Price</label>
                <input
                  type="number"
                  step="any"
                  value={entryPrice}
                  onChange={e => setEntryPrice(parseFloat(e.target.value) || 0)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Stop Loss Price</label>
                <input
                  type="number"
                  step="any"
                  value={stopLossPrice}
                  onChange={e => setStopLossPrice(parseFloat(e.target.value) || 0)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Take Profit Price (Optional)</label>
                <input
                  type="number"
                  step="any"
                  value={takeProfitPrice}
                  onChange={e => setTakeProfitPrice(parseFloat(e.target.value) || 0)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Results Column */}
          <div className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs text-slate-400">Target Risk Budget</span>
                <span className="font-mono text-sm font-bold text-amber-400">
                  ${result ? result.riskBudget.toFixed(2) : '0.00'}
                </span>
              </div>

              {/* Sized Position */}
              <div className="rounded-lg border border-blue-500/30 bg-blue-950/20 p-3 text-center">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-300">
                  Recommended Position Size
                </div>
                <div className="mt-1 font-mono text-3xl font-extrabold text-blue-400">
                  {result ? result.positionSize : 0}{' '}
                  <span className="text-sm font-medium text-slate-400">
                    {selectedAsset === 'XAUUSD' ? 'Lots (100 oz)' : 'BTC'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Strictly rounded down to lot step ({inst?.lotStep || 0.01})
                </div>
              </div>

              {/* Metrics Table */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Stop Loss Distance:</span>
                  <span className="font-mono text-slate-200">
                    {result ? result.stopLossDistance : 0} pts
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Max Net Loss at SL:</span>
                  <span className="font-mono font-medium text-rose-400">
                    ${result ? Math.abs(result.estimatedNetLossAtSL).toFixed(2) : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Est. Profit at TP:</span>
                  <span className="font-mono font-medium text-emerald-400">
                    +${result ? result.estimatedNetProfit.toFixed(2) : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Planned Reward-to-Risk:</span>
                  <span className="font-mono font-bold text-slate-200">
                    1 : {result ? result.rewardToRiskRatio : 0} R
                  </span>
                </div>
              </div>

              {/* Warnings */}
              {result && result.warnings.length > 0 && (
                <div className="mt-2 rounded border border-amber-900/50 bg-amber-950/20 p-2 text-[11px] text-amber-300/90">
                  {result.warnings.map((w, idx) => (
                    <div key={idx} className="flex items-start gap-1">
                      <span>•</span>
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-4 pt-3 border-t border-slate-800">
              {onApplyToTrade && (
                <button
                  type="button"
                  disabled={!result || !result.isValid || isLockActive}
                  onClick={() => {
                    if (result && result.isValid) {
                      onApplyToTrade({
                        asset: selectedAsset,
                        direction,
                        entryPrice,
                        stopLossPrice,
                        takeProfitPrice: takeProfitPrice > 0 ? takeProfitPrice : undefined,
                        positionSize: result.positionSize,
                        plannedRiskAmount: result.riskBudget
                      });
                      onClose();
                    }
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Apply to Add Trade Form</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
