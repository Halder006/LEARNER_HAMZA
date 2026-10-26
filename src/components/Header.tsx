/**
 * Learner HAMZA - Terminal Header Component
 * Big Circle Button Kill Switch (Press & Hold to Enable/Disable)
 * and Live Capital (+/- Realized Profit & Loss) with Auto-Adjusting Lots.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Power,
  Calculator,
  Lock,
  Database,
  Menu,
  AlertTriangle,
  Flame,
  ShieldCheck,
  ShieldOff
} from 'lucide-react';
import { Account, KillSwitchSettings } from '../types';

interface HeaderProps {
  account: Account | null;
  currentEquity: number;
  todayNetPnL: number;
  dailyLossLimit: number;
  dailyLossConsumed: number;
  remainingDailyLoss: number;
  killSwitchSettings: KillSwitchSettings;
  isTriggered: boolean;
  warningPercent: number;
  consecutiveLosses: number;
  onToggleEmergencyLock: () => void;
  onOpenKillSwitchModal: () => void;
  onOpenPositionCalc: () => void;
  onToggleSidebar?: () => void;
  onNavigateToMasterControl?: () => void;
  activePageTitle: string;
}

export const Header: React.FC<HeaderProps> = ({
  account,
  currentEquity,
  todayNetPnL,
  dailyLossLimit,
  dailyLossConsumed,
  remainingDailyLoss,
  killSwitchSettings,
  isTriggered,
  warningPercent,
  consecutiveLosses,
  onToggleEmergencyLock,
  onOpenKillSwitchModal,
  onOpenPositionCalc,
  onToggleSidebar,
  activePageTitle
}) => {
  const [localTimeStr, setLocalTimeStr] = useState<string>('');
  const [localDateDayStr, setLocalDateDayStr] = useState<string>('');
  const [countdownToMidnight, setCountdownToMidnight] = useState<string>('00:00:00');

  // Press-and-hold state for the Big Circle Button
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const holdIntervalRef = useRef<any>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Only local time, date, and day (UTC removed per user request)
      setLocalTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setLocalDateDayStr(now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }));

      // Calculate exact countdown to next 12:00 AM Midnight (00:00:00 local time)
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
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isEnabled = killSwitchSettings.isEnabled !== false;
  const isLocked = isEnabled && (killSwitchSettings.emergencyLockActive || (killSwitchSettings.mode === 'lock' && isTriggered));
  const hasStreakWarning = isEnabled && consecutiveLosses >= 2;
  const isHighRiskWarning = isEnabled && warningPercent >= 75 && !isLocked;

  // Press and hold logic: ENABLE ONLY from here.
  const startHold = () => {
    if (!isEnabled) return;
    if (isLocked) {
      alert('⚠️ Kill Switch is currently LOCKED until 12:00 AM Midnight.');
      return;
    }
    setIsHolding(true);
    setHoldProgress(0);
    const stepMs = 40;
    const totalMs = 1100; // 1.1s hold to lock
    const stepPct = (stepMs / totalMs) * 100;

    holdIntervalRef.current = setInterval(() => {
      setHoldProgress(prev => {
        if (prev + stepPct >= 100) {
          clearInterval(holdIntervalRef.current);
          setIsHolding(false);
          setHoldProgress(0);
          onToggleEmergencyLock(); // Engages emergency lockout
          return 0;
        }
        return prev + stepPct;
      });
    }, stepMs);
  };

  const cancelHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setIsHolding(false);
    setHoldProgress(0);
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-800 bg-[#0C1422]/95 px-4 backdrop-blur-md">
        {/* Left: Mobile Toggle & Page Title with Local Date/Day/Time */}
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="md:hidden rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <span>{activePageTitle}</span>
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
              <span className="text-slate-300 font-medium">{localDateDayStr}</span>
              <span className="text-slate-600">•</span>
              <span className="text-blue-400 font-bold">{localTimeStr}</span>
            </div>
          </div>
        </div>

        {/* Center: Live Capital (+/- Today's P&L) & Today's Daily Loss Limit Remaining */}
        <div className="hidden md:flex items-center gap-4 rounded-xl border border-slate-800 bg-[#111C2D]/90 px-4 py-1.5 shadow-xs">
          {/* Live Dynamic Capital with Today's PnL */}
          <div className="text-left">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Active Capital (Live)
            </div>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-sm font-extrabold text-slate-100">
                ${currentEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span
                className={`text-[11px] font-bold ${
                  todayNetPnL > 0
                    ? 'text-emerald-400'
                    : todayNetPnL < 0
                    ? 'text-rose-400'
                    : 'text-slate-400'
                }`}
                title="Today's Realized Profit / Loss"
              >
                ({todayNetPnL >= 0 ? '+' : ''}${todayNetPnL.toFixed(2)} today)
              </span>
            </div>
          </div>

          <div className="h-7 w-px bg-slate-800" />

          {/* Today's Daily Loss Remaining (e.g. $20 left out of $40 limit) */}
          <div className="text-left">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Daily Loss Remaining
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Limit: ${dailyLossLimit.toFixed(0)}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span
                className={`text-sm font-extrabold ${
                  remainingDailyLoss <= 0
                    ? 'text-rose-400 animate-pulse'
                    : remainingDailyLoss <= dailyLossLimit * 0.25
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                ${remainingDailyLoss.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                {dailyLossConsumed > 0 ? `(-$${dailyLossConsumed.toFixed(0)} lost today)` : 'remaining'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Position Sizer & Big Circle Kill Switch Button */}
        <div className="flex items-center gap-3">
          {/* Position Sizer Quick Button */}
          <button
            onClick={onOpenPositionCalc}
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 transition"
            title="Open Capital-Aware Position Size Calculator"
          >
            <Calculator className="h-3.5 w-3.5" />
            <span>Position Sizer</span>
          </button>

          {/* BIG CIRCLE BUTTON KILL SWITCH */}
          <div className="relative flex items-center gap-2">
            <button
              onMouseDown={startHold}
              onMouseUp={cancelHold}
              onMouseLeave={cancelHold}
              onTouchStart={startHold}
              onTouchEnd={cancelHold}
              onClick={() => {
                if (!isEnabled) {
                  alert('Kill Switch is currently disabled in Master Control.');
                  return;
                }
                if (isLocked) {
                  alert(`Workstation is locked until 12:00 AM Midnight (${countdownToMidnight} remaining).`);
                }
              }}
              className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all shadow-xl select-none group cursor-pointer ${
                !isEnabled
                  ? 'border-slate-700 bg-slate-900 text-slate-500 opacity-60 cursor-not-allowed'
                  : isLocked
                  ? 'border-red-500 bg-red-600/30 text-red-300 animate-pulse shadow-red-500/40 ring-4 ring-red-500/30'
                  : hasStreakWarning || isHighRiskWarning
                  ? 'border-amber-400 bg-amber-500/30 text-amber-300 shadow-amber-500/40 ring-4 ring-amber-400/30 animate-bounce'
                  : 'border-emerald-500/80 bg-emerald-950/40 text-emerald-400 hover:border-emerald-400 hover:shadow-emerald-500/30 ring-2 ring-emerald-500/20'
              }`}
              title={
                !isEnabled
                  ? 'Kill Switch Disabled'
                  : isLocked
                  ? `Workstation Locked (Auto-unlock at 12:00 AM Midnight • ${countdownToMidnight} remaining)`
                  : 'Kill Switch: Press & hold 1s to Power Off / Lock'
              }
            >
              {/* SVG Circular Hold Progress Bar */}
              {isHolding && isEnabled && !isLocked && (
                <svg className="absolute inset-0 h-12 w-12 -rotate-90 pointer-events-none">
                  <circle
                    cx="24"
                    cy="24"
                    r="21"
                    stroke="#EF4444"
                    strokeWidth="3.5"
                    fill="none"
                    strokeDasharray="132"
                    strokeDashoffset={132 - (132 * holdProgress) / 100}
                    strokeLinecap="round"
                  />
                </svg>
              )}

              {/* Power Icon */}
              {!isEnabled ? (
                <ShieldOff className="h-5 w-5 text-slate-500" />
              ) : isLocked ? (
                <Lock className="h-5 w-5 text-red-400 animate-pulse" />
              ) : (
                <Power className={`h-5 w-5 transition-transform ${isHolding ? 'scale-125' : 'group-hover:scale-110'} ${
                  hasStreakWarning ? 'text-amber-300' : 'text-emerald-400'
                }`} />
              )}
            </button>

            {/* Hold progress text or status chip */}
            <div className="hidden lg:flex flex-col text-left leading-tight">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                {!isEnabled
                  ? 'Kill Switch Off'
                  : isLocked
                  ? 'Lock Active'
                  : hasStreakWarning
                  ? 'Tilt Warning'
                  : 'Kill Switch'}
              </span>
              <span className="text-[9px] font-mono text-slate-500">
                {isHolding ? `HOLD ${Math.round(holdProgress)}%` : isLocked ? countdownToMidnight : 'Hold 1s Lock'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Tilt Warning Banner when 2-3 Losses Occur */}
      {(hasStreakWarning || isHighRiskWarning) && isEnabled && !isLocked && (
        <div className="bg-amber-500 text-black px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md animate-pulse">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4" />
            <span>
              {hasStreakWarning
                ? `⚠️ Tilt Reminder: ${consecutiveLosses} CONSECUTIVE LOSSES DETECTED! Take a 15-minute break before risking more capital.`
                : `⚠️ Risk Limit Alert: Daily loss consumed is at ${warningPercent.toFixed(0)}%! Remaining allowance: $${remainingDailyLoss.toFixed(2)}.`}
            </span>
          </div>
          <button
            onClick={onToggleEmergencyLock}
            className="rounded bg-black px-2.5 py-1 text-[11px] text-white font-mono hover:bg-slate-900 transition"
          >
            Lock Out Now (Power Off)
          </button>
        </div>
      )}

      {isLocked && isEnabled && (
        <div className="bg-red-600 text-white px-4 py-2.5 text-xs font-bold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 animate-pulse shrink-0" />
            <span>TRADING ACTIONS LOCKED • Workstation locked until 12:00 AM Midnight</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] bg-black/40 px-3 py-1 rounded-lg border border-white/20 shrink-0">
            <span className="text-slate-300">Auto-unlock in:</span>
            <span className="text-amber-300 font-bold">{countdownToMidnight}</span>
          </div>
        </div>
      )}
    </>
  );
};
