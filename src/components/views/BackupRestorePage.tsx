/**
 * Learner HAMZA - Lifetime Backup & Restore Engine
 * One-click JSON backup (with attachments) and multi-sheet Excel (.xlsx) round-trip
 */

import React, { useState } from 'react';
import {
  Database,
  Download,
  Upload,
  FileSpreadsheet,
  FileCode,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Info,
  Trash2,
  ShieldAlert,
  X
} from 'lucide-react';
import { db, logAudit } from '../../db/db';
import {
  exportFullBackupJSON,
  importFullBackupJSON,
  exportExcelWorkbook,
  importExcelWorkbook,
  CURRENT_SCHEMA_VERSION,
  APP_VERSION
} from '../../services/exportImportService';

interface BackupRestorePageProps {
  tradesCount: number;
  attachmentsCount: number;
  lastBackupTimestamp?: string;
  onRefreshData: () => void;
}

export const BackupRestorePage: React.FC<BackupRestorePageProps> = ({
  tradesCount,
  attachmentsCount,
  lastBackupTimestamp,
  onRefreshData
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
    details?: string;
  }>({ type: null, message: '' });

  // Import Mode selection
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

  // 3-Step Delete All Data Wipe State
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [wipeStep, setWipeStep] = useState<1 | 2 | 3>(1);
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [isWiping, setIsWiping] = useState(false);

  // Execute 3-step confirmed factory wipe
  const handleExecuteWipe = async () => {
    setIsWiping(true);
    try {
      await db.transaction(
        'rw',
        [
          db.trades,
          db.attachments,
          db.capitalTransactions,
          db.killSwitchEvents,
          db.auditLogs,
          db.accounts
        ],
        async () => {
          await Promise.all([
            db.trades.clear(),
            db.attachments.clear(),
            db.capitalTransactions.clear(),
            db.killSwitchEvents.clear(),
            db.auditLogs.clear()
          ]);
          // Reset primary account
          await db.accounts.put({
            id: 'acc_primary',
            name: 'Primary Trading Account',
            currency: 'USD',
            startingCapital: 10000,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      );

      await logAudit(
        'system',
        'ALL_DATA_WIPED',
        'Factory wipe executed: All trades, screenshot images, and ledger entries permanently deleted after 3-step confirmation.'
      );

      setImportStatus({
        type: 'success',
        message: 'All application data, trades, and screenshot images have been permanently deleted.',
        details: 'The database has been cleanly reset to factory zero state.'
      });
      setIsWipeModalOpen(false);
      setWipeStep(1);
      setWipeConfirmText('');
      onRefreshData();
    } catch (err: any) {
      setImportStatus({
        type: 'error',
        message: 'Failed to complete data wipe.',
        details: err.message
      });
    } finally {
      setIsWiping(false);
    }
  };

  // Handle Full JSON Export
  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      const res = await exportFullBackupJSON();
      setImportStatus({
        type: 'success',
        message: `Complete backup exported successfully as "${res.fileName}" (${(res.sizeBytes / 1024).toFixed(1)} KB).`,
        details: `Saved ${res.stats.tradeCount} trades and ${res.stats.attachmentCount} attachments with schema ${CURRENT_SCHEMA_VERSION}.`
      });
      onRefreshData();
    } catch (err: any) {
      setImportStatus({
        type: 'error',
        message: 'Failed to generate JSON backup.',
        details: err.message
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Excel Export
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const fileName = await exportExcelWorkbook();
      setImportStatus({
        type: 'success',
        message: `Multi-sheet Excel workbook exported successfully as "${fileName}".`,
        details: 'Includes Trades, Accounts, Capital Ledger, Instruments, Strategies, Kill Switch, and Audit sheets.'
      });
    } catch (err: any) {
      setImportStatus({
        type: 'error',
        message: 'Failed to export Excel workbook.',
        details: err.message
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Handle JSON Import
  const handleJSONFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (importMode === 'replace') {
      const confirmed = confirm(
        'WARNING: You selected Replace Mode. This will completely overwrite your existing local database with the contents of this backup file. Are you sure you wish to proceed?'
      );
      if (!confirmed) {
        e.target.value = '';
        return;
      }
    }

    setIsImporting(true);
    setImportStatus({ type: null, message: '' });

    try {
      const text = await file.text();
      const res = await importFullBackupJSON(text, importMode);
      setImportStatus({
        type: 'success',
        message: res.message,
        details: `Import completed via ${importMode.toUpperCase()} mode. ${res.importedTrades} trades processed.`
      });
      onRefreshData();
    } catch (err: any) {
      setImportStatus({
        type: 'error',
        message: 'Failed to restore JSON backup.',
        details: err.message
      });
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  // Handle Excel Import
  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (importMode === 'replace') {
      const confirmed = confirm(
        'WARNING: Replace Mode selected. This will clear existing trades and import rows from the selected Excel sheet. Continue?'
      );
      if (!confirmed) {
        e.target.value = '';
        return;
      }
    }

    setIsImporting(true);
    setImportStatus({ type: null, message: '' });

    try {
      const buffer = await file.arrayBuffer();
      const res = await importExcelWorkbook(buffer, importMode);
      setImportStatus({
        type: 'success',
        message: res.message,
        details: `${res.importedTrades} rows successfully parsed and inserted into local IndexedDB.`
      });
      onRefreshData();
    } catch (err: any) {
      setImportStatus({
        type: 'error',
        message: 'Failed to import Excel workbook.',
        details: err.message
      });
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-400" />
            <span>Lifetime Backup, Excel Export & Restoration</span>
          </h2>
          <p className="text-xs text-slate-400">
            Export complete snapshots before updates and restore historical records with zero data loss
          </p>
        </div>

        <div className="text-right text-xs font-mono text-slate-400">
          <div>Schema: <strong className="text-blue-400">v{CURRENT_SCHEMA_VERSION}</strong> (App v{APP_VERSION})</div>
          <div>Last Backup: {lastBackupTimestamp ? new Date(lastBackupTimestamp).toLocaleDateString() : 'Never'}</div>
        </div>
      </div>

      {/* Status Alert Banner */}
      {importStatus.type && (
        <div
          className={`rounded-xl border p-4 flex items-start gap-3 text-xs ${
            importStatus.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300'
              : 'border-rose-500/40 bg-rose-950/20 text-rose-300'
          }`}
        >
          {importStatus.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
          )}
          <div>
            <div className="font-bold text-slate-100">{importStatus.message}</div>
            {importStatus.details && <div className="mt-0.5 text-[11px] opacity-90">{importStatus.details}</div>}
          </div>
        </div>
      )}

      {/* Export Section */}
      <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2">
          1. Export Data Snapshots
        </h3>
        <p className="text-xs text-slate-400">
          We recommend taking an export before making major browser updates or clearing device cache. All operations run 100% locally in your browser.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Complete JSON Backup */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-950/10 p-4 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
                <FileCode className="h-4 w-4" />
                <span>Complete JSON Backup (Canonical)</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Full snapshot of everything: all {tradesCount} trades, risk rules, strategies, audit logs, and {attachmentsCount} chart screenshots.
              </p>
            </div>
            <button
              onClick={handleExportJSON}
              disabled={isExporting}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500 disabled:opacity-40 transition"
            >
              <Download className="h-4 w-4" />
              <span>Export Complete JSON Backup</span>
            </button>
          </div>

          {/* Excel Workbook Export */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <FileSpreadsheet className="h-4 w-4" />
                <span>Excel Spreadsheet Workbook (.xlsx)</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Multi-sheet Excel workbook with formatted sheets for Trades, Accounts, Capital Ledger, Instruments, Strategies, and Audit trail.
              </p>
            </div>
            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 disabled:opacity-40 transition"
            >
              <Download className="h-4 w-4" />
              <span>Export Multi-Sheet Excel (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Import Section */}
      <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-5 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2">
          2. Restore & Import Data
        </h3>

        {/* Mode Selector */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
            Import Conflict Resolution Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
            <button
              type="button"
              onClick={() => setImportMode('merge')}
              className={`rounded-lg border p-3 text-left transition ${
                importMode === 'merge'
                  ? 'border-blue-500 bg-blue-950/20 text-blue-200'
                  : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5 text-slate-100">
                <RefreshCw className="h-3.5 w-3.5 text-blue-400" />
                <span>Merge Mode (Recommended)</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Adds new trades using stable IDs and skips duplicates. Preserves your existing current records safely.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setImportMode('replace')}
              className={`rounded-lg border p-3 text-left transition ${
                importMode === 'replace'
                  ? 'border-rose-500 bg-rose-950/20 text-rose-200'
                  : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5 text-slate-100">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                <span>Restore / Replace Mode</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Completely replaces current dataset with the imported file. Requires confirmation before execution.
              </p>
            </button>
          </div>
        </div>

        {/* Upload Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Import JSON */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
            <div className="font-semibold text-slate-300 text-xs">Restore from JSON Backup File</div>
            <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-700 bg-slate-900/60 p-5 cursor-pointer hover:border-slate-500 transition">
              <Upload className="h-6 w-6 text-blue-400" />
              <span className="mt-2 text-xs font-semibold text-slate-200">Select JSON Backup</span>
              <span className="text-[10px] text-slate-500 mt-0.5">Learner_HAMZA_Full_Backup_*.json</span>
              <input
                type="file"
                accept=".json"
                onChange={handleJSONFileChange}
                disabled={isImporting}
                className="hidden"
              />
            </label>
          </div>

          {/* Import Excel */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
            <div className="font-semibold text-slate-300 text-xs">Import from Excel Workbook (.xlsx)</div>
            <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-700 bg-slate-900/60 p-5 cursor-pointer hover:border-slate-500 transition">
              <Upload className="h-6 w-6 text-emerald-400" />
              <span className="mt-2 text-xs font-semibold text-slate-200">Select Excel Workbook</span>
              <span className="text-[10px] text-slate-500 mt-0.5">.xlsx spreadsheet with Trades sheet</span>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleExcelFileChange}
                disabled={isImporting}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* 3. Factory Wipe: Delete All Data & Images */}
      <div className="rounded-xl border border-rose-900/40 bg-rose-950/15 p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              <span>3. Factory Wipe / Delete All Data & Images</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Permanently delete all {tradesCount} trade records, {attachmentsCount} screenshot images, balance history, and reset terminal to zero state.
              Protected by a strict 3-step warning and verification sequence.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setWipeStep(1);
              setWipeConfirmText('');
              setIsWipeModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl border border-rose-700/60 bg-rose-600/20 px-4 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-600 hover:text-white transition shadow-sm shrink-0"
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete All Application Data</span>
          </button>
        </div>
      </div>

      {/* 3-STEP DELETE ALL DATA MODAL */}
      {isWipeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-rose-600/60 bg-[#0F172A] p-6 shadow-2xl shadow-rose-950/60 space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 text-rose-400">
                <ShieldAlert className="h-5 w-5 shrink-0" />
                <div>
                  <h3 className="font-extrabold text-sm text-slate-100">
                    Delete All Application Data & Images
                  </h3>
                  <div className="text-[11px] font-mono text-rose-400/80">
                    Step {wipeStep} of 3 Confirmation Required
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isWiping) setIsWipeModalOpen(false);
                }}
                disabled={isWiping}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Step Progress Indicators */}
            <div className="grid grid-cols-3 gap-2">
              <div
                className={`h-1.5 rounded-full ${
                  wipeStep >= 1 ? 'bg-rose-500' : 'bg-slate-800'
                }`}
              />
              <div
                className={`h-1.5 rounded-full ${
                  wipeStep >= 2 ? 'bg-rose-500' : 'bg-slate-800'
                }`}
              />
              <div
                className={`h-1.5 rounded-full ${
                  wipeStep === 3 ? 'bg-rose-500 animate-pulse' : 'bg-slate-800'
                }`}
              />
            </div>

            {/* STEP 1: WARNING AND IMPACT */}
            {wipeStep === 1 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-xs space-y-2 text-rose-200">
                  <div className="font-bold text-slate-100 flex items-center gap-1.5 text-xs uppercase tracking-wide">
                    <AlertTriangle className="h-4 w-4 text-rose-400" />
                    <span>Warning: Irreversible Data Loss</span>
                  </div>
                  <p>
                    You are requesting to wipe the local database. The following items will be <strong>permanently deleted</strong> from your browser:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-300">
                    <li>All <strong>{tradesCount}</strong> logged trades and notes</li>
                    <li>All <strong>{attachmentsCount}</strong> chart screenshot images and photos</li>
                    <li>All capital deposits, withdrawals, and balance history</li>
                    <li>All Kill Switch trigger history and audit records</li>
                  </ul>
                  <p className="text-[11px] text-amber-300/90 pt-1">
                    Tip: If you haven't already, please export a <strong>Complete JSON Backup</strong> above first.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsWipeModalOpen(false)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                  >
                    Cancel / Keep My Data
                  </button>
                  <button
                    type="button"
                    onClick={() => setWipeStep(2)}
                    className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500"
                  >
                    <span>I Understand the Risks, Proceed to Step 2 →</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: PHRASE VERIFICATION */}
            {wipeStep === 2 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-xs space-y-3">
                  <div className="font-bold text-slate-200">
                    Step 2: Type verification phrase to prevent accidental deletion
                  </div>
                  <p className="text-slate-400">
                    Please type <strong className="text-rose-400 font-mono bg-rose-950/50 px-1.5 py-0.5 rounded border border-rose-800/40">DELETE ALL DATA</strong> in the box below to proceed:
                  </p>
                  <input
                    type="text"
                    value={wipeConfirmText}
                    onChange={e => setWipeConfirmText(e.target.value)}
                    placeholder="Type DELETE ALL DATA"
                    autoFocus
                    className="w-full rounded-lg border border-rose-600/50 bg-slate-950 px-3 py-2 text-xs font-mono text-rose-300 placeholder-slate-600 focus:outline-none focus:border-rose-400"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setWipeStep(1)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                  >
                    ← Back to Step 1
                  </button>
                  <button
                    type="button"
                    disabled={wipeConfirmText.trim() !== 'DELETE ALL DATA'}
                    onClick={() => setWipeStep(3)}
                    className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>Verify & Proceed to Final Step →</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: FINAL IRREVERSIBLE CONFIRMATION */}
            {wipeStep === 3 && (
              <div className="space-y-4">
                <div className="rounded-xl border-2 border-rose-500 bg-rose-950/40 p-4 text-xs space-y-2 text-rose-200 animate-pulse">
                  <div className="font-black text-rose-300 uppercase tracking-wider text-xs">
                    ⚠️ Step 3 of 3: Final Execution Confirmation
                  </div>
                  <p className="font-semibold text-slate-100">
                    This is your last chance to cancel. Once executed, all trades, images, and history will be instantly erased from IndexedDB.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsWipeModalOpen(false);
                      setWipeStep(1);
                      setWipeConfirmText('');
                    }}
                    disabled={isWiping}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                  >
                    Cancel / Abort
                  </button>

                  <button
                    type="button"
                    onClick={handleExecuteWipe}
                    disabled={isWiping}
                    className="flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2 text-xs font-black text-white hover:bg-rose-500 shadow-lg shadow-rose-900/50 disabled:opacity-50"
                  >
                    {isWiping ? (
                      <>
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Purging All Data...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        <span>PERMANENTLY DELETE EVERYTHING NOW</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
