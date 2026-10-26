/**
 * Learner HAMZA - Advanced Trading Journal, Risk Management & Intelligence Platform
 * Core Type Definitions
 */

export type AssetType = 'XAUUSD' | 'BTCUSD' | string;
export type TradeDirection = 'LONG' | 'SHORT';
export type TradeStatus = 'Planned' | 'Open' | 'Closed' | 'Cancelled';
export type TradingSession = 'Asian' | 'London' | 'New York' | 'London/NY Overlap' | 'Other';

export interface TradeAttachment {
  id: string;
  tradeId: string;
  type: 'before' | 'entry' | 'exit' | 'post';
  dataUrl: string; // Base64 image
  caption?: string;
  uploadedAt: string;
  fileName?: string;
  fileSize?: number;
}

export interface Trade {
  id: string; // Auto-generated UUID or T-XXXX
  accountId: string;
  asset: AssetType;
  broker?: string;
  instrumentSymbol: string;
  strategyId?: string;
  setupType?: string;
  tradeDate: string; // YYYY-MM-DD
  entryTime: string; // ISO string
  exitTime?: string; // ISO string
  timezone: string;
  session: TradingSession;
  status: TradeStatus;

  // Direction
  direction: TradeDirection;

  // Execution
  entryPrice: number;
  exitPrice?: number;
  stopLossPrice: number;
  takeProfitPrice?: number;
  positionSize: number; // lots or units
  lotSize?: number; // specifically for Forex/Gold
  contractQuantity?: number; // for BTC
  contractSize: number; // e.g. 100 for XAUUSD 1 lot = 100 oz
  leverage?: number;
  marginUsed?: number;

  // Fees & Friction
  entryFees: number;
  exitFees: number;
  swapFundingFees: number;
  slippage: number;
  otherCosts: number;

  // Calculated Analysis
  plannedRiskAmount: number;
  plannedRiskPercent?: number;
  plannedRewardAmount?: number;
  plannedRR?: number;
  grossPnL?: number;
  netPnL?: number;
  actualR?: number;

  // Psychology & Discipline
  entryReason: string;
  exitReason?: string;
  timeframe?: string; // 1m, 2m, 5m, 15m, 30m, 1hr, 2hr, 4hr, 1D, 1W
  description?: string;
  remark?: string;
  ruleBreachedReason?: string;
  strategyName?: string;
  marketStructure?: string;
  liquidityNotes?: string;
  mistakeCategory?: string;
  ruleFollowed: boolean;
  emotionBefore?: string; // e.g., Calm, Anxious, FOMO, Confident, Rushed
  emotionDuring?: string;
  emotionAfter?: string;
  confidenceRating?: number; // 1 to 5
  qualityRating?: number; // 1 to 5
  lessonsLearned?: string;
  improvementAction?: string;
  notes?: string;

  // Attachments
  attachments: TradeAttachment[];

  // Meta
  isDraft?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  name: string;
  currency: string;
  startingCapital: number;
  createdAt: string;
  updatedAt: string;
}

export interface CapitalTransaction {
  id: string;
  accountId: string;
  type: 'deposit' | 'withdrawal' | 'adjustment';
  amount: number;
  date: string;
  notes?: string;
  createdAt: string;
}

export interface InstrumentConfig {
  symbol: string; // e.g., 'XAUUSD', 'BTCUSD'
  name: string;
  type: 'spot' | 'cfd' | 'futures' | 'perpetual';
  quoteCurrency: string;
  accountCurrency: string;
  contractSize: number; // e.g., 100 oz for XAUUSD, 1 for BTC spot
  minLot: number; // e.g., 0.01
  maxLot: number; // e.g., 100
  lotStep: number; // e.g., 0.01
  tickSize: number; // e.g., 0.01
  tickValue: number; // e.g., 1
  pipSize?: number; // e.g., 0.1 for Gold or 0.01
  defaultCommission: number; // per lot or %
  spreadEstimate: number; // in price points
  slippageEstimate: number;
  swapCostPerDay: number;
  defaultRiskPercent: number; // e.g., 1.0%
  fixedRecommendedLot?: number; // Configured lot size for quick entry
  maxRiskPerTrade: number; // e.g., 2.0%
  maxDailyLoss: number; // monetary limit
  maxOpenPositions: number;
  maxSimultaneousRiskPercent?: number;
  permittedSessions: TradingSession[];
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  entryRules: string;
  exitRules: string;
  allowedAssets: string[];
  allowedDirections: TradeDirection[];
  maxRiskPercent: number;
  targetRR: number;
  checklistItems: string[];
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KillSwitchSettings {
  isEnabled: boolean; // Master toggle: Kill switch can be enabled or disabled
  mode: 'warning' | 'lock'; // warning or enforced lock
  maxDailyNetLoss: number; // in account currency (e.g. 500)
  maxDailyGrossLoss: number;
  maxDailyDrawdownPercent: number; // e.g. 3.0%
  maxAccountDrawdownPercent: number; // e.g. 10.0%
  maxConsecutiveLosses: number; // e.g. 3
  maxTradesPerDay: number; // e.g. 5
  maxDailyRiskBudget: number; // e.g. 1000
  maxRiskPerTradePercent: number; // e.g. 2.0%
  maxGoldDailyLoss: number; // e.g. 300
  maxBtcDailyLoss: number; // e.g. 300
  warningThresholds: number[]; // e.g. [50, 75, 90, 100]
  cooldownMinutesAfterLossStreak: number;
  emergencyLockActive: boolean;
  emergencyLockReason?: string;
  emergencyLockTimestamp?: string;
  lockTriggerReason?: string;
  lockTriggerTimestamp?: string;
  enforceStrictChecklist: boolean;
  allowManualEmergencyUnlock: boolean;
}

export interface KillSwitchEvent {
  id: string;
  type: 'warning' | 'lock' | 'unlock' | 'manual_lock' | 'reset';
  reason: string;
  thresholdValue?: number;
  measuredValue?: number;
  timestamp: string;
  userNotes?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  category: 'trade' | 'capital' | 'config' | 'kill_switch' | 'backup' | 'restore' | 'system';
  action: string;
  recordId?: string;
  details: string;
  previousValue?: string;
  newValue?: string;
}

export interface AppSettings {
  theme: 'dark' | 'midnight' | 'contrast';
  numberFormat: 'en-US' | 'de-DE' | 'en-GB';
  dateFormat: 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';
  timezone: string;
  rolloverHourUTC: number; // default 0 (midnight UTC) or 22 (New York 5 PM)
  breakEvenThresholdPercent: number; // e.g., 0.1% or $5
  grossVsNetDisplay: 'net' | 'gross';
  backupReminderIntervalDays: number;
  lastBackupTimestamp?: string;
  pnlLossCalculationMode: 'realized' | 'equity_drawdown';
}

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  winRate: number; // %
  grossProfit: number;
  grossLoss: number;
  totalFees: number;
  netPnL: number;
  profitFactor: number | null; // null if no loss
  averageWin: number;
  averageLoss: number;
  averageTrade: number;
  winLossRatio: number;
  expectancy: number; // $ per trade
  expectancyR: number; // R-multiple per trade
  maxDrawdownAmount: number;
  maxDrawdownPercent: number;
  currentDrawdownAmount: number;
  currentDrawdownPercent: number;
  longestWinningStreak: number;
  longestLosingStreak: number;
  currentWinningStreak: number;
  currentLosingStreak: number;
  largestWin: number;
  largestLoss: number;
  averagePlannedRisk: number;
  averageRewardToRisk: number;
  averageHoldingMinutes: number;
  medianHoldingMinutes: number;
  bestTradingDay: { date: string; pnl: number };
  worstTradingDay: { date: string; pnl: number };
  ruleAdherenceRate: number; // %
  tradesWithNotesRate: number; // %
  returnOnCapitalPercent: number; // %
}

export interface FullBackupPayload {
  schemaVersion: string;
  appVersion: string;
  exportedAt: string;
  appName: string;
  data: {
    accounts: Account[];
    trades: Trade[];
    capitalTransactions: CapitalTransaction[];
    instruments: Record<string, InstrumentConfig>;
    strategies: Strategy[];
    killSwitchSettings: KillSwitchSettings;
    killSwitchEvents: KillSwitchEvent[];
    auditLogs: AuditLogEntry[];
    appSettings: AppSettings;
    attachments: TradeAttachment[];
  };
  stats: {
    tradeCount: number;
    accountCount: number;
    strategyCount: number;
    attachmentCount: number;
  };
}
