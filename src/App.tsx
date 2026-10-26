/**
 * Learner HAMZA - Advanced Trading Journal, Risk Management & Intelligence Platform
 * Master Application Shell & State Controller (100% Offline, Fast, Zero-AI)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  db,
  initializeDatabase,
  DEFAULT_ACCOUNT,
  DEFAULT_INSTRUMENTS,
  DEFAULT_KILL_SWITCH_SETTINGS,
  DEFAULT_APP_SETTINGS,
  logAudit
} from './db/db';
import {
  Trade,
  Account,
  InstrumentConfig,
  Strategy,
  KillSwitchSettings,
  AppSettings,
  CapitalTransaction
} from './types';
import { evaluateKillSwitch } from './services/calculationEngine';

// Components
import { Header } from './components/Header';
import { Sidebar, NavPageId } from './components/Sidebar';
import { KillSwitchModal } from './components/modals/KillSwitchModal';
import { PositionCalculatorModal } from './components/modals/PositionCalculatorModal';

// Views
import { DashboardPage } from './components/views/DashboardPage';
import { TradeJournalPage } from './components/views/TradeJournalPage';
import { AddEditTradePage } from './components/views/AddEditTradePage';
import { CalendarViewPage } from './components/views/CalendarViewPage';
import { PerformanceAnalyticsPage } from './components/views/PerformanceAnalyticsPage';
import { ReportsCenterPage } from './components/views/ReportsCenterPage';
import { RiskManagementPage } from './components/views/RiskManagementPage';
import { StrategyLabPage } from './components/views/StrategyLabPage';
import { ScreenshotVaultPage } from './components/views/ScreenshotVaultPage';
import { MasterControlPage } from './components/views/MasterControlPage';
import { BackupRestorePage } from './components/views/BackupRestorePage';
import { SettingsAuditLogPage } from './components/views/SettingsAuditLogPage';

export default function App() {
  const [activePage, setActivePage] = useState<NavPageId>('dashboard');
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Core Database State
  const [account, setAccount] = useState<Account | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [instruments, setInstruments] = useState<Record<string, InstrumentConfig>>(DEFAULT_INSTRUMENTS);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [killSwitchSettings, setKillSwitchSettings] = useState<KillSwitchSettings>(DEFAULT_KILL_SWITCH_SETTINGS);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [capitalTransactions, setCapitalTransactions] = useState<CapitalTransaction[]>([]);
  const [attachmentsCount, setAttachmentsCount] = useState<number>(0);

  // Modals & Navigation Helpers
  const [isKillSwitchModalOpen, setIsKillSwitchModalOpen] = useState(false);
  const [isPositionCalcOpen, setIsPositionCalcOpen] = useState(false);
  const [tradeToEdit, setTradeToEdit] = useState<Trade | null>(null);

  // Load all data from IndexedDB
  const refreshData = useCallback(async () => {
    try {
      await initializeDatabase();

      const [
        accs,
        allTrades,
        instList,
        strats,
        ksSettingRow,
        appSettingRow,
        attCount,
        capTxs
      ] = await Promise.all([
        db.accounts.toArray(),
        db.trades.toArray(),
        db.instruments.toArray(),
        db.strategies.toArray(),
        db.settings.get('killSwitchSettings'),
        db.settings.get('appSettings'),
        db.attachments.count(),
        db.capitalTransactions.toArray()
      ]);

      if (accs.length > 0) setAccount(accs[0]);
      setTrades(allTrades);

      if (instList.length > 0) {
        const map: Record<string, InstrumentConfig> = {};
        instList.forEach(i => (map[i.symbol] = i));
        setInstruments(map);
      }

      setStrategies(strats);
      if (ksSettingRow?.value) setKillSwitchSettings(ksSettingRow.value);
      if (appSettingRow?.value) setAppSettings(appSettingRow.value);
      setAttachmentsCount(attCount);
      setCapitalTransactions(capTxs);
      setIsLoaded(true);
    } catch (err) {
      console.error('Error refreshing IndexedDB:', err);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Today's trades & Kill Switch evaluation
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const todayClosedTrades = useMemo(() => {
    return trades.filter(t => t.status === 'Closed' && t.tradeDate === todayStr && !t.isDraft);
  }, [trades, todayStr]);

  const todayOpenTrades = useMemo(() => {
    return trades.filter(t => t.status === 'Open' && !t.isDraft);
  }, [trades]);

  const killSwitchEval = useMemo(() => {
    return evaluateKillSwitch(
      todayClosedTrades,
      todayOpenTrades,
      trades.filter(t => t.status === 'Closed'),
      account || DEFAULT_ACCOUNT,
      killSwitchSettings,
      account?.startingCapital || 10000
    );
  }, [todayClosedTrades, todayOpenTrades, trades, account, killSwitchSettings]);

  // Consecutive losses calculation (to trigger 2-3 loss blinking reminder)
  const consecutiveLosses = useMemo(() => {
    const closed = [...trades]
      .filter(t => t.status === 'Closed' && !t.isDraft)
      .sort((a, b) => new Date(b.exitTime || b.tradeDate).getTime() - new Date(a.exitTime || a.tradeDate).getTime());

    let count = 0;
    for (const t of closed) {
      const net = t.netPnL || 0;
      if (net < 0) {
        count++;
      } else if (net > 0) {
        break;
      }
    }
    return count;
  }, [trades]);

  const isLocked = killSwitchSettings.emergencyLockActive || (killSwitchSettings.mode === 'lock' && killSwitchEval.isTriggered);

  // Recommended Lots
  const recommendedGoldLot = instruments['XAUUSD']?.fixedRecommendedLot ?? 0.10;
  const recommendedBtcQty = instruments['BTCUSD']?.fixedRecommendedLot ?? 0.05;

  // Automatic Midnight (12:00 AM local time) Kill Switch Unlock
  useEffect(() => {
    if (!killSwitchSettings.emergencyLockActive) return;

    const checkMidnightUnlock = async () => {
      const now = new Date();
      // Target midnight: 00:00:00 local time of the day following emergencyLockTimestamp (or today)
      const lockDate = killSwitchSettings.emergencyLockTimestamp
        ? new Date(killSwitchSettings.emergencyLockTimestamp)
        : new Date();

      const targetMidnight = new Date(
        lockDate.getFullYear(),
        lockDate.getMonth(),
        lockDate.getDate() + 1,
        0, 0, 0, 0
      );

      // If local time has reached or passed 12:00 AM midnight
      if (now.getTime() >= targetMidnight.getTime()) {
        const updated: KillSwitchSettings = {
          ...killSwitchSettings,
          emergencyLockActive: false,
          emergencyLockReason: undefined,
          emergencyLockTimestamp: undefined
        };
        setKillSwitchSettings(updated);
        await db.settings.put({ key: 'killSwitchSettings', value: updated });
        await logAudit(
          'kill_switch',
          'MIDNIGHT_AUTO_UNLOCK',
          'Automatic 12:00 AM Midnight reset: Kill Switch lockout automatically disengaged.'
        );
        refreshData();
      }
    };

    checkMidnightUnlock();
    const interval = setInterval(checkMidnightUnlock, 1000);
    return () => clearInterval(interval);
  }, [killSwitchSettings, refreshData]);

  // Single Power Button Kill Switch Toggle (Press & Hold to Lock)
  const handleToggleEmergencyLock = async () => {
    if (killSwitchSettings.emergencyLockActive) {
      alert('Workstation is locked until 12:00 AM Midnight.');
      return;
    }
    const updated: KillSwitchSettings = {
      ...killSwitchSettings,
      emergencyLockActive: true,
      emergencyLockReason: 'Manual Kill Switch Power Off',
      emergencyLockTimestamp: new Date().toISOString()
    };
    setKillSwitchSettings(updated);
    await db.settings.put({ key: 'killSwitchSettings', value: updated });
    await logAudit(
      'kill_switch',
      'POWER_LOCK_ENGAGED',
      'Trader engaged hardware Kill Switch power lock.'
    );
    refreshData();
  };

  // Sizing to Trade form bridge
  const handleApplySizingToTrade = (params: any) => {
    setTradeToEdit({
      id: `TRD-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      accountId: account?.id || 'acc_primary',
      asset: params.asset,
      instrumentSymbol: params.asset,
      direction: params.direction,
      status: 'Closed',
      session: 'London',
      tradeDate: new Date().toISOString().split('T')[0],
      entryTime: new Date().toISOString(),
      timezone: 'UTC',
      entryPrice: params.entryPrice,
      stopLossPrice: params.stopLossPrice,
      takeProfitPrice: params.takeProfitPrice,
      positionSize: params.positionSize,
      contractSize: params.asset.includes('XAU') ? 100 : 1,
      entryFees: 2.5,
      exitFees: 2.5,
      swapFundingFees: 0,
      slippage: 0,
      otherCosts: 0,
      plannedRiskAmount: params.plannedRiskAmount,
      plannedRiskPercent: 1.0,
      ruleFollowed: true,
      entryReason: 'Applied from Position Size Sizer',
      confidenceRating: 4,
      attachments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    setActivePage('add_trade');
  };

  // Seed sample demonstration data
  const handleSeedSampleTrades = async () => {
    const sampleTrades: Trade[] = [
      {
        id: 'TRD-20261018-8421',
        accountId: 'acc_primary',
        asset: 'XAUUSD',
        instrumentSymbol: 'XAUUSD',
        direction: 'LONG',
        status: 'Closed',
        session: 'London',
        strategyId: strategies[0]?.id || 'strat_fvg_sweep',
        tradeDate: '2026-10-18',
        entryTime: '2026-10-18T08:15:00Z',
        exitTime: '2026-10-18T10:45:00Z',
        timezone: 'UTC',
        entryPrice: 2650.0,
        exitPrice: 2670.0,
        stopLossPrice: 2640.0,
        takeProfitPrice: 2675.0,
        positionSize: 0.10,
        contractSize: 100,
        entryFees: 2.5,
        exitFees: 2.5,
        swapFundingFees: 0,
        slippage: 0.5,
        otherCosts: 0,
        plannedRiskAmount: 100,
        plannedRiskPercent: 1.0,
        plannedRewardAmount: 250,
        plannedRR: 2.5,
        grossPnL: 200.0,
        netPnL: 194.5,
        actualR: 1.95,
        ruleFollowed: true,
        entryReason: 'Asian low swept followed by 15m bullish displacement and FVG retest.',
        exitReason: 'Targeted London session high liquidity pool.',
        confidenceRating: 5,
        qualityRating: 5,
        lessonsLearned: 'Patience on the discount fill yielded high reward-to-risk.',
        attachments: [],
        createdAt: '2026-10-18T08:15:00Z',
        updatedAt: '2026-10-18T10:45:00Z'
      },
      {
        id: 'TRD-20261019-3109',
        accountId: 'acc_primary',
        asset: 'BTCUSD',
        instrumentSymbol: 'BTCUSD',
        direction: 'SHORT',
        status: 'Closed',
        session: 'New York',
        strategyId: strategies[1]?.id || 'strat_london_breakout',
        tradeDate: '2026-10-19',
        entryTime: '2026-10-19T14:30:00Z',
        exitTime: '2026-10-19T16:10:00Z',
        timezone: 'UTC',
        entryPrice: 68500.0,
        exitPrice: 67200.0,
        stopLossPrice: 69200.0,
        takeProfitPrice: 66800.0,
        positionSize: 0.05,
        contractSize: 1,
        entryFees: 2.5,
        exitFees: 2.5,
        swapFundingFees: 0,
        slippage: 1.0,
        otherCosts: 0,
        plannedRiskAmount: 35,
        plannedRiskPercent: 0.35,
        grossPnL: 65.0,
        netPnL: 59.0,
        actualR: 1.69,
        ruleFollowed: true,
        entryReason: 'New York open rejection of 4H resistance zone.',
        exitReason: 'Took profit at previous day low.',
        confidenceRating: 4,
        qualityRating: 4,
        attachments: [],
        createdAt: '2026-10-19T14:30:00Z',
        updatedAt: '2026-10-19T16:10:00Z'
      }
    ];

    await db.trades.bulkPut(sampleTrades);
    await logAudit('system', 'SAMPLE_DATA_LOADED', 'Loaded sample Gold and Bitcoin trade records.');
    refreshData();
  };

  const netCapitalAdjustments = useMemo(() => {
    return capitalTransactions.reduce((acc, tx) => {
      if (tx.type === 'deposit') return acc + tx.amount;
      if (tx.type === 'withdrawal') return acc - tx.amount;
      return acc;
    }, 0);
  }, [capitalTransactions]);

  const netRealizedPnL = useMemo(() => {
    return trades
      .filter(t => t.status === 'Closed' && !t.isDraft)
      .reduce((sum, t) => sum + (t.netPnL || 0), 0);
  }, [trades]);

  const todayNetPnL = useMemo(() => {
    return todayClosedTrades.reduce((sum, t) => sum + (t.netPnL || 0), 0);
  }, [todayClosedTrades]);

  const currentEquity = (account?.startingCapital || 10000) + netCapitalAdjustments + netRealizedPnL;

  const getPageTitle = (page: NavPageId): string => {
    switch (page) {
      case 'dashboard': return 'Journal Dashboard';
      case 'journal': return 'Trade Journal';
      case 'add_trade': return tradeToEdit ? 'Edit Trade' : 'Fast Trade Entry';
      case 'calendar': return 'Monthly Calendar & Tracker';
      case 'analytics': return 'Performance Analytics';
      case 'reports': return 'Reports Center';
      case 'risk': return 'Risk Management Workstation';
      case 'strategy': return 'Strategy Lab';
      case 'screenshots': return 'Screenshot Vault';
      case 'master_control': return 'Master Control';
      case 'backup': return 'Data Backup & Restore';
      case 'settings': return 'Activity & Audit Log';
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#080D16] text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <div className="font-mono text-xs uppercase tracking-wider text-slate-300">
            Initializing Learner HAMZA Terminal...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#080D16] text-[#F1F5F9] font-sans antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        activePage={activePage}
        onSelectPage={page => {
          if (page === 'add_trade') setTradeToEdit(null);
          setActivePage(page);
        }}
        isOpenMobile={isSidebarOpenMobile}
        onCloseMobile={() => setIsSidebarOpenMobile(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-x-hidden min-w-0">
        <Header
          account={account}
          currentEquity={currentEquity}
          todayNetPnL={todayNetPnL}
          dailyLossLimit={killSwitchEval.dailyLossLimit}
          dailyLossConsumed={killSwitchEval.dailyLossConsumed}
          remainingDailyLoss={killSwitchEval.dailyLossRemaining}
          killSwitchSettings={killSwitchSettings}
          isTriggered={killSwitchEval.isTriggered}
          warningPercent={killSwitchEval.warningPercent}
          consecutiveLosses={consecutiveLosses}
          onToggleEmergencyLock={handleToggleEmergencyLock}
          onOpenKillSwitchModal={() => setIsKillSwitchModalOpen(true)}
          onOpenPositionCalc={() => setIsPositionCalcOpen(true)}
          onToggleSidebar={() => setIsSidebarOpenMobile(prev => !prev)}
          onNavigateToMasterControl={() => setActivePage('master_control')}
          activePageTitle={getPageTitle(activePage)}
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {/* Empty State Banner (If 0 trades in DB) */}
          {trades.length === 0 && activePage === 'dashboard' && (
            <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-950/20 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Welcome to Learner HAMZA Trading Terminal</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Capital is set to ${(account?.startingCapital || 10000).toLocaleString()}. Recommended Gold Lot: {recommendedGoldLot} | BTC: {recommendedBtcQty}.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSeedSampleTrades}
                  className="rounded-lg border border-blue-500/40 bg-blue-600/20 px-3.5 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-600/30 transition"
                >
                  Load 2 Sample Trades
                </button>
                <button
                  onClick={() => setActivePage('add_trade')}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-500 transition shadow-md shadow-blue-600/20"
                >
                  Fast Trade Entry
                </button>
              </div>
            </div>
          )}

          {/* Active View Router */}
          {activePage === 'dashboard' && (
            <DashboardPage
              trades={trades}
              account={account}
              killSwitchSettings={killSwitchSettings}
              isLocked={isLocked}
              warningPercent={killSwitchEval.warningPercent}
              remainingDailyLoss={killSwitchEval.dailyLossRemaining}
              onNavigate={page => setActivePage(page)}
              onOpenTradeDetail={trade => {
                setTradeToEdit(trade);
                setActivePage('journal');
              }}
            />
          )}

          {activePage === 'journal' && (
            <TradeJournalPage
              trades={trades}
              strategies={strategies}
              instruments={instruments}
              onNavigateAddTrade={() => {
                setTradeToEdit(null);
                setActivePage('add_trade');
              }}
              onEditTrade={trade => {
                setTradeToEdit(trade);
                setActivePage('add_trade');
              }}
              onRefreshData={refreshData}
            />
          )}

          {activePage === 'add_trade' && (
            <AddEditTradePage
              tradeToEdit={tradeToEdit}
              instruments={instruments}
              strategies={strategies}
              killSwitchSettings={killSwitchSettings}
              isLocked={isLocked}
              currentEquity={currentEquity}
              onTradeSaved={() => {
                setTradeToEdit(null);
                refreshData();
                setActivePage('journal');
              }}
              onCancel={() => {
                setTradeToEdit(null);
                setActivePage('journal');
              }}
            />
          )}

          {activePage === 'calendar' && (
            <CalendarViewPage
              trades={trades}
              killSwitchSettings={killSwitchSettings}
              account={account}
              dailyLossConsumed={killSwitchEval.dailyLossConsumed}
              dailyLossLimit={killSwitchEval.dailyLossLimit}
              remainingDailyLoss={killSwitchEval.dailyLossRemaining}
              onSelectTrade={trade => {
                setTradeToEdit(trade);
                setActivePage('journal');
              }}
            />
          )}

          {activePage === 'analytics' && (
            <PerformanceAnalyticsPage
              trades={trades}
              account={account}
              strategies={strategies}
              onEditTrade={trade => {
                setTradeToEdit(trade);
                setActivePage('add_trade');
              }}
            />
          )}

          {activePage === 'reports' && (
            <ReportsCenterPage
              trades={trades}
              account={account}
              strategies={strategies}
              killSwitchSettings={killSwitchSettings}
              onEditTrade={trade => {
                setTradeToEdit(trade);
                setActivePage('add_trade');
              }}
              onRefreshData={refreshData}
            />
          )}

          {activePage === 'risk' && (
            <RiskManagementPage
              settings={killSwitchSettings}
              account={account}
              todayClosedTrades={todayClosedTrades}
              allTrades={trades}
              isLocked={isLocked}
              warningPercent={killSwitchEval.warningPercent}
              dailyLossConsumed={killSwitchEval.dailyLossConsumed}
              dailyLossLimit={killSwitchEval.dailyLossLimit}
              remainingDailyLoss={killSwitchEval.dailyLossRemaining}
              onUpdateSettings={newSettings => {
                setKillSwitchSettings(newSettings);
                refreshData();
              }}
              onOpenLockModal={() => setIsKillSwitchModalOpen(true)}
            />
          )}

          {activePage === 'strategy' && (
            <StrategyLabPage
              strategies={strategies}
              trades={trades}
              onRefreshData={refreshData}
            />
          )}

          {activePage === 'screenshots' && (
            <ScreenshotVaultPage
              trades={trades}
              onOpenTrade={trade => {
                setTradeToEdit(trade);
                setActivePage('journal');
              }}
              onRefreshData={refreshData}
            />
          )}

          {activePage === 'master_control' && (
            <MasterControlPage
              account={account}
              instruments={instruments}
              killSwitchSettings={killSwitchSettings}
              appSettings={appSettings}
              tradesCount={trades.length}
              attachmentsCount={attachmentsCount}
              onRefreshData={refreshData}
            />
          )}

          {activePage === 'backup' && (
            <BackupRestorePage
              tradesCount={trades.length}
              attachmentsCount={attachmentsCount}
              lastBackupTimestamp={appSettings.lastBackupTimestamp}
              onRefreshData={refreshData}
            />
          )}

          {activePage === 'settings' && (
            <SettingsAuditLogPage
              appSettings={appSettings}
              killSwitchSettings={killSwitchSettings}
              onRefreshData={refreshData}
            />
          )}
        </main>
      </div>

      {/* Global Modals */}
      <KillSwitchModal
        isOpen={isKillSwitchModalOpen}
        onClose={() => setIsKillSwitchModalOpen(false)}
        settings={killSwitchSettings}
        dailyLossConsumed={killSwitchEval.dailyLossConsumed}
        dailyLossLimit={killSwitchEval.dailyLossLimit}
        isTriggered={killSwitchEval.isTriggered}
        warningPercent={killSwitchEval.warningPercent}
        onSettingsUpdated={newSettings => {
          setKillSwitchSettings(newSettings);
          refreshData();
        }}
      />

      <PositionCalculatorModal
        isOpen={isPositionCalcOpen}
        onClose={() => setIsPositionCalcOpen(false)}
        instruments={instruments}
        currentEquity={currentEquity}
        killSwitchSettings={killSwitchSettings}
        remainingDailyLoss={killSwitchEval.dailyLossRemaining}
        onApplyToTrade={handleApplySizingToTrade}
      />
    </div>
  );
}
