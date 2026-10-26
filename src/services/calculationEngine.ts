/**
 * Learner HAMZA - Calculation Engine
 * High-precision quantitative trading calculations, risk management,
 * position sizing, performance intelligence and kill-switch evaluation.
 */

import {
  Trade,
  InstrumentConfig,
  KillSwitchSettings,
  PerformanceMetrics,
  Account,
  CapitalTransaction
} from '../types';

/**
 * Calculate Gross P&L for a trade
 * Long: (Exit - Entry) * Position * ContractSize
 * Short: (Entry - Exit) * Position * ContractSize
 */
export function calculateGrossPnL(
  entryPrice: number,
  exitPrice: number,
  direction: 'LONG' | 'SHORT',
  positionSize: number, // lots or units
  contractSize: number
): number {
  if (!entryPrice || !exitPrice || positionSize <= 0) return 0;
  
  const priceDiff = direction === 'LONG' ? (exitPrice - entryPrice) : (entryPrice - exitPrice);
  const gross = priceDiff * positionSize * (contractSize > 0 ? contractSize : 1);
  return Number(gross.toFixed(2));
}

/**
 * Calculate Net P&L factoring in all explicit trading fees, slippage, and financing
 */
export function calculateNetPnL(
  grossPnL: number,
  fees: {
    entryFees?: number;
    exitFees?: number;
    swapFundingFees?: number;
    slippage?: number;
    otherCosts?: number;
  }
): number {
  const totalFrictions =
    (fees.entryFees || 0) +
    (fees.exitFees || 0) +
    (fees.swapFundingFees || 0) +
    (fees.slippage || 0) +
    (fees.otherCosts || 0);

  const net = grossPnL - totalFrictions;
  return Number(net.toFixed(2));
}

/**
 * Calculate R-Multiple: Net P&L divided by initial Planned Monetary Risk
 */
export function calculateRMultiple(netPnL: number, plannedRiskAmount: number): number {
  if (!plannedRiskAmount || plannedRiskAmount <= 0) return 0;
  return Number((netPnL / plannedRiskAmount).toFixed(2));
}

/**
 * Position Size Sizing Calculator
 * Ensures risk budget is never exceeded and rounds DOWN to permitted lotStep
 */
export interface PositionSizeResult {
  riskBudget: number; // in $
  stopLossDistance: number; // in price units
  positionSize: number; // in lots or contract units (strictly rounded down)
  estimatedGrossProfit: number;
  estimatedNetProfit: number;
  estimatedNetLossAtSL: number;
  rewardToRiskRatio: number;
  warnings: string[];
  isValid: boolean;
}

export function calculatePositionSize(
  equity: number,
  riskPercent: number,
  entryPrice: number,
  stopLossPrice: number,
  takeProfitPrice: number | undefined,
  instrument: InstrumentConfig,
  direction: 'LONG' | 'SHORT'
): PositionSizeResult {
  const warnings: string[] = [];

  if (equity <= 0) {
    return {
      riskBudget: 0,
      stopLossDistance: 0,
      positionSize: 0,
      estimatedGrossProfit: 0,
      estimatedNetProfit: 0,
      estimatedNetLossAtSL: 0,
      rewardToRiskRatio: 0,
      warnings: ['Account equity must be greater than zero.'],
      isValid: false
    };
  }

  if (riskPercent <= 0) {
    return {
      riskBudget: 0,
      stopLossDistance: 0,
      positionSize: 0,
      estimatedGrossProfit: 0,
      estimatedNetProfit: 0,
      estimatedNetLossAtSL: 0,
      rewardToRiskRatio: 0,
      warnings: ['Risk percentage must be greater than zero.'],
      isValid: false
    };
  }

  if (entryPrice <= 0 || stopLossPrice <= 0) {
    return {
      riskBudget: 0,
      stopLossDistance: 0,
      positionSize: 0,
      estimatedGrossProfit: 0,
      estimatedNetProfit: 0,
      estimatedNetLossAtSL: 0,
      rewardToRiskRatio: 0,
      warnings: ['Entry price and Stop-loss must be positive numbers.'],
      isValid: false
    };
  }

  // Bracket validation
  if (direction === 'LONG') {
    if (stopLossPrice >= entryPrice) {
      warnings.push('For a LONG trade, Stop Loss must be strictly below Entry price.');
    }
    if (takeProfitPrice && takeProfitPrice <= entryPrice) {
      warnings.push('For a LONG trade, Take Profit should be above Entry price.');
    }
  } else {
    if (stopLossPrice <= entryPrice) {
      warnings.push('For a SHORT trade, Stop Loss must be strictly above Entry price.');
    }
    if (takeProfitPrice && takeProfitPrice >= entryPrice) {
      warnings.push('For a SHORT trade, Take Profit should be below Entry price.');
    }
  }

  const stopLossDistance = Math.abs(entryPrice - stopLossPrice);
  if (stopLossDistance === 0) {
    warnings.push('Stop Loss distance cannot be zero.');
    return {
      riskBudget: 0,
      stopLossDistance: 0,
      positionSize: 0,
      estimatedGrossProfit: 0,
      estimatedNetProfit: 0,
      estimatedNetLossAtSL: 0,
      rewardToRiskRatio: 0,
      warnings,
      isValid: false
    };
  }

  // Risk budget = Equity * (riskPercent / 100)
  const riskBudget = Number((equity * (riskPercent / 100)).toFixed(2));

  // Risk per unit = (stopLossDistance * contractSize) + estimatedFeesPerUnit
  const contractSize = instrument.contractSize > 0 ? instrument.contractSize : 1;
  const estimatedCostPerLot = (instrument.defaultCommission || 0) + (instrument.spreadEstimate || 0) * contractSize;
  const lossPerLotAtSL = stopLossDistance * contractSize + estimatedCostPerLot;

  let rawLots = riskBudget / lossPerLotAtSL;

  // Round DOWN to the instrument's permitted lot step (never round UP to avoid exceeding risk budget)
  const step = instrument.lotStep > 0 ? instrument.lotStep : 0.01;
  const precision = Math.max(0, -Math.floor(Math.log10(step)));
  let roundedLots = Math.floor(rawLots / step) * step;
  roundedLots = Number(roundedLots.toFixed(precision));

  // Check min/max bounds
  if (roundedLots < instrument.minLot) {
    warnings.push(`Calculated size (${roundedLots}) is below broker minimum lot (${instrument.minLot}). Sizing capped or minimum risk exceeded.`);
  }
  if (roundedLots > instrument.maxLot) {
    warnings.push(`Calculated size (${roundedLots}) exceeds broker maximum lot (${instrument.maxLot}). Capped at maximum.`);
    roundedLots = instrument.maxLot;
  }

  // Estimated gross & net at TP and SL
  let estimatedGrossProfit = 0;
  let estimatedNetProfit = 0;
  let rewardToRiskRatio = 0;

  if (takeProfitPrice && takeProfitPrice > 0) {
    const tpDistance = Math.abs(takeProfitPrice - entryPrice);
    estimatedGrossProfit = Number((tpDistance * roundedLots * contractSize).toFixed(2));
    estimatedNetProfit = Number((estimatedGrossProfit - (estimatedCostPerLot * roundedLots)).toFixed(2));
    rewardToRiskRatio = stopLossDistance > 0 ? Number((tpDistance / stopLossDistance).toFixed(2)) : 0;
  }

  const estimatedNetLossAtSL = Number((stopLossDistance * roundedLots * contractSize + (estimatedCostPerLot * roundedLots)).toFixed(2));

  return {
    riskBudget,
    stopLossDistance: Number(stopLossDistance.toFixed(4)),
    positionSize: roundedLots,
    estimatedGrossProfit,
    estimatedNetProfit,
    estimatedNetLossAtSL: -estimatedNetLossAtSL,
    rewardToRiskRatio,
    warnings,
    isValid: warnings.length === 0 || (warnings.length === 1 && warnings[0].includes('Take Profit'))
  };
}

/**
 * Check Kill Switch rules against current trading day and account state
 */
export interface KillSwitchEvaluation {
  isTriggered: boolean;
  isWarning: boolean;
  warningPercent: number; // highest percentage of limit reached
  primaryReason: string;
  violations: Array<{
    rule: string;
    threshold: number;
    current: number;
    percentConsumed: number;
    severity: 'info' | 'warning' | 'critical' | 'lock';
  }>;
  dailyLossConsumed: number;
  dailyLossLimit: number;
  dailyLossRemaining: number;
}

export function evaluateKillSwitch(
  todayClosedTrades: Trade[],
  todayOpenTrades: Trade[],
  allClosedTrades: Trade[],
  account: Account,
  settings: KillSwitchSettings,
  referenceEquity?: number
): KillSwitchEvaluation {
  const dailyLossLimit = settings.maxDailyNetLoss > 0 ? settings.maxDailyNetLoss : 500;
  const todayNetPnL = todayClosedTrades.reduce((sum, t) => sum + (t.netPnL || 0), 0);
  const todayNetLoss = todayNetPnL < 0 ? Math.abs(todayNetPnL) : 0;
  const remainingAllowance = Math.max(0, dailyLossLimit - todayNetLoss);

  // If Kill Switch is explicitly disabled in Master Control:
  if (settings.isEnabled === false) {
    return {
      isTriggered: false,
      isWarning: false,
      warningPercent: 0,
      primaryReason: 'Kill Switch is Disabled in Master Control',
      violations: [],
      dailyLossConsumed: Number(todayNetLoss.toFixed(2)),
      dailyLossLimit,
      dailyLossRemaining: Number(remainingAllowance.toFixed(2))
    };
  }

  const violations: KillSwitchEvaluation['violations'] = [];
  const activeEquity = referenceEquity || account.startingCapital;

  // 1. Calculate Today's Gross Loss from closed trades
  const todayGrossLoss = todayClosedTrades.reduce((sum, t) => {
    const gross = t.grossPnL || 0;
    return gross < 0 ? sum + Math.abs(gross) : sum;
  }, 0);

  // Check Daily Net Loss
  const dailyLossPercent = (todayNetLoss / dailyLossLimit) * 100;

  if (dailyLossPercent >= 100) {
    violations.push({
      rule: 'Max Daily Net Loss Breached',
      threshold: dailyLossLimit,
      current: todayNetLoss,
      percentConsumed: dailyLossPercent,
      severity: settings.mode === 'lock' ? 'lock' : 'critical'
    });
  } else if (dailyLossPercent >= 90) {
    violations.push({
      rule: 'Daily Net Loss near limit (90%+)',
      threshold: dailyLossLimit,
      current: todayNetLoss,
      percentConsumed: dailyLossPercent,
      severity: 'critical'
    });
  } else if (dailyLossPercent >= 75) {
    violations.push({
      rule: 'Daily Net Loss high warning (75%+)',
      threshold: dailyLossLimit,
      current: todayNetLoss,
      percentConsumed: dailyLossPercent,
      severity: 'warning'
    });
  } else if (dailyLossPercent >= 50) {
    violations.push({
      rule: 'Daily Net Loss advisory warning (50%+)',
      threshold: dailyLossLimit,
      current: todayNetLoss,
      percentConsumed: dailyLossPercent,
      severity: 'info'
    });
  }

  // 2. Check Daily Gross Loss
  if (settings.maxDailyGrossLoss > 0 && todayGrossLoss >= settings.maxDailyGrossLoss) {
    violations.push({
      rule: 'Max Daily Gross Loss Breached',
      threshold: settings.maxDailyGrossLoss,
      current: todayGrossLoss,
      percentConsumed: (todayGrossLoss / settings.maxDailyGrossLoss) * 100,
      severity: settings.mode === 'lock' ? 'lock' : 'critical'
    });
  }

  // 3. Daily Drawdown % of reference equity
  if (settings.maxDailyDrawdownPercent > 0 && activeEquity > 0) {
    const dailyDrawdownPercent = (todayNetLoss / activeEquity) * 100;
    if (dailyDrawdownPercent >= settings.maxDailyDrawdownPercent) {
      violations.push({
        rule: `Max Daily Drawdown (${settings.maxDailyDrawdownPercent}%) Breached`,
        threshold: settings.maxDailyDrawdownPercent,
        current: Number(dailyDrawdownPercent.toFixed(2)),
        percentConsumed: (dailyDrawdownPercent / settings.maxDailyDrawdownPercent) * 100,
        severity: settings.mode === 'lock' ? 'lock' : 'critical'
      });
    }
  }

  // 4. Consecutive Losses (look at sorted recent trades)
  const sortedRecent = [...allClosedTrades].sort(
    (a, b) => new Date(b.exitTime || b.tradeDate).getTime() - new Date(a.exitTime || a.tradeDate).getTime()
  );
  let consecutiveLosses = 0;
  for (const t of sortedRecent) {
    if ((t.netPnL || 0) < 0) {
      consecutiveLosses++;
    } else if ((t.netPnL || 0) > 0) {
      break;
    }
  }

  if (settings.maxConsecutiveLosses > 0 && consecutiveLosses >= settings.maxConsecutiveLosses) {
    violations.push({
      rule: `Max Consecutive Losses (${settings.maxConsecutiveLosses}) Reached`,
      threshold: settings.maxConsecutiveLosses,
      current: consecutiveLosses,
      percentConsumed: (consecutiveLosses / settings.maxConsecutiveLosses) * 100,
      severity: settings.mode === 'lock' ? 'lock' : 'warning'
    });
  }

  // 5. Max Trades Per Day
  const totalTradesToday = todayClosedTrades.length + todayOpenTrades.length;
  if (settings.maxTradesPerDay > 0 && totalTradesToday >= settings.maxTradesPerDay) {
    violations.push({
      rule: `Daily Trade Volume Cap (${settings.maxTradesPerDay}) Reached`,
      threshold: settings.maxTradesPerDay,
      current: totalTradesToday,
      percentConsumed: (totalTradesToday / settings.maxTradesPerDay) * 100,
      severity: settings.mode === 'lock' ? 'lock' : 'warning'
    });
  }

  // 6. Asset-specific daily loss check (Gold / BTC)
  const goldTodayLoss = todayClosedTrades
    .filter(t => t.asset.toUpperCase().includes('XAU') || t.asset.toUpperCase().includes('GOLD'))
    .reduce((sum, t) => sum + (t.netPnL || 0), 0);
  if (settings.maxGoldDailyLoss > 0 && goldTodayLoss < -settings.maxGoldDailyLoss) {
    violations.push({
      rule: `Max Gold (XAUUSD) Daily Loss Breached`,
      threshold: settings.maxGoldDailyLoss,
      current: Math.abs(goldTodayLoss),
      percentConsumed: (Math.abs(goldTodayLoss) / settings.maxGoldDailyLoss) * 100,
      severity: settings.mode === 'lock' ? 'lock' : 'warning'
    });
  }

  const btcTodayLoss = todayClosedTrades
    .filter(t => t.asset.toUpperCase().includes('BTC') || t.asset.toUpperCase().includes('BITCOIN'))
    .reduce((sum, t) => sum + (t.netPnL || 0), 0);
  if (settings.maxBtcDailyLoss > 0 && btcTodayLoss < -settings.maxBtcDailyLoss) {
    violations.push({
      rule: `Max Bitcoin (BTCUSD) Daily Loss Breached`,
      threshold: settings.maxBtcDailyLoss,
      current: Math.abs(btcTodayLoss),
      percentConsumed: (Math.abs(btcTodayLoss) / settings.maxBtcDailyLoss) * 100,
      severity: settings.mode === 'lock' ? 'lock' : 'warning'
    });
  }

  // Emergency Lock Active check
  if (settings.emergencyLockActive) {
    violations.unshift({
      rule: 'Manual Emergency Trading Lock Active',
      threshold: 1,
      current: 1,
      percentConsumed: 100,
      severity: 'lock'
    });
  }

  const hasLockSeverity = violations.some(v => v.severity === 'lock') || settings.emergencyLockActive;
  const hasWarningSeverity = violations.some(v => v.severity === 'warning' || v.severity === 'critical');
  const maxPercent = violations.length > 0 ? Math.max(...violations.map(v => v.percentConsumed)) : dailyLossPercent;

  let primaryReason = '';
  if (settings.emergencyLockActive) {
    primaryReason = settings.emergencyLockReason || 'Manual Emergency Lock Activated by Trader';
  } else if (hasLockSeverity) {
    primaryReason = violations.find(v => v.severity === 'lock')?.rule || 'Risk Threshold Exceeded (Lock Mode)';
  } else if (hasWarningSeverity) {
    primaryReason = violations.find(v => v.severity === 'critical' || v.severity === 'warning')?.rule || 'Risk Warning Level Reached';
  }

  return {
    isTriggered: hasLockSeverity,
    isWarning: hasWarningSeverity,
    warningPercent: Number(maxPercent.toFixed(1)),
    primaryReason,
    violations,
    dailyLossConsumed: Number(todayNetLoss.toFixed(2)),
    dailyLossLimit,
    dailyLossRemaining: Number(remainingAllowance.toFixed(2))
  };
}

/**
 * Calculate Comprehensive Performance Metrics from an array of trades
 */
export function calculatePerformanceMetrics(
  trades: Trade[],
  startingCapital: number,
  capitalTransactions: CapitalTransaction[] = [],
  breakEvenThreshold: number = 0.5 // trades between -$0.5 and +$0.5 are break-even
): PerformanceMetrics {
  const closed = trades.filter(t => t.status === 'Closed' && !t.isDraft);

  if (closed.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      breakEvenTrades: 0,
      winRate: 0,
      grossProfit: 0,
      grossLoss: 0,
      totalFees: 0,
      netPnL: 0,
      profitFactor: null,
      averageWin: 0,
      averageLoss: 0,
      averageTrade: 0,
      winLossRatio: 0,
      expectancy: 0,
      expectancyR: 0,
      maxDrawdownAmount: 0,
      maxDrawdownPercent: 0,
      currentDrawdownAmount: 0,
      currentDrawdownPercent: 0,
      longestWinningStreak: 0,
      longestLosingStreak: 0,
      currentWinningStreak: 0,
      currentLosingStreak: 0,
      largestWin: 0,
      largestLoss: 0,
      averagePlannedRisk: 0,
      averageRewardToRisk: 0,
      averageHoldingMinutes: 0,
      medianHoldingMinutes: 0,
      bestTradingDay: { date: 'N/A', pnl: 0 },
      worstTradingDay: { date: 'N/A', pnl: 0 },
      ruleAdherenceRate: 0,
      tradesWithNotesRate: 0,
      returnOnCapitalPercent: 0
    };
  }

  let grossProfit = 0;
  let grossLoss = 0;
  let totalFees = 0;
  let netPnL = 0;

  let winningTrades = 0;
  let losingTrades = 0;
  let breakEvenTrades = 0;

  let totalWinPnL = 0;
  let totalLossPnL = 0;

  let largestWin = 0;
  let largestLoss = 0;

  let totalPlannedRisk = 0;
  let totalPlannedRR = 0;
  let validRRCount = 0;
  let totalRMultiple = 0;
  let validRCount = 0;

  let ruleFollowedCount = 0;
  let notesCount = 0;

  const holdingDurations: number[] = [];
  const dailyPnLMap: Record<string, number> = {};

  // Sort chronologically for streak & drawdown
  const sorted = [...closed].sort(
    (a, b) => new Date(a.exitTime || a.tradeDate).getTime() - new Date(b.exitTime || b.tradeDate).getTime()
  );

  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;

  for (const t of sorted) {
    const net = t.netPnL ?? 0;
    const gross = t.grossPnL ?? net;
    const fees = (t.entryFees || 0) + (t.exitFees || 0) + (t.swapFundingFees || 0) + (t.slippage || 0) + (t.otherCosts || 0);

    netPnL += net;
    totalFees += fees;

    if (gross > 0) grossProfit += gross;
    else grossLoss += Math.abs(gross);

    // Break-even determination
    if (Math.abs(net) <= breakEvenThreshold) {
      breakEvenTrades++;
      // Break-even does not increment streaks
    } else if (net > 0) {
      winningTrades++;
      totalWinPnL += net;
      if (net > largestWin) largestWin = net;

      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > longestWinStreak) longestWinStreak = currentWinStreak;
    } else {
      losingTrades++;
      totalLossPnL += Math.abs(net);
      if (net < largestLoss) largestLoss = net;

      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > longestLossStreak) longestLossStreak = currentLossStreak;
    }

    if (t.plannedRiskAmount && t.plannedRiskAmount > 0) {
      totalPlannedRisk += t.plannedRiskAmount;
      if (t.actualR !== undefined) {
        totalRMultiple += t.actualR;
        validRCount++;
      }
    }

    if (t.plannedRR && t.plannedRR > 0) {
      totalPlannedRR += t.plannedRR;
      validRRCount++;
    }

    if (t.ruleFollowed) ruleFollowedCount++;
    if (t.notes && t.notes.trim().length > 5) notesCount++;

    // Holding duration
    if (t.entryTime && t.exitTime) {
      const durMinutes = Math.max(0, (new Date(t.exitTime).getTime() - new Date(t.entryTime).getTime()) / (1000 * 60));
      holdingDurations.push(durMinutes);
    }

    // Daily grouping
    const day = t.tradeDate || (t.exitTime ? t.exitTime.split('T')[0] : 'Unknown');
    dailyPnLMap[day] = (dailyPnLMap[day] || 0) + net;
  }

  // Drawdown calculation across running balance
  let runningEquity = startingCapital;
  // Apply non-trade transactions if any
  let peakEquity = startingCapital;
  let maxDrawdownAmount = 0;
  let maxDrawdownPercent = 0;

  for (const t of sorted) {
    runningEquity += (t.netPnL || 0);
    if (runningEquity > peakEquity) {
      peakEquity = runningEquity;
    }
    const ddAmount = peakEquity - runningEquity;
    const ddPercent = peakEquity > 0 ? (ddAmount / peakEquity) * 100 : 0;
    if (ddAmount > maxDrawdownAmount) {
      maxDrawdownAmount = ddAmount;
    }
    if (ddPercent > maxDrawdownPercent) {
      maxDrawdownPercent = ddPercent;
    }
  }

  const currentDrawdownAmount = Math.max(0, peakEquity - runningEquity);
  const currentDrawdownPercent = peakEquity > 0 ? (currentDrawdownAmount / peakEquity) * 100 : 0;

  // Win rate
  const winRate = closed.length > 0 ? Number(((winningTrades / closed.length) * 100).toFixed(2)) : 0;

  // Profit Factor
  let profitFactor: number | null = null;
  if (grossLoss > 0) {
    profitFactor = Number((grossProfit / grossLoss).toFixed(2));
  } else if (grossProfit > 0) {
    profitFactor = null; // No losses recorded
  }

  // Averages
  const averageWin = winningTrades > 0 ? Number((totalWinPnL / winningTrades).toFixed(2)) : 0;
  const averageLoss = losingTrades > 0 ? Number((totalLossPnL / losingTrades).toFixed(2)) : 0;
  const averageTrade = Number((netPnL / closed.length).toFixed(2));
  const winLossRatio = averageLoss > 0 ? Number((averageWin / averageLoss).toFixed(2)) : averageWin > 0 ? 999 : 0;

  // Expectancy = (Win% * AvgWin) - (Loss% * AvgLoss)
  const pWin = winningTrades / closed.length;
  const pLoss = losingTrades / closed.length;
  const expectancy = Number(((pWin * averageWin) - (pLoss * averageLoss)).toFixed(2));
  const expectancyR = validRCount > 0 ? Number((totalRMultiple / validRCount).toFixed(2)) : 0;

  // Best & worst days
  let bestDay = { date: 'N/A', pnl: 0 };
  let worstDay = { date: 'N/A', pnl: 0 };
  Object.entries(dailyPnLMap).forEach(([date, pnl]) => {
    if (pnl > bestDay.pnl || bestDay.date === 'N/A') bestDay = { date, pnl };
    if (pnl < worstDay.pnl || worstDay.date === 'N/A') worstDay = { date, pnl };
  });

  // Holding duration median & mean
  holdingDurations.sort((a, b) => a - b);
  const averageHoldingMinutes = holdingDurations.length > 0
    ? Number((holdingDurations.reduce((a, b) => a + b, 0) / holdingDurations.length).toFixed(1))
    : 0;
  const medianHoldingMinutes = holdingDurations.length > 0
    ? Number(holdingDurations[Math.floor(holdingDurations.length / 2)].toFixed(1))
    : 0;

  // Capital deposits/withdrawals adjustment for pure trading return
  const totalNetTrading = netPnL;
  const returnOnCapitalPercent = startingCapital > 0 ? Number(((totalNetTrading / startingCapital) * 100).toFixed(2)) : 0;

  return {
    totalTrades: closed.length,
    winningTrades,
    losingTrades,
    breakEvenTrades,
    winRate,
    grossProfit: Number(grossProfit.toFixed(2)),
    grossLoss: Number(grossLoss.toFixed(2)),
    totalFees: Number(totalFees.toFixed(2)),
    netPnL: Number(netPnL.toFixed(2)),
    profitFactor,
    averageWin,
    averageLoss,
    averageTrade,
    winLossRatio,
    expectancy,
    expectancyR,
    maxDrawdownAmount: Number(maxDrawdownAmount.toFixed(2)),
    maxDrawdownPercent: Number(maxDrawdownPercent.toFixed(2)),
    currentDrawdownAmount: Number(currentDrawdownAmount.toFixed(2)),
    currentDrawdownPercent: Number(currentDrawdownPercent.toFixed(2)),
    longestWinningStreak: longestWinStreak,
    longestLosingStreak: longestLossStreak,
    currentWinningStreak: currentWinStreak,
    currentLosingStreak: currentLossStreak,
    largestWin: Number(largestWin.toFixed(2)),
    largestLoss: Number(largestLoss.toFixed(2)),
    averagePlannedRisk: closed.length > 0 ? Number((totalPlannedRisk / closed.length).toFixed(2)) : 0,
    averageRewardToRisk: validRRCount > 0 ? Number((totalPlannedRR / validRRCount).toFixed(2)) : 0,
    averageHoldingMinutes,
    medianHoldingMinutes,
    bestTradingDay: bestDay,
    worstTradingDay: worstDay,
    ruleAdherenceRate: Number(((ruleFollowedCount / closed.length) * 100).toFixed(1)),
    tradesWithNotesRate: Number(((notesCount / closed.length) * 100).toFixed(1)),
    returnOnCapitalPercent
  };
}
