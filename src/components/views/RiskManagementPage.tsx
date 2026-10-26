/**
 * Learner HAMZA - Dedicated Risk Management & Kill Switch Workstation
 * Real-time daily loss monitoring, threshold matrix, and safety lock audit
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  AlertTriangle,
  Sliders,
  Clock,
  History,
  Activity,
  CheckCircle2,
  Save
} from 'lucide-react';
import { KillSwitchSettings, KillSwitchEvent, Account, Trade } from '../../types';
import { db, logAudit } from '../../db/db';

interface RiskManagementPageProps {
  settings: KillSwitchSettings;
  account: Account | null;
  todayClosedTrades: Trade[];
  allTrades: Trade[];
  isLocked: boolean;
  warningPercent: number;
  dailyLossConsumed: number;
  dailyLossLimit: number;
  remainingDailyLoss: number;
  onUpdateSettings: (newSettings: KillSwitchSettings) => void;
  onOpenLockModal: () => void;
}

export const RiskManagementPage: React.FC<RiskManagementPageProps> = ({
  settings,
  account,
  todayClosedTrades,
  allTrades,
  isLocked,
  warningPercent,
  dailyLossConsumed,
  dailyLossLimit,
  remainingDailyLoss,
  onUpdateSettings,
  onOpenLockModal
}) => {
  const [events, setEvents] = useState<KillSwitchEvent[]>([]);
  const [editableSettings, setEditableSettings] = useState<KillSwitchSettings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setEditableSettings({ ...settings });
  }, [settings]);

  useEffect(() => {
    const loadEvents = async () => {
      const list = await db.killSwitchEvents.reverse().limit(30).toArray();
      setEvents(list);
    };
    loadEvents();
  }, [isLocked]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await db.settings.put({ key: 'killSwitchSettings', value: editableSettings });
      await logAudit(
        'config',
        'KILL_SWITCH_CONFIG_UPDATED',
        `Updated risk limits: Daily Net Limit $${editableSettings.maxDailyNetLoss}, Mode: ${editableSettings.mode}`
      );
      onUpdateSettings(editableSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-400" />
            <span>Risk Architecture & Kill Switch Control</span>
          </h2>
          <p className="text-xs text-slate-400">
            Real-time loss threshold enforcement and capital protection rules
          </p>
        </div>

        <button
          onClick={onOpenLockModal}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition shadow-md ${
            isLocked
              ? 'bg-red-600 text-white hover:bg-red-500 shadow-red-600/30'
              : 'border border-red-500/50 bg-red-950/20 text-red-300 hover:bg-red-950/40'
          }`}
        >
          {isLocked ? <Lock className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span>{isLocked ? 'LOCK ACTIVE (UNTIL 12 AM)' : 'EMERGENCY LOCK'}</span>
        </button>
      </div>

      {/* Real-Time Daily Loss Monitor Bar */}
      <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-400" />
              <span>Real-Time Daily Risk Monitor</span>
            </h3>
            <p className="text-xs text-slate-400">
              Measuring realized net loss against daily capital limit (${dailyLossLimit.toFixed(2)})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
              isLocked
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                : warningPercent >= 75
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
            }`}>
              {isLocked ? 'ENFORCED LOCK ACTIVE' : warningPercent >= 75 ? 'WARNING LEVEL' : 'SAFE / ARMED'}
            </span>
          </div>
        </div>

        {/* Progress gauge */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-400">
              Consumed: <strong className="text-slate-200">${dailyLossConsumed.toFixed(2)}</strong> ({warningPercent.toFixed(1)}%)
            </span>
            <span className="text-slate-400">
              Remaining Allowance: <strong className="text-emerald-400 font-bold">${remainingDailyLoss.toFixed(2)}</strong>
            </span>
          </div>

          <div className="h-4 w-full rounded-full bg-slate-800 overflow-hidden relative">
            <div
              className={`h-full transition-all duration-300 ${
                warningPercent >= 100
                  ? 'bg-rose-500'
                  : warningPercent >= 75
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, warningPercent)}%` }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0% ($0)</span>
            <span>50% Advisory</span>
            <span>75% Warning</span>
            <span>90% Critical</span>
            <span>100% Lockout (${dailyLossLimit.toFixed(0)})</span>
          </div>
        </div>
      </div>

      {/* Threshold Matrix Settings & Mode Switch */}
      <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-5 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Sliders className="h-4 w-4 text-blue-400" />
              <span>Risk Threshold Matrix Configuration</span>
            </h3>
            <p className="text-xs text-slate-400">
              Individual safety triggers for daily, drawdown, streak and asset limits
            </p>
          </div>

          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500 disabled:opacity-40 transition"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Risk Rules'}</span>
          </button>
        </div>

        {/* Operating Mode Toggle */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
            Operating Enforcement Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => setEditableSettings(s => ({ ...s, mode: 'lock' }))}
              className={`rounded-lg border p-3 text-left transition ${
                editableSettings.mode === 'lock'
                  ? 'border-blue-500 bg-blue-950/20 text-blue-200'
                  : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-bold text-xs flex items-center gap-1.5 text-slate-100">
                <Lock className="h-3.5 w-3.5 text-blue-400" />
                <span>Mode B: Enforced Lock Mode (Recommended)</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Automatically activates trading lock when limit is breached. Blocks new trade logging until deliberate reflection & unlock.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setEditableSettings(s => ({ ...s, mode: 'warning' }))}
              className={`rounded-lg border p-3 text-left transition ${
                editableSettings.mode === 'warning'
                  ? 'border-amber-500 bg-amber-950/20 text-amber-200'
                  : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-bold text-xs flex items-center gap-1.5 text-slate-100">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                <span>Mode A: Warning Advisory Mode</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Displays prominent warnings when approaching or reaching thresholds without strictly blocking new trade logging actions.
              </p>
            </button>
          </div>
        </div>

        {/* Parameter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-semibold text-slate-300">Max Daily Net Loss ($)</label>
            <input
              type="number"
              value={editableSettings.maxDailyNetLoss}
              onChange={e => setEditableSettings(s => ({ ...s, maxDailyNetLoss: parseFloat(e.target.value) || 0 }))}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 font-mono focus:outline-none"
            />
            <span className="text-[10px] text-slate-500">Realized net loss threshold for the trading day</span>
          </div>

          <div>
            <label className="font-semibold text-slate-300">Max Daily Drawdown (%)</label>
            <input
              type="number"
              step="0.5"
              value={editableSettings.maxDailyDrawdownPercent}
              onChange={e => setEditableSettings(s => ({ ...s, maxDailyDrawdownPercent: parseFloat(e.target.value) || 0 }))}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 font-mono focus:outline-none"
            />
            <span className="text-[10px] text-slate-500">Max % decline from starting day equity</span>
          </div>

          <div>
            <label className="font-semibold text-slate-300">Max Consecutive Losses</label>
            <input
              type="number"
              value={editableSettings.maxConsecutiveLosses}
              onChange={e => setEditableSettings(s => ({ ...s, maxConsecutiveLosses: parseInt(e.target.value, 10) || 0 }))}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 font-mono focus:outline-none"
            />
            <span className="text-[10px] text-slate-500">Trips lock after N consecutive stop-outs</span>
          </div>

          <div>
            <label className="font-semibold text-slate-300">Max Trades Per Day</label>
            <input
              type="number"
              value={editableSettings.maxTradesPerDay}
              onChange={e => setEditableSettings(s => ({ ...s, maxTradesPerDay: parseInt(e.target.value, 10) || 0 }))}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 font-mono focus:outline-none"
            />
            <span className="text-[10px] text-slate-500">Volume cap to prevent overtrading</span>
          </div>

          <div>
            <label className="font-semibold text-slate-300">Gold Daily Loss Limit ($)</label>
            <input
              type="number"
              value={editableSettings.maxGoldDailyLoss}
              onChange={e => setEditableSettings(s => ({ ...s, maxGoldDailyLoss: parseFloat(e.target.value) || 0 }))}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 font-mono focus:outline-none"
            />
            <span className="text-[10px] text-slate-500">Dedicated stop loss limit for XAUUSD trades</span>
          </div>

          <div>
            <label className="font-semibold text-slate-300">Bitcoin Daily Loss Limit ($)</label>
            <input
              type="number"
              value={editableSettings.maxBtcDailyLoss}
              onChange={e => setEditableSettings(s => ({ ...s, maxBtcDailyLoss: parseFloat(e.target.value) || 0 }))}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 font-mono focus:outline-none"
            />
            <span className="text-[10px] text-slate-500">Dedicated stop loss limit for BTCUSD trades</span>
          </div>
        </div>
      </div>

      {/* Kill Switch Audit Event History */}
      <div className="rounded-xl border border-slate-800 bg-[#111C2D] overflow-hidden shadow-xs">
        <div className="border-b border-slate-800 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-bold text-slate-100">Kill Switch Event Audit Trail</h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">{events.length} historical events</span>
        </div>

        {events.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No Kill Switch trigger events recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/50 text-[10px] uppercase text-slate-400">
                <tr>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-3">Event Type</th>
                  <th className="py-2.5 px-4">Trigger Reason</th>
                  <th className="py-2.5 px-3">Measured / Limit</th>
                  <th className="py-2.5 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {events.map(ev => (
                  <tr key={ev.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 text-slate-300 font-mono text-[11px]">
                      {ev.timestamp.replace('T', ' ').substring(0, 19)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase font-mono ${
                        ev.type === 'lock' || ev.type === 'manual_lock'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : ev.type === 'unlock'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {ev.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-200">{ev.reason}</td>
                    <td className="py-2.5 px-3 text-slate-300 font-mono">
                      {ev.measuredValue !== undefined ? `$${ev.measuredValue} / $${ev.thresholdValue}` : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 text-[11px]">{ev.userNotes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
