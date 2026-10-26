/**
 * Learner HAMZA - Kill Switch Management & Emergency Lock Modal
 * Critical safety barrier preventing unauthorized entries during tilt or threshold breaches
 */

import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Lock, Unlock, AlertTriangle, Clock, FileText } from 'lucide-react';
import { KillSwitchSettings, KillSwitchEvent } from '../../types';
import { db, logAudit } from '../../db/db';

interface KillSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: KillSwitchSettings;
  dailyLossConsumed: number;
  dailyLossLimit: number;
  isTriggered: boolean;
  warningPercent: number;
  onSettingsUpdated: (newSettings: KillSwitchSettings) => void;
}

export const KillSwitchModal: React.FC<KillSwitchModalProps> = ({
  isOpen,
  onClose,
  settings,
  dailyLossConsumed,
  dailyLossLimit,
  isTriggered,
  warningPercent,
  onSettingsUpdated
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdownToMidnight, setCountdownToMidnight] = useState<string>('00:00:00');

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const targetMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
      const diffMs = Math.max(0, targetMidnight.getTime() - now.getTime());
      const totalSec = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      setCountdownToMidnight(
        `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      );
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isOpen) return null;

  const isLocked = settings.emergencyLockActive || (settings.mode === 'lock' && isTriggered);

  const handleManualLock = async () => {
    setIsSubmitting(true);
    try {
      const lockReason = reason.trim() || 'Manual emergency lock initiated by trader';
      const timestamp = new Date().toISOString();

      const updatedSettings: KillSwitchSettings = {
        ...settings,
        emergencyLockActive: true,
        emergencyLockReason: lockReason,
        emergencyLockTimestamp: timestamp
      };

      await db.settings.put({ key: 'killSwitchSettings', value: updatedSettings });

      const event: KillSwitchEvent = {
        id: `ks_event_${Date.now()}`,
        type: 'manual_lock',
        reason: lockReason,
        measuredValue: dailyLossConsumed,
        thresholdValue: dailyLossLimit,
        timestamp,
        userNotes: reason
      };
      await db.killSwitchEvents.add(event);
      await logAudit('kill_switch', 'EMERGENCY_LOCK_ENGAGED', `Trader engaged manual lock: ${lockReason}`);

      onSettingsUpdated(updatedSettings);
      setReason('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const remainingDaily = Math.max(0, dailyLossLimit - dailyLossConsumed);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Top Header Banner */}
        <div className={`p-4 border-b ${isLocked ? 'bg-red-950/50 border-red-800/60' : 'bg-slate-950/60 border-slate-800'} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2.5 ${isLocked ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-amber-500/20 text-amber-400'}`}>
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">Learner HAMZA Kill Switch</h2>
                <span className={`rounded px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                  isLocked ? 'bg-red-500/30 text-red-300 border border-red-500/50' : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {isLocked ? 'LOCK ENGAGED' : 'SYSTEM ARMED'}
                </span>
              </div>
              <p className="text-xs text-slate-400">Capital Protection & Enforced Trading Lock Engine</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Daily Loss Gauge Bar */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium">Daily Net Loss Allowance</span>
              <span className="font-mono text-slate-200">
                ${dailyLossConsumed.toFixed(2)} / ${dailyLossLimit.toFixed(2)}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden relative">
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

            <div className="flex justify-between text-[11px] text-slate-400 pt-1">
              <span>Consumed: <strong className={warningPercent >= 75 ? 'text-amber-400' : 'text-slate-300'}>{warningPercent.toFixed(1)}%</strong></span>
              <span>Remaining: <strong className="text-emerald-400 font-mono">${remainingDaily.toFixed(2)}</strong></span>
            </div>
          </div>

          {/* Operating Mode Status */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-slate-800 bg-slate-800/30 p-3">
              <div className="text-slate-400">Operating Mode</div>
              <div className="font-bold text-slate-200 mt-1 uppercase tracking-wide">
                {settings.mode === 'lock' ? 'Enforced Lock Mode' : 'Warning Advisory Mode'}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-800/30 p-3">
              <div className="text-slate-400">Max Consecutive Losses</div>
              <div className="font-bold text-slate-200 mt-1 font-mono">
                {settings.maxConsecutiveLosses} in a row
              </div>
            </div>
          </div>

          {/* Action Area: Lock Status vs Lock Trigger */}
          {isLocked ? (
            <div className="rounded-lg border border-red-500/40 bg-red-950/20 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-300 text-sm font-bold">
                  <Lock className="h-5 w-5 animate-pulse text-red-400" />
                  <span>Workstation Trading Lock Active</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs bg-black/60 px-2.5 py-1 rounded border border-red-500/30 text-amber-300">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Auto-unlock in {countdownToMidnight}</span>
                </div>
              </div>

              <div className="text-xs text-slate-300">
                Lock Reason: <strong className="text-red-300">{settings.emergencyLockReason || 'Configured risk threshold exceeded.'}</strong>
              </div>

              <div className="rounded-lg bg-black/40 border border-slate-800 p-3 text-[11px] text-slate-300 leading-relaxed">
                Trading submissions and new position entries are locked to safeguard your equity and eliminate emotional trading. The terminal will automatically reset and unlock at <strong>12:00 AM Midnight (00:00:00 local time)</strong>.
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
              >
                <span>Close</span>
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                <AlertTriangle className="h-4 w-4" />
                <span>Manual Emergency Lock</span>
              </div>
              <p className="text-xs text-slate-400">
                Feeling emotional, noticing FOMO, or high slippage in Gold/Bitcoin? Immediately lock new trade submissions to prevent emotional revenge trades.
              </p>

              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Optional reason: e.g. Revenge trading urge, high volatility spike..."
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-red-500 focus:outline-none"
              />

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleManualLock}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-600/30 hover:bg-red-500 disabled:opacity-40 transition"
              >
                <Lock className="h-4 w-4" />
                <span>Engage Emergency Lock Now</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="bg-slate-950 border-t border-slate-800 px-6 py-3 flex items-center justify-between text-[11px] text-slate-500">
          <span>Learner HAMZA Risk Engine v1.0</span>
          <span>Open trades can still be exited and documented</span>
        </div>
      </div>
    </div>
  );
};
