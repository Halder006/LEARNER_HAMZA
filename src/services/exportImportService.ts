/**
 * Learner HAMZA - Export, Import & Lifetime Backup Engine
 * Complete JSON snapshot with attachments & multi-sheet Excel (.xlsx) processing
 */

import * as XLSX from 'xlsx';
import { db, logAudit, DEFAULT_KILL_SWITCH_SETTINGS, DEFAULT_APP_SETTINGS } from '../db/db';
import {
  FullBackupPayload,
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

export const CURRENT_SCHEMA_VERSION = '1.0';
export const APP_VERSION = '1.0.0';

/**
 * Generate and download a complete JSON backup containing all tables and attachments
 */
export async function exportFullBackupJSON(): Promise<{ fileName: string; sizeBytes: number; stats: any }> {
  const [
    accounts,
    trades,
    capitalTransactions,
    instrumentsArr,
    strategies,
    killSwitchEvents,
    auditLogs,
    attachments,
    ksSettingRow,
    appSettingRow
  ] = await Promise.all([
    db.accounts.toArray(),
    db.trades.toArray(),
    db.capitalTransactions.toArray(),
    db.instruments.toArray(),
    db.strategies.toArray(),
    db.killSwitchEvents.toArray(),
    db.auditLogs.toArray(),
    db.attachments.toArray(),
    db.settings.get('killSwitchSettings'),
    db.settings.get('appSettings')
  ]);

  const instruments: Record<string, InstrumentConfig> = {};
  instrumentsArr.forEach(inst => {
    instruments[inst.symbol] = inst;
  });

  const payload: FullBackupPayload = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    appName: 'Learner HAMZA',
    exportedAt: new Date().toISOString(),
    data: {
      accounts,
      trades,
      capitalTransactions,
      instruments,
      strategies,
      killSwitchSettings: ksSettingRow?.value || DEFAULT_KILL_SWITCH_SETTINGS,
      killSwitchEvents,
      auditLogs,
      appSettings: appSettingRow?.value || DEFAULT_APP_SETTINGS,
      attachments
    },
    stats: {
      tradeCount: trades.length,
      accountCount: accounts.length,
      strategyCount: strategies.length,
      attachmentCount: attachments.length
    }
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const fileName = `Learner_HAMZA_Full_Backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  // Update last backup timestamp
  const currentAppSettings = appSettingRow?.value || DEFAULT_APP_SETTINGS;
  currentAppSettings.lastBackupTimestamp = new Date().toISOString();
  await db.settings.put({ key: 'appSettings', value: currentAppSettings });

  await logAudit('backup', 'FULL_JSON_BACKUP_EXPORTED', `Exported full backup containing ${trades.length} trades, ${attachments.length} attachments.`);

  return {
    fileName,
    sizeBytes: blob.size,
    stats: payload.stats
  };
}

/**
 * Validate backup JSON structure and check schema version
 */
export function validateBackupPayload(parsed: any): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!parsed || typeof parsed !== 'object') {
    errors.push('Invalid file structure: file is not a JSON object.');
    return { isValid: false, errors, warnings };
  }

  if (!parsed.schemaVersion) {
    warnings.push('Backup missing explicit schemaVersion; attempting legacy compatibility mode.');
  }

  if (!parsed.data || typeof parsed.data !== 'object') {
    errors.push('Missing "data" container in backup JSON.');
    return { isValid: false, errors, warnings };
  }

  if (!Array.isArray(parsed.data.trades)) {
    errors.push('Backup data does not contain a valid trades array.');
  }

  if (!Array.isArray(parsed.data.accounts)) {
    warnings.push('Backup data missing accounts array; fallback account will be created.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Import a full JSON backup with Replace or Merge mode
 */
export async function importFullBackupJSON(
  jsonContent: string,
  mode: 'replace' | 'merge'
): Promise<{ success: boolean; message: string; importedTrades: number; duplicatesSkipped: number }> {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonContent);
  } catch (err: any) {
    throw new Error(`Failed to parse JSON file: ${err.message}`);
  }

  const validation = validateBackupPayload(parsed);
  if (!validation.isValid) {
    throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
  }

  const { data } = parsed as FullBackupPayload;
  let importedTrades = 0;
  let duplicatesSkipped = 0;

  if (mode === 'replace') {
    // Atomic replacement in a Dexie transaction
    await db.transaction(
      'rw',
      [
        db.trades,
        db.accounts,
        db.capitalTransactions,
        db.instruments,
        db.strategies,
        db.killSwitchEvents,
        db.attachments,
        db.settings,
        db.auditLogs
      ],
      async () => {
        await Promise.all([
          db.trades.clear(),
          db.accounts.clear(),
          db.capitalTransactions.clear(),
          db.instruments.clear(),
          db.strategies.clear(),
          db.killSwitchEvents.clear(),
          db.attachments.clear()
        ]);

        if (data.accounts?.length) await db.accounts.bulkAdd(data.accounts);
        if (data.trades?.length) {
          await db.trades.bulkAdd(data.trades);
          importedTrades = data.trades.length;
        }
        if (data.capitalTransactions?.length) await db.capitalTransactions.bulkAdd(data.capitalTransactions);
        if (data.instruments) {
          const instArr = Object.values(data.instruments);
          if (instArr.length) await db.instruments.bulkAdd(instArr);
        }
        if (data.strategies?.length) await db.strategies.bulkAdd(data.strategies);
        if (data.killSwitchEvents?.length) await db.killSwitchEvents.bulkAdd(data.killSwitchEvents);
        if (data.attachments?.length) await db.attachments.bulkAdd(data.attachments);

        if (data.killSwitchSettings) {
          await db.settings.put({ key: 'killSwitchSettings', value: data.killSwitchSettings });
        }
        if (data.appSettings) {
          await db.settings.put({ key: 'appSettings', value: data.appSettings });
        }
      }
    );

    await logAudit(
      'restore',
      'BACKUP_RESTORED_REPLACE_MODE',
      `Restored backup successfully. Total trades imported: ${importedTrades}.`
    );

    return {
      success: true,
      message: `Complete dataset restored. ${importedTrades} trades and all configuration imported.`,
      importedTrades,
      duplicatesSkipped: 0
    };
  } else {
    // Merge mode: retain existing, add non-duplicate records by ID
    const existingTradeIds = new Set(await db.trades.toCollection().primaryKeys());
    const newTrades: Trade[] = [];

    for (const trade of (data.trades || [])) {
      if (existingTradeIds.has(trade.id)) {
        duplicatesSkipped++;
      } else {
        newTrades.push(trade);
      }
    }

    if (newTrades.length > 0) {
      await db.trades.bulkAdd(newTrades);
      importedTrades = newTrades.length;
    }

    // Merge strategies
    if (data.strategies?.length) {
      const existingStratIds = new Set(await db.strategies.toCollection().primaryKeys());
      const newStrats = data.strategies.filter(s => !existingStratIds.has(s.id));
      if (newStrats.length) await db.strategies.bulkAdd(newStrats);
    }

    // Merge attachments
    if (data.attachments?.length) {
      const existingAttIds = new Set(await db.attachments.toCollection().primaryKeys());
      const newAtts = data.attachments.filter(a => !existingAttIds.has(a.id));
      if (newAtts.length) await db.attachments.bulkAdd(newAtts);
    }

    await logAudit(
      'restore',
      'BACKUP_RESTORED_MERGE_MODE',
      `Merged backup: ${importedTrades} new trades added, ${duplicatesSkipped} duplicates skipped.`
    );

    return {
      success: true,
      message: `Merged dataset: ${importedTrades} new trades added, ${duplicatesSkipped} existing duplicates skipped.`,
      importedTrades,
      duplicatesSkipped
    };
  }
}

/**
 * Export Multi-Sheet Excel Workbook (.xlsx)
 */
export async function exportExcelWorkbook(): Promise<string> {
  const [trades, accounts, capital, instruments, strategies, ksEvents, auditLogs] = await Promise.all([
    db.trades.toArray(),
    db.accounts.toArray(),
    db.capitalTransactions.toArray(),
    db.instruments.toArray(),
    db.strategies.toArray(),
    db.killSwitchEvents.toArray(),
    db.auditLogs.limit(500).toArray()
  ]);

  const wb = XLSX.utils.book_new();

  // 1. Trades Sheet
  const tradesData = trades.map(t => ({
    'Trade ID': t.id,
    'Date': t.tradeDate,
    'Entry Time': t.entryTime,
    'Exit Time': t.exitTime || '',
    'Asset': t.asset,
    'Symbol': t.instrumentSymbol,
    'Direction': t.direction,
    'Status': t.status,
    'Session': t.session,
    'Strategy ID': t.strategyId || '',
    'Setup': t.setupType || '',
    'Entry Price': t.entryPrice,
    'Exit Price': t.exitPrice || '',
    'Stop Loss': t.stopLossPrice,
    'Take Profit': t.takeProfitPrice || '',
    'Position Size (Lots/Qty)': t.positionSize,
    'Contract Size': t.contractSize,
    'Gross P&L': t.grossPnL ?? 0,
    'Entry Fees': t.entryFees || 0,
    'Exit Fees': t.exitFees || 0,
    'Swap & Financing': t.swapFundingFees || 0,
    'Slippage': t.slippage || 0,
    'Other Costs': t.otherCosts || 0,
    'Net P&L ($)': t.netPnL ?? 0,
    'Planned Risk ($)': t.plannedRiskAmount || 0,
    'Planned R:R': t.plannedRR || '',
    'Actual R': t.actualR ?? '',
    'Rule Followed': t.ruleFollowed ? 'YES' : 'NO',
    'Mistake Category': t.mistakeCategory || '',
    'Emotion Before': t.emotionBefore || '',
    'Emotion During': t.emotionDuring || '',
    'Emotion After': t.emotionAfter || '',
    'Confidence (1-5)': t.confidenceRating,
    'Quality (1-5)': t.qualityRating || '',
    'Entry Reason': t.entryReason || '',
    'Exit Reason': t.exitReason || '',
    'Lessons Learned': t.lessonsLearned || '',
    'Notes': t.notes || ''
  }));
  const wsTrades = XLSX.utils.json_to_sheet(tradesData.length > 0 ? tradesData : [{ 'Trade ID': '', 'Notes': 'No trades recorded yet' }]);
  XLSX.utils.book_append_sheet(wb, wsTrades, 'Trades');

  // 2. Capital Ledger Sheet
  const capitalData = capital.map(c => ({
    'Transaction ID': c.id,
    'Date': c.date,
    'Type': c.type.toUpperCase(),
    'Amount ($)': c.amount,
    'Notes': c.notes || ''
  }));
  const wsCapital = XLSX.utils.json_to_sheet(capitalData.length > 0 ? capitalData : [{ 'Transaction ID': '', 'Notes': 'No capital adjustments' }]);
  XLSX.utils.book_append_sheet(wb, wsCapital, 'Capital_Ledger');

  // 3. Accounts Sheet
  const accountsData = accounts.map(a => ({
    'Account ID': a.id,
    'Name': a.name,
    'Currency': a.currency,
    'Starting Capital ($)': a.startingCapital
  }));
  const wsAccounts = XLSX.utils.json_to_sheet(accountsData);
  XLSX.utils.book_append_sheet(wb, wsAccounts, 'Accounts');

  // 4. Instruments Sheet
  const instrumentsData = instruments.map(i => ({
    'Symbol': i.symbol,
    'Name': i.name,
    'Type': i.type,
    'Contract Size': i.contractSize,
    'Min Lot': i.minLot,
    'Max Lot': i.maxLot,
    'Lot Step': i.lotStep,
    'Tick Size': i.tickSize,
    'Tick Value': i.tickValue,
    'Default Risk %': i.defaultRiskPercent,
    'Max Daily Loss ($)': i.maxDailyLoss,
    'Commission ($)': i.defaultCommission,
    'Spread Estimate': i.spreadEstimate
  }));
  const wsInstruments = XLSX.utils.json_to_sheet(instrumentsData);
  XLSX.utils.book_append_sheet(wb, wsInstruments, 'Instruments');

  // 5. Strategies Sheet
  const strategiesData = strategies.map(s => ({
    'Strategy ID': s.id,
    'Name': s.name,
    'Allowed Assets': s.allowedAssets.join(', '),
    'Target R:R': s.targetRR,
    'Max Risk %': s.maxRiskPercent,
    'Is Active': s.isActive ? 'YES' : 'NO',
    'Description': s.description,
    'Entry Rules': s.entryRules,
    'Exit Rules': s.exitRules
  }));
  const wsStrategies = XLSX.utils.json_to_sheet(strategiesData);
  XLSX.utils.book_append_sheet(wb, wsStrategies, 'Strategies');

  // 6. Kill Switch Events Sheet
  const ksData = ksEvents.map(e => ({
    'Event ID': e.id,
    'Timestamp': e.timestamp,
    'Type': e.type.toUpperCase(),
    'Reason': e.reason,
    'Threshold': e.thresholdValue || '',
    'Measured': e.measuredValue || '',
    'Notes': e.userNotes || ''
  }));
  const wsKs = XLSX.utils.json_to_sheet(ksData.length > 0 ? ksData : [{ 'Event ID': '', 'Reason': 'No kill switch events triggered' }]);
  XLSX.utils.book_append_sheet(wb, wsKs, 'Kill_Switch_Events');

  // 7. Audit Log Sheet
  const auditData = auditLogs.map(a => ({
    'Timestamp': a.timestamp,
    'Category': a.category.toUpperCase(),
    'Action': a.action,
    'Details': a.details
  }));
  const wsAudit = XLSX.utils.json_to_sheet(auditData);
  XLSX.utils.book_append_sheet(wb, wsAudit, 'Audit_Log');

  const fileName = `Learner_HAMZA_Data_Workbook_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);

  await logAudit('backup', 'EXCEL_WORKBOOK_EXPORTED', `Exported full Excel workbook containing ${trades.length} trades.`);
  return fileName;
}

/**
 * Import Trades from an Excel (.xlsx) file
 */
export async function importExcelWorkbook(
  fileBuffer: ArrayBuffer,
  mode: 'merge' | 'replace'
): Promise<{ success: boolean; importedTrades: number; duplicatesSkipped: number; message: string }> {
  const wb = XLSX.read(fileBuffer, { type: 'array' });
  const firstSheetName = wb.SheetNames.find(n => n.toLowerCase().includes('trade')) || wb.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('No valid worksheet found in the uploaded workbook.');
  }

  const ws = wb.Sheets[firstSheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(ws);

  if (rows.length === 0) {
    throw new Error('The selected Excel sheet does not contain any data rows.');
  }

  const parsedTrades: Trade[] = [];
  let duplicatesSkipped = 0;
  const existingTradeIds = new Set(await db.trades.toCollection().primaryKeys());

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const tradeId = String(row['Trade ID'] || row['tradeId'] || row['id'] || `trade_imp_${Date.now()}_${i}`);

    if (mode === 'merge' && existingTradeIds.has(tradeId)) {
      duplicatesSkipped++;
      continue;
    }

    const asset = String(row['Asset'] || row['asset'] || row['Symbol'] || 'XAUUSD').toUpperCase();
    const direction = String(row['Direction'] || row['direction'] || 'LONG').toUpperCase() === 'SHORT' ? 'SHORT' : 'LONG';
    const entryPrice = parseFloat(row['Entry Price'] || row['entryPrice'] || 0);
    const exitPrice = row['Exit Price'] || row['exitPrice'] ? parseFloat(row['Exit Price'] || row['exitPrice']) : undefined;
    const stopLossPrice = parseFloat(row['Stop Loss'] || row['stopLossPrice'] || row['SL'] || 0);
    const positionSize = parseFloat(row['Position Size (Lots/Qty)'] || row['positionSize'] || row['Lots'] || 1);
    const contractSize = parseFloat(row['Contract Size'] || row['contractSize'] || (asset.includes('XAU') ? 100 : 1));

    const grossPnL = parseFloat(row['Gross P&L'] || row['grossPnL'] || 0);
    const netPnL = parseFloat(row['Net P&L ($)'] || row['netPnL'] || grossPnL);
    const ruleFollowed = String(row['Rule Followed'] || row['ruleFollowed']).toUpperCase() === 'YES';

    const trade: Trade = {
      id: tradeId,
      accountId: 'acc_primary',
      asset,
      instrumentSymbol: asset,
      direction,
      status: exitPrice ? 'Closed' : 'Open',
      tradeDate: String(row['Date'] || row['tradeDate'] || new Date().toISOString().split('T')[0]),
      entryTime: String(row['Entry Time'] || row['entryTime'] || new Date().toISOString()),
      exitTime: exitPrice ? String(row['Exit Time'] || row['exitTime'] || new Date().toISOString()) : undefined,
      timezone: 'UTC',
      session: (row['Session'] || 'London') as any,
      entryPrice,
      exitPrice,
      stopLossPrice,
      takeProfitPrice: row['Take Profit'] ? parseFloat(row['Take Profit']) : undefined,
      positionSize,
      contractSize,
      entryFees: parseFloat(row['Entry Fees'] || 0),
      exitFees: parseFloat(row['Exit Fees'] || 0),
      swapFundingFees: parseFloat(row['Swap & Financing'] || 0),
      slippage: parseFloat(row['Slippage'] || 0),
      otherCosts: parseFloat(row['Other Costs'] || 0),
      plannedRiskAmount: parseFloat(row['Planned Risk ($)'] || 0),
      plannedRR: row['Planned R:R'] ? parseFloat(row['Planned R:R']) : undefined,
      grossPnL,
      netPnL,
      actualR: row['Actual R'] ? parseFloat(row['Actual R']) : undefined,
      ruleFollowed,
      entryReason: String(row['Entry Reason'] || row['Setup'] || 'Excel imported trade'),
      notes: String(row['Notes'] || ''),
      attachments: [],
      confidenceRating: parseInt(row['Confidence (1-5)'] || '3', 10),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    parsedTrades.push(trade);
  }

  if (mode === 'replace') {
    await db.trades.clear();
    await db.trades.bulkAdd(parsedTrades);
  } else {
    if (parsedTrades.length > 0) {
      await db.trades.bulkAdd(parsedTrades);
    }
  }

  await logAudit('restore', 'EXCEL_IMPORT_COMPLETED', `Imported ${parsedTrades.length} trades from Excel workbook. Mode: ${mode}.`);

  return {
    success: true,
    importedTrades: parsedTrades.length,
    duplicatesSkipped,
    message: `Successfully processed Excel sheet: ${parsedTrades.length} trades imported (${duplicatesSkipped} duplicates skipped).`
  };
}
