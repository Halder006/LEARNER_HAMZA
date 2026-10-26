/**
 * Learner HAMZA - Local-First IndexedDB Repository (Dexie)
 * Complete offline persistence, atomic transactions and audit logging
 */

import Dexie, { type EntityTable } from 'dexie';
import {
  Trade,
  Account,
  CapitalTransaction,
  InstrumentConfig,
  Strategy,
  KillSwitchSettings,
  KillSwitchEvent,
  AuditLogEntry,
  AppSettings,
  TradeAttachment
} from '../types';

export class LearnerHamzaDatabase extends Dexie {
  trades!: EntityTable<Trade, 'id'>;
  accounts!: EntityTable<Account, 'id'>;
  capitalTransactions!: EntityTable<CapitalTransaction, 'id'>;
  instruments!: EntityTable<InstrumentConfig, 'symbol'>;
  strategies!: EntityTable<Strategy, 'id'>;
  killSwitchEvents!: EntityTable<KillSwitchEvent, 'id'>;
  auditLogs!: EntityTable<AuditLogEntry, 'id'>;
  attachments!: EntityTable<TradeAttachment, 'id'>;
  settings!: EntityTable<{ key: string; value: any }, 'key'>;

  constructor() {
    super('LearnerHamzaDB');

    // Schema version 1
    this.version(1).stores({
      trades: 'id, accountId, asset, strategyId, status, direction, tradeDate, entryTime, exitTime, netPnL, ruleFollowed',
      accounts: 'id, name',
      capitalTransactions: 'id, accountId, type, date',
      instruments: 'symbol, name',
      strategies: 'id, name, isActive, isArchived',
      killSwitchEvents: 'id, type, timestamp',
      auditLogs: 'id, timestamp, category',
      attachments: 'id, tradeId, type',
      settings: 'key'
    });
  }
}

export const db = new LearnerHamzaDatabase();

// Default Seeds
export const DEFAULT_ACCOUNT: Account = {
  id: 'acc_primary',
  name: 'Primary Trading Account',
  currency: 'USD',
  startingCapital: 10000,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const DEFAULT_INSTRUMENTS: Record<string, InstrumentConfig> = {
  XAUUSD: {
    symbol: 'XAUUSD',
    name: 'Gold vs US Dollar (Spot/CFD)',
    type: 'cfd',
    quoteCurrency: 'USD',
    accountCurrency: 'USD',
    contractSize: 100, // 1 standard lot = 100 Troy oz
    minLot: 0.01,
    maxLot: 50.0,
    lotStep: 0.01,
    tickSize: 0.01,
    tickValue: 1.0,
    pipSize: 0.1,
    defaultCommission: 5.0, // $5/lot round turn
    spreadEstimate: 0.20,
    slippageEstimate: 0.05,
    swapCostPerDay: -3.5,
    defaultRiskPercent: 1.0,
    fixedRecommendedLot: 0.10,
    maxRiskPerTrade: 2.0,
    maxDailyLoss: 500,
    maxOpenPositions: 2,
    maxSimultaneousRiskPercent: 3.0,
    permittedSessions: ['London', 'New York', 'London/NY Overlap']
  },
  BTCUSD: {
    symbol: 'BTCUSD',
    name: 'Bitcoin vs US Dollar (Spot/Perp)',
    type: 'spot',
    quoteCurrency: 'USD',
    accountCurrency: 'USD',
    contractSize: 1, // 1 unit = 1 BTC
    minLot: 0.01,
    maxLot: 10.0,
    lotStep: 0.01,
    tickSize: 0.5,
    tickValue: 0.5,
    pipSize: 1.0,
    defaultCommission: 10.0,
    spreadEstimate: 5.0,
    slippageEstimate: 2.0,
    swapCostPerDay: -0.01,
    defaultRiskPercent: 1.0,
    fixedRecommendedLot: 0.05,
    maxRiskPerTrade: 2.0,
    maxDailyLoss: 500,
    maxOpenPositions: 2,
    maxSimultaneousRiskPercent: 3.0,
    permittedSessions: ['Asian', 'London', 'New York', 'London/NY Overlap']
  }
};

export const DEFAULT_STRATEGIES: Strategy[] = [
  {
    id: 'strat_fvg_sweep',
    name: 'Liquidity Sweep & Order Block',
    description: 'Entry after Asian/London session liquidity sweep into higher-timeframe Fair Value Gap or Order Block.',
    entryRules: '1. Sweep of key swing high/low\n2. Rapid displacement leaving FVG\n3. Limit order at 50% discount of FVG\n4. Stop loss beyond the sweep candle wick',
    exitRules: 'Target opposite swing pool or minimum 2.5R. Trail stop to break-even after 1.5R.',
    allowedAssets: ['XAUUSD', 'BTCUSD'],
    allowedDirections: ['LONG', 'SHORT'],
    maxRiskPercent: 1.5,
    targetRR: 2.5,
    checklistItems: [
      'HTF key level identified',
      'Liquidity swept on 15m/1h',
      'Displacement candle confirmed',
      'Stop loss defined behind invalidation wick',
      'Risk is strictly <= 1.5%',
      'No high-impact red-folder news within 15 mins'
    ],
    isActive: true,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'strat_london_breakout',
    name: 'London Open Expansion',
    description: 'Trading the momentum continuation or false breakout of the Asian session range between 07:00 and 09:30 UTC.',
    entryRules: 'Wait for Asian range high or low breach. Enter on breakout pullback with volume confirmation.',
    exitRules: 'Take 50% profit at 2R, leave runner targeting daily ADR target.',
    allowedAssets: ['XAUUSD'],
    allowedDirections: ['LONG', 'SHORT'],
    maxRiskPercent: 1.0,
    targetRR: 2.0,
    checklistItems: [
      'Asian range plotted clearly',
      'London opening volume expansion',
      'Stop loss strictly under session low/high',
      'Risk calculated and verified'
    ],
    isActive: true,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'strat_btc_trend_retest',
    name: 'Bitcoin EMA Dynamic Support Retest',
    description: 'Trend continuation pullback to 4H 21/50 EMA cluster with bullish/bearish market structure shift.',
    entryRules: '4H trend clearly defined. 15m pullback with rejection candle at key moving average or support level.',
    exitRules: 'Target previous high/low with 3R minimum.',
    allowedAssets: ['BTCUSD'],
    allowedDirections: ['LONG', 'SHORT'],
    maxRiskPercent: 1.0,
    targetRR: 3.0,
    checklistItems: [
      'Trend alignment on 4H chart',
      'Healthy pullback volume declining',
      'Clear rejection wick',
      'Stop loss under structural swing'
    ],
    isActive: true,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const DEFAULT_KILL_SWITCH_SETTINGS: KillSwitchSettings = {
  isEnabled: true,
  mode: 'lock',
  maxDailyNetLoss: 500, // $500 max net loss/day
  maxDailyGrossLoss: 700,
  maxDailyDrawdownPercent: 4.0, // 4% equity drawdown
  maxAccountDrawdownPercent: 10.0,
  maxConsecutiveLosses: 3,
  maxTradesPerDay: 5,
  maxDailyRiskBudget: 800,
  maxRiskPerTradePercent: 2.0,
  maxGoldDailyLoss: 400,
  maxBtcDailyLoss: 400,
  warningThresholds: [50, 75, 90, 100],
  cooldownMinutesAfterLossStreak: 60,
  emergencyLockActive: false,
  emergencyLockReason: '',
  enforceStrictChecklist: false,
  allowManualEmergencyUnlock: true
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'dark',
  numberFormat: 'en-US',
  dateFormat: 'YYYY-MM-DD',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  rolloverHourUTC: 0,
  breakEvenThresholdPercent: 0.2,
  grossVsNetDisplay: 'net',
  backupReminderIntervalDays: 7,
  pnlLossCalculationMode: 'realized'
};

/**
 * Initialize DB defaults if not already present
 */
export async function initializeDatabase(): Promise<void> {
  const accountCount = await db.accounts.count();
  if (accountCount === 0) {
    await db.accounts.add(DEFAULT_ACCOUNT);
  }

  const instrumentCount = await db.instruments.count();
  if (instrumentCount === 0) {
    await db.instruments.bulkAdd(Object.values(DEFAULT_INSTRUMENTS));
  }

  const strategyCount = await db.strategies.count();
  if (strategyCount === 0) {
    await db.strategies.bulkAdd(DEFAULT_STRATEGIES);
  }

  const ksSetting = await db.settings.get('killSwitchSettings');
  if (!ksSetting) {
    await db.settings.put({ key: 'killSwitchSettings', value: DEFAULT_KILL_SWITCH_SETTINGS });
  }

  const appSetting = await db.settings.get('appSettings');
  if (!appSetting) {
    await db.settings.put({ key: 'appSettings', value: DEFAULT_APP_SETTINGS });
  }

  // Record initialization audit log if empty
  const logCount = await db.auditLogs.count();
  if (logCount === 0) {
    await db.auditLogs.add({
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      category: 'system',
      action: 'DATABASE_INITIALIZED',
      details: 'Learner HAMZA local-first storage initialized with verified Gold & Bitcoin instrument profiles and default risk architecture.'
    });
  }
}

/**
 * Helper to log audit entries
 */
export async function logAudit(
  category: AuditLogEntry['category'],
  action: string,
  details: string,
  recordId?: string,
  previousValue?: string,
  newValue?: string
): Promise<void> {
  try {
    await db.auditLogs.add({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      category,
      action,
      recordId,
      details,
      previousValue,
      newValue
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
