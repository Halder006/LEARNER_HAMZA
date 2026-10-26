/**
 * Learner HAMZA - Strategy Lab View
 * Strategy creation, pre-trade checklist builder, and rule compliance tracking
 */

import React, { useState } from 'react';
import {
  FlaskConical,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Archive,
  CheckCircle,
  X,
  Target,
  Shield,
  Layers
} from 'lucide-react';
import { Strategy, Trade } from '../../types';
import { db, logAudit } from '../../db/db';

interface StrategyLabPageProps {
  strategies: Strategy[];
  trades: Trade[];
  onRefreshData: () => void;
}

export const StrategyLabPage: React.FC<StrategyLabPageProps> = ({
  strategies,
  trades,
  onRefreshData
}) => {
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [entryRules, setEntryRules] = useState('');
  const [exitRules, setExitRules] = useState('');
  const [allowedAssets, setAllowedAssets] = useState<string[]>(['XAUUSD', 'BTCUSD']);
  const [maxRiskPercent, setMaxRiskPercent] = useState<number>(1.0);
  const [targetRR, setTargetRR] = useState<number>(2.5);
  const [checklists, setChecklists] = useState<string[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');

  const openCreateModal = () => {
    setEditingStrategy(null);
    setName('');
    setDescription('');
    setEntryRules('');
    setExitRules('');
    setAllowedAssets(['XAUUSD', 'BTCUSD']);
    setMaxRiskPercent(1.0);
    setTargetRR(2.5);
    setChecklists([
      'Higher-Timeframe structural alignment confirmed',
      'Clear liquidity pool swept',
      'Risk is strictly within 1% capital budget',
      'Stop loss placed at technical invalidation'
    ]);
    setIsModalOpen(true);
  };

  const openEditModal = (strat: Strategy) => {
    setEditingStrategy(strat);
    setName(strat.name);
    setDescription(strat.description);
    setEntryRules(strat.entryRules);
    setExitRules(strat.exitRules);
    setAllowedAssets(strat.allowedAssets);
    setMaxRiskPercent(strat.maxRiskPercent);
    setTargetRR(strat.targetRR);
    setChecklists([...strat.checklistItems]);
    setIsModalOpen(true);
  };

  const handleSaveStrategy = async () => {
    if (!name.trim()) {
      alert('Strategy name is required.');
      return;
    }

    const stratRecord: Strategy = {
      id: editingStrategy?.id || `strat_${Date.now()}`,
      name,
      description,
      entryRules,
      exitRules,
      allowedAssets,
      allowedDirections: ['LONG', 'SHORT'],
      maxRiskPercent,
      targetRR,
      checklistItems: checklists,
      isActive: true,
      isArchived: editingStrategy?.isArchived || false,
      createdAt: editingStrategy?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.strategies.put(stratRecord);
    await logAudit(
      'config',
      editingStrategy ? 'STRATEGY_UPDATED' : 'STRATEGY_CREATED',
      `Strategy "${name}" saved with ${checklists.length} checklist items.`,
      stratRecord.id
    );

    setIsModalOpen(false);
    onRefreshData();
  };

  const handleDuplicate = async (strat: Strategy) => {
    const copy: Strategy = {
      ...strat,
      id: `strat_${Date.now()}`,
      name: `${strat.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await db.strategies.add(copy);
    await logAudit('config', 'STRATEGY_DUPLICATED', `Duplicated strategy ${strat.name}`, copy.id);
    onRefreshData();
  };

  const handleArchive = async (strat: Strategy) => {
    await db.strategies.update(strat.id, { isArchived: !strat.isArchived });
    await logAudit('config', 'STRATEGY_ARCHIVE_TOGGLED', `Toggled archive for strategy ${strat.name}`);
    onRefreshData();
  };

  const addChecklistItem = () => {
    if (newChecklistText.trim()) {
      setChecklists(prev => [...prev, newChecklistText.trim()]);
      setNewChecklistText('');
    }
  };

  const removeChecklistItem = (idx: number) => {
    setChecklists(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-blue-400" />
            <span>Strategy Lab & Execution Checklists</span>
          </h2>
          <p className="text-xs text-slate-400">
            Define, test, and enforce trading setups for Gold and Bitcoin
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500 transition"
        >
          <Plus className="h-4 w-4" />
          <span>New Strategy</span>
        </button>
      </div>

      {/* Strategies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {strategies.map(strat => {
          const stratTrades = trades.filter(t => t.strategyId === strat.id && t.status === 'Closed');
          const wins = stratTrades.filter(t => (t.netPnL || 0) > 0).length;
          const winRate = stratTrades.length > 0 ? ((wins / stratTrades.length) * 100).toFixed(0) : '0';
          const netPnL = stratTrades.reduce((sum, t) => sum + (t.netPnL || 0), 0);
          const compliantCount = stratTrades.filter(t => t.ruleFollowed).length;
          const complianceRate = stratTrades.length > 0 ? ((compliantCount / stratTrades.length) * 100).toFixed(0) : '100';

          return (
            <div
              key={strat.id}
              className={`rounded-xl border p-5 flex flex-col justify-between shadow-xs transition ${
                strat.isArchived
                  ? 'border-slate-800 bg-slate-900/40 opacity-60'
                  : 'border-slate-800 bg-[#111C2D] hover:border-slate-700'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                      <span>{strat.name}</span>
                      {strat.isArchived && (
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400 font-normal">
                          Archived
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      {strat.allowedAssets.map(a => (
                        <span
                          key={a}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            a === 'XAUUSD' ? 'bg-amber-500/10 text-amber-400' : 'bg-orange-500/10 text-orange-400'
                          }`}
                        >
                          {a}
                        </span>
                      ))}
                      <span className="text-[10px] text-slate-500">• Target: {strat.targetRR}R</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(strat)}
                      className="rounded p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-800"
                      title="Edit Strategy"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDuplicate(strat)}
                      className="rounded p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                      title="Duplicate Strategy"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleArchive(strat)}
                      className="rounded p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800"
                      title={strat.isArchived ? 'Unarchive' : 'Archive'}
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2">
                  {strat.description || 'No description provided.'}
                </p>

                {/* Performance stats */}
                <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 font-mono text-center">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Trades</div>
                    <div className="text-xs font-bold text-slate-200 mt-0.5">{stratTrades.length}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Win %</div>
                    <div className="text-xs font-bold text-slate-200 mt-0.5">{winRate}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Net P&L</div>
                    <div className={`text-xs font-bold mt-0.5 ${netPnL >= 0 ? 'text-[#20C997]' : 'text-[#FF5263]'}`}>
                      {netPnL >= 0 ? '+' : ''}${netPnL.toFixed(0)}
                    </div>
                  </div>
                </div>

                {/* Checklists Preview */}
                <div className="space-y-1 pt-1">
                  <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-blue-400" />
                    <span>Checklist Requirements ({strat.checklistItems.length}):</span>
                  </div>
                  <div className="space-y-1">
                    {strat.checklistItems.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                        <span className="text-blue-500">•</span>
                        <span className="truncate">{item}</span>
                      </div>
                    ))}
                    {strat.checklistItems.length > 3 && (
                      <div className="text-[10px] text-slate-500 pl-3">
                        +{strat.checklistItems.length - 3} more items...
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-between items-center text-[11px] text-slate-400">
                <span>Discipline Rate: <strong className="text-blue-400">{complianceRate}%</strong></span>
                <span>Max Risk: <strong className="text-slate-200">{strat.maxRiskPercent}%</strong></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Strategy Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 p-4">
              <h3 className="font-bold text-slate-100 text-sm">
                {editingStrategy ? 'Edit Trading Strategy' : 'Create New Strategy'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="rounded p-1 text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-300">Strategy Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Liquidity Sweep & Order Block"
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300">Description & Concept</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-300">Target R:R Multiple</label>
                  <input
                    type="number"
                    step="0.5"
                    value={targetRR}
                    onChange={e => setTargetRR(parseFloat(e.target.value) || 2)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300">Max Allowed Risk %</label>
                  <input
                    type="number"
                    step="0.25"
                    value={maxRiskPercent}
                    onChange={e => setMaxRiskPercent(parseFloat(e.target.value) || 1)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Checklist items */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="font-semibold text-slate-300 block">Pre-Trade Checklist Items</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newChecklistText}
                    onChange={e => setNewChecklistText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addChecklistItem())}
                    placeholder="Add checklist rule..."
                    className="flex-1 rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={addChecklistItem}
                    className="rounded bg-blue-600 px-3 py-1.5 font-bold text-white hover:bg-blue-500"
                  >
                    Add
                  </button>
                </div>

                <div className="space-y-1.5 pt-2">
                  {checklists.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded border border-slate-800 bg-slate-950/60 p-2 text-slate-300"
                    >
                      <span className="flex-1 truncate">{item}</span>
                      <button
                        type="button"
                        onClick={() => removeChecklistItem(idx)}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-800 bg-slate-950 p-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-1.5 font-medium text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStrategy}
                className="rounded-lg bg-blue-600 px-4 py-1.5 font-bold text-white hover:bg-blue-500"
              >
                Save Strategy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
