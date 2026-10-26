/**
 * Learner HAMZA - Settings & Immutable Audit Trail View
 * 100% Local-First event audit history and application information
 */

import React, { useState, useEffect } from 'react';
import {
  Settings,
  History,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  Trash2,
  Database
} from 'lucide-react';
import { AuditLogEntry, AppSettings, KillSwitchSettings } from '../../types';
import { db, logAudit } from '../../db/db';

interface SettingsAuditLogPageProps {
  appSettings: AppSettings;
  killSwitchSettings: KillSwitchSettings;
  onRefreshData: () => void;
}

export const SettingsAuditLogPage: React.FC<SettingsAuditLogPageProps> = ({
  appSettings,
  killSwitchSettings,
  onRefreshData
}) => {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadLogs = async () => {
    const list = await db.auditLogs.orderBy('timestamp').reverse().limit(300).toArray();
    setAuditLogs(list);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = auditLogs.filter(log => {
    if (categoryFilter !== 'ALL' && log.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchAction = log.action.toLowerCase().includes(q);
      const matchDetails = log.details.toLowerCase().includes(q);
      const matchId = (log.recordId || '').toLowerCase().includes(q);
      if (!matchAction && !matchDetails && !matchId) return false;
    }
    return true;
  });

  const handleClearAuditLogs = async () => {
    if (confirm('Clear audit history? (This will not delete any trade records).')) {
      await db.auditLogs.clear();
      await logAudit('system', 'AUDIT_LOG_RESET', 'Cleared prior audit log history.');
      loadLogs();
      onRefreshData();
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <History className="h-5 w-5 text-blue-400" />
            <span>Audit Trail & Activity Log</span>
          </h2>
          <p className="text-xs text-slate-400">
            Immutable chronological record of trade edits, capital adjustments and risk trigger events
          </p>
        </div>

        <button
          onClick={handleClearAuditLogs}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Clear Audit Log</span>
        </button>
      </div>

      {/* Filter Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-slate-800 bg-[#111C2D] p-3.5 text-xs">
        <div className="col-span-2 relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search action names, trade IDs, details..."
            className="w-full rounded border border-slate-700 bg-slate-800/80 pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="rounded border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
        >
          <option value="ALL">All Event Categories</option>
          <option value="trade">Trade Executions & Edits</option>
          <option value="kill_switch">Kill Switch Events</option>
          <option value="capital">Capital Ledger Changes</option>
          <option value="config">System Configurations</option>
          <option value="backup">Backups & Restores</option>
          <option value="system">System Events</option>
        </select>
      </div>

      {/* Audit Logs Table */}
      <div className="rounded-xl border border-slate-800 bg-[#111C2D] overflow-hidden shadow-xs">
        {filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            No audit events found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-slate-800 bg-slate-900/50 text-[10px] uppercase text-slate-400 font-bold">
                <tr>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-4 font-sans">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {log.timestamp.replace('T', ' ').substring(0, 19)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase font-mono ${
                        log.category === 'kill_switch'
                          ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                          : log.category === 'trade'
                          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          : log.category === 'capital'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-700/50 text-slate-300 border border-slate-600/30'
                      }`}>
                        {log.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[11px] text-slate-200">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-4 text-slate-300 text-xs">{log.details}</td>
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
