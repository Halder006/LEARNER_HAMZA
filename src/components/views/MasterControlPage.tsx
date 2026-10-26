/**
 * Learner HAMZA - Master Control Console
 * Capital Management, Dynamic Script Management (Add Solana, Delete Gold/BTC),
 * Kill Switch Master Enable/Disable, and Auto-Scaling Recommended Lot Sizes.
 */

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  DollarSign,
  Coins,
  ShieldAlert,
  Clock,
  Database,
  Save,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2,
  Edit2,
  Power,
  ShieldOff,
  Check,
  X
} from 'lucide-react';
import {
  Account,
  InstrumentConfig,
  KillSwitchSettings,
  AppSettings,
  CapitalTransaction
} from '../../types';
import { db, logAudit, DEFAULT_INSTRUMENTS, DEFAULT_KILL_SWITCH_SETTINGS } from '../../db/db';

interface MasterControlPageProps {
  account: Account | null;
  instruments: Record<string, InstrumentConfig>;
  killSwitchSettings: KillSwitchSettings;
  appSettings: AppSettings;
  tradesCount: number;
  attachmentsCount: number;
  onRefreshData: () => void;
}

export const MasterControlPage: React.FC<MasterControlPageProps> = ({
  account,
  instruments,
  killSwitchSettings,
  appSettings,
  tradesCount,
  attachmentsCount,
  onRefreshData
}) => {
  const [activeTab, setActiveTab] = useState<'capital' | 'instruments' | 'killswitch' | 'reporting' | 'safety'>('capital');

  // Capital State
  const [startingCapital, setStartingCapital] = useState<number>(account?.startingCapital || 10000);
  const [accountName, setAccountName] = useState<string>(account?.name || 'Primary Trading Account');
  const [currency, setCurrency] = useState<string>(account?.currency || 'USD');

  // Kill Switch Master Enable / Disable
  const [isKsEnabled, setIsKsEnabled] = useState<boolean>(killSwitchSettings.isEnabled !== false);
  const [ksSettings, setKsSettings] = useState<KillSwitchSettings>({
    ...killSwitchSettings,
    isEnabled: killSwitchSettings.isEnabled !== false
  });

  // App settings
  const [settings, setSettings] = useState<AppSettings>({ ...appSettings });

  // Capital Transactions history
  const [transactions, setTransactions] = useState<CapitalTransaction[]>([]);
  const [adjType, setAdjType] = useState<'deposit' | 'withdrawal' | 'adjustment'>('deposit');
  const [adjAmount, setAdjAmount] = useState<number>(1000);
  const [adjNotes, setAdjNotes] = useState<string>('');

  // Script / Instrument Management Modal
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [scriptToEdit, setScriptToEdit] = useState<InstrumentConfig | null>(null);

  // Script Form State
  const [scriptSymbol, setScriptSymbol] = useState('');
  const [scriptName, setScriptName] = useState('');
  const [scriptType, setScriptType] = useState<InstrumentConfig['type']>('cfd');
  const [scriptContractSize, setScriptContractSize] = useState<number>(1);
  const [scriptLotStep, setScriptLotStep] = useState<number>(0.01);
  const [scriptTickSize, setScriptTickSize] = useState<number>(0.01);
  const [scriptCommission, setScriptCommission] = useState<number>(0);
  const [scriptRecLot, setScriptRecLot] = useState<number>(0.10);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load Capital Transactions
  const loadTransactions = async () => {
    const list = await db.capitalTransactions.reverse().toArray();
    setTransactions(list);
  };

  useEffect(() => {
    loadTransactions();
    if (account) {
      setStartingCapital(account.startingCapital);
      setAccountName(account.name);
      setCurrency(account.currency);
    }
    setIsKsEnabled(killSwitchSettings.isEnabled !== false);
    setKsSettings({ ...killSwitchSettings, isEnabled: killSwitchSettings.isEnabled !== false });
  }, [account, killSwitchSettings]);

  // Compute Total Deposits & Withdrawals
  const totalDeposits = transactions
    .filter(t => t.type === 'deposit')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalWithdrawals = transactions
    .filter(t => t.type === 'withdrawal')
    .reduce((sum, t) => sum + t.amount, 0);

  const netCapitalAdjustments = totalDeposits - totalWithdrawals;

  // Save Capital Settings
  const handleSaveCapital = async () => {
    setIsSaving(true);
    try {
      const updatedAccount: Account = {
        id: account?.id || 'acc_primary',
        name: accountName,
        currency,
        startingCapital: Number(startingCapital) || 10000,
        createdAt: account?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await db.accounts.put(updatedAccount);
      await logAudit(
        'capital',
        'STARTING_CAPITAL_SAVED',
        `Starting capital updated to $${startingCapital} ${currency}`
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      onRefreshData();
    } finally {
      setIsSaving(false);
    }
  };

  // Record Deposit / Withdrawal
  const handleRecordTransaction = async () => {
    if (adjAmount <= 0) {
      alert('Please enter a valid positive amount.');
      return;
    }

    const tx: CapitalTransaction = {
      id: `tx_${Date.now()}`,
      accountId: account?.id || 'acc_primary',
      type: adjType,
      amount: adjAmount,
      date: new Date().toISOString().split('T')[0],
      notes: adjNotes || `${adjType.toUpperCase()} via Master Control`,
      createdAt: new Date().toISOString()
    };

    await db.capitalTransactions.add(tx);
    await logAudit(
      'capital',
      `CAPITAL_${adjType.toUpperCase()}`,
      `${adjType.toUpperCase()} of $${adjAmount} recorded. Note: ${adjNotes}`
    );

    setAdjAmount(1000);
    setAdjNotes('');
    loadTransactions();
    onRefreshData();
  };

  const handleDeleteTransaction = async (id: string) => {
    if (confirm('Delete this capital adjustment entry?')) {
      await db.capitalTransactions.delete(id);
      loadTransactions();
      onRefreshData();
    }
  };

  // Open Add Script Modal
  const handleOpenAddScript = () => {
    setScriptToEdit(null);
    setScriptSymbol('');
    setScriptName('');
    setScriptType('cfd');
    setScriptContractSize(1);
    setScriptLotStep(0.01);
    setScriptTickSize(0.01);
    setScriptCommission(0);
    setScriptRecLot(0.10);
    setIsScriptModalOpen(true);
  };

  // Open Edit Script Modal
  const handleOpenEditScript = (inst: InstrumentConfig) => {
    setScriptToEdit(inst);
    setScriptSymbol(inst.symbol);
    setScriptName(inst.name);
    setScriptType(inst.type);
    setScriptContractSize(inst.contractSize);
    setScriptLotStep(inst.lotStep);
    setScriptTickSize(inst.tickSize);
    setScriptCommission(inst.defaultCommission);
    setScriptRecLot(inst.fixedRecommendedLot || 0.10);
    setIsScriptModalOpen(true);
  };

  // Save Script (Add / Edit)
  const handleSaveScript = async () => {
    const sym = scriptSymbol.trim().toUpperCase();
    if (!sym) {
      alert('Symbol is required (e.g. SOLUSD, ETHUSD, XAUUSD).');
      return;
    }

    const newInst: InstrumentConfig = {
      symbol: sym,
      name: scriptName.trim() || sym,
      type: scriptType,
      quoteCurrency: 'USD',
      accountCurrency: 'USD',
      contractSize: Number(scriptContractSize) || 1,
      minLot: Number(scriptLotStep) || 0.01,
      maxLot: 100,
      lotStep: Number(scriptLotStep) || 0.01,
      tickSize: Number(scriptTickSize) || 0.01,
      tickValue: Number(scriptTickSize) || 0.01,
      defaultCommission: Number(scriptCommission) || 0,
      spreadEstimate: 0.1,
      slippageEstimate: 0,
      swapCostPerDay: 0,
      defaultRiskPercent: 1.0,
      fixedRecommendedLot: Number(scriptRecLot) || 0.10,
      maxRiskPerTrade: 2.0,
      maxDailyLoss: 500,
      maxOpenPositions: 2,
      permittedSessions: ['London', 'New York', 'Asian', 'London/NY Overlap']
    };

    await db.instruments.put(newInst);
    await logAudit(
      'config',
      scriptToEdit ? 'SCRIPT_MODIFIED' : 'SCRIPT_ADDED',
      `${scriptToEdit ? 'Updated' : 'Added'} instrument ${sym} (${newInst.name}) with recommended lot ${newInst.fixedRecommendedLot}`
    );

    setIsScriptModalOpen(false);
    onRefreshData();
  };

  // Delete Script (Delete Gold, BTC, Solana, etc.)
  const handleDeleteScript = async (symbol: string) => {
    if (confirm(`Are you sure you want to delete script "${symbol}" from your instruments? It will no longer appear in Trade Entry buttons.`)) {
      await db.instruments.delete(symbol);
      await logAudit('config', 'SCRIPT_DELETED', `Deleted instrument ${symbol}`);
      onRefreshData();
    }
  };

  // Save Kill Switch Rules (including Enable / Disable master toggle)
  const handleSaveKillSwitch = async (enabledState?: boolean) => {
    setIsSaving(true);
    try {
      const updated: KillSwitchSettings = {
        ...ksSettings,
        isEnabled: enabledState !== undefined ? enabledState : isKsEnabled
      };
      await db.settings.put({ key: 'killSwitchSettings', value: updated });
      setKsSettings(updated);
      setIsKsEnabled(updated.isEnabled);

      await logAudit(
        'config',
        updated.isEnabled ? 'KILL_SWITCH_ENABLED' : 'KILL_SWITCH_DISABLED',
        `Kill switch status set to ${updated.isEnabled ? 'ENABLED' : 'DISABLED'} in Master Control.`
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      onRefreshData();
    } finally {
      setIsSaving(false);
    }
  };

  // Dedicated Emergency Lockout Disengage (Only allowed from Master Control!)
  const handleDisengageEmergencyLock = async () => {
    setIsSaving(true);
    try {
      const updated: KillSwitchSettings = {
        ...ksSettings,
        emergencyLockActive: false,
        emergencyLockReason: undefined,
        emergencyLockTimestamp: undefined
      };
      await db.settings.put({ key: 'killSwitchSettings', value: updated });
      setKsSettings(updated);
      await logAudit(
        'kill_switch',
        'EMERGENCY_LOCK_DISENGAGED',
        'Emergency lockout disengaged and workstation unlocked via Master Control.'
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      onRefreshData();
    } finally {
      setIsSaving(false);
    }
  };

  // Save App Settings
  const handleSaveAppSettings = async () => {
    setIsSaving(true);
    try {
      await db.settings.put({ key: 'appSettings', value: settings });
      await logAudit('config', 'APP_SETTINGS_UPDATED', 'Updated application preferences and timezone rollover.');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      onRefreshData();
    } finally {
      setIsSaving(false);
    }
  };

  // Factory Defaults Reset
  const handleResetDefaults = async () => {
    if (confirm('Restore Gold & Bitcoin specifications and factory risk rules? Your trade history will NOT be deleted.')) {
      await db.instruments.bulkPut(Object.values(DEFAULT_INSTRUMENTS));
      await db.settings.put({ key: 'killSwitchSettings', value: DEFAULT_KILL_SWITCH_SETTINGS });
      await logAudit('config', 'FACTORY_RESET', 'Restored default instruments and kill switch rules.');
      onRefreshData();
    }
  };

  const instrumentList = Object.values(instruments);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Sliders className="h-5 w-5 text-blue-400" />
            <span>Master Control Console</span>
          </h2>
          <p className="text-xs text-slate-400">
            Manage capital, add/delete scripts (e.g. Solana, Gold), and toggle Kill Switch
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="h-4 w-4" />
            <span>Changes Saved Successfully</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-800 bg-[#111C2D] p-1.5 text-xs">
        <button
          onClick={() => setActiveTab('capital')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 font-semibold transition ${
            activeTab === 'capital' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <DollarSign className="h-3.5 w-3.5" />
          <span>A. Capital & Cashflow</span>
        </button>

        <button
          onClick={() => setActiveTab('instruments')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 font-semibold transition ${
            activeTab === 'instruments' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Coins className="h-3.5 w-3.5" />
          <span>B. Scripts & Instruments ({instrumentList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('killswitch')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 font-semibold transition ${
            activeTab === 'killswitch' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>C. Kill Switch Toggle & Rules</span>
        </button>

        <button
          onClick={() => setActiveTab('reporting')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 font-semibold transition ${
            activeTab === 'reporting' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>D. Timezone & Rollover</span>
        </button>

        <button
          onClick={() => setActiveTab('safety')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 font-semibold transition ${
            activeTab === 'safety' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="h-3.5 w-3.5" />
          <span>E. Database Health</span>
        </button>
      </div>

      {/* Tab A: Capital & Cashflow */}
      {activeTab === 'capital' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2">
              1. Base Capital & Currency
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-300">Account Name</label>
                <input
                  type="text"
                  value={accountName}
                  onChange={e => setAccountName(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300">Account Currency</label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 font-mono"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-300">Starting Reference Capital ($)</label>
                <input
                  type="number"
                  value={startingCapital}
                  onChange={e => setStartingCapital(parseFloat(e.target.value) || 0)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 font-mono font-bold focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleSaveCapital}
                disabled={isSaving}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500 transition"
              >
                <Save className="h-4 w-4" />
                <span>Save Capital</span>
              </button>
            </div>
          </div>

          {/* Deposits & Withdrawals Ledger */}
          <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                2. Capital Deposits & Withdrawals
              </h3>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span>Deposits: <strong className="text-emerald-400">+${totalDeposits.toLocaleString()}</strong></span>
                <span>Withdrawals: <strong className="text-rose-400">-${totalWithdrawals.toLocaleString()}</strong></span>
                <span>Net Cashflow: <strong className="text-blue-400">${netCapitalAdjustments.toLocaleString()}</strong></span>
              </div>
            </div>

            {/* Input Row */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-slate-400 font-medium">Type</label>
                <select
                  value={adjType}
                  onChange={e => setAdjType(e.target.value as any)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-slate-200"
                >
                  <option value="deposit">Deposit (+)</option>
                  <option value="withdrawal">Withdrawal (-)</option>
                  <option value="adjustment">Capital Adjustment</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-medium">Amount ($)</label>
                <input
                  type="number"
                  value={adjAmount}
                  onChange={e => setAdjAmount(parseFloat(e.target.value) || 0)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-slate-100 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-slate-400 font-medium">Note / Purpose</label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    value={adjNotes}
                    onChange={e => setAdjNotes(e.target.value)}
                    placeholder="e.g. Added deposit funds, payout withdrawal..."
                    className="flex-1 rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-slate-100"
                  />
                  <button
                    onClick={handleRecordTransaction}
                    className="rounded-lg bg-emerald-600 px-4 py-1.5 font-bold text-white hover:bg-emerald-500 shadow"
                  >
                    Record
                  </button>
                </div>
              </div>
            </div>

            {/* Ledger Table */}
            {transactions.length > 0 && (
              <div className="overflow-x-auto pt-2">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="border-b border-slate-800 bg-slate-900/40 text-[10px] uppercase text-slate-400">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Amount</th>
                      <th className="py-2 px-3">Notes</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {transactions.map(t => (
                      <tr key={t.id}>
                        <td className="py-2 px-3 text-slate-300">{t.date}</td>
                        <td className="py-2 px-3">
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                            t.type === 'deposit'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {t.type}
                          </span>
                        </td>
                        <td className={`py-2 px-3 font-bold ${
                          t.type === 'deposit' ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {t.type === 'deposit' ? '+' : '-'}${t.amount.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-slate-400 font-sans">{t.notes}</td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => handleDeleteTransaction(t.id)}
                            className="text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab B: Dynamic Scripts & Instruments (Add Solana, Delete Gold/BTC) */}
      {activeTab === 'instruments' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Configured Trading Scripts / Instruments
                </h3>
                <p className="text-xs text-slate-400">
                  Add new assets (e.g. Solana SOLUSD, ETHUSD, US30) or delete existing ones. These appear directly in Trade Entry.
                </p>
              </div>

              <button
                onClick={handleOpenAddScript}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition"
              >
                <Plus className="h-4 w-4" />
                <span>Add New Script (e.g. SOLANA)</span>
              </button>
            </div>

            {/* Scripts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {instrumentList.map(inst => (
                <div
                  key={inst.symbol}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 relative group hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-100 font-mono">
                          {inst.symbol}
                        </span>
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] uppercase font-bold text-slate-400">
                          {inst.type}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{inst.name}</div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditScript(inst)}
                        className="rounded p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-800"
                        title="Edit Script"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteScript(inst.symbol)}
                        className="rounded p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                        title="Delete Script"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono rounded bg-slate-950/60 p-2.5">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Recommended Lot:</span>
                      <span className="font-bold text-amber-300">
                        {inst.fixedRecommendedLot ?? 0.10}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Contract Size:</span>
                      <span className="text-slate-200">{inst.contractSize}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Lot Step:</span>
                      <span className="text-slate-200">{inst.lotStep}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Commission:</span>
                      <span className="text-slate-200">${inst.defaultCommission}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab C: Kill Switch Toggle & Rules (Disable/Enable from Master Control) */}
      {activeTab === 'killswitch' && (
        <div className="space-y-5">
          {/* EMERGENCY LOCKOUT STATUS & UNLOCK MODULE */}
          {ksSettings.emergencyLockActive ? (
            <div className="rounded-xl border-2 border-rose-500/80 bg-rose-950/40 p-5 shadow-lg shadow-rose-950/40 animate-pulse">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-3 w-3 rounded-full bg-rose-500 animate-ping" />
                    <h3 className="text-sm font-extrabold text-rose-300 uppercase tracking-wider">
                      Workstation Emergency Lockout Active!
                    </h3>
                  </div>
                  <p className="text-xs text-rose-200/90 max-w-xl">
                    The terminal hardware Kill Switch was engaged to protect capital. In accordance with strict risk management rules, 
                    <strong> this lockout can ONLY be disabled here in Master Control.</strong>
                  </p>
                  {ksSettings.emergencyLockTimestamp && (
                    <div className="text-[11px] font-mono text-rose-300/70">
                      Engaged At: {new Date(ksSettings.emergencyLockTimestamp).toLocaleString()}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleDisengageEmergencyLock}
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-emerald-700/30 hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition disabled:opacity-50 shrink-0"
                >
                  <Power className="h-4 w-4" />
                  <span>DISENGAGE LOCK & UNLOCK TERMINAL</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-emerald-300">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>Workstation is currently <strong>UNLOCKED</strong> and trading entries are active.</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Holding the Big Header Button will engage the emergency lock.
              </span>
            </div>
          )}

          {/* MASTER KILL SWITCH ON / OFF TOGGLE */}
          <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-400" />
                  <span>Master Kill Switch Control</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enable or completely disable the Kill Switch system across the entire application
                </p>
              </div>

              {/* Master Enable/Disable Toggle */}
              <button
                type="button"
                onClick={() => {
                  const newState = !isKsEnabled;
                  setIsKsEnabled(newState);
                  handleSaveKillSwitch(newState);
                }}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-extrabold transition shadow-md ${
                  isKsEnabled
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-emerald-500/20 ring-1 ring-emerald-500'
                    : 'border-slate-700 bg-slate-800 text-slate-400'
                }`}
              >
                {isKsEnabled ? (
                  <>
                    <Power className="h-4 w-4 text-emerald-400" />
                    <span>KILL SWITCH: ENABLED / ARMED</span>
                  </>
                ) : (
                  <>
                    <ShieldOff className="h-4 w-4 text-slate-500" />
                    <span>KILL SWITCH: DISABLED (OFF)</span>
                  </>
                )}
              </button>
            </div>

            {!isKsEnabled && (
              <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3.5 text-xs text-slate-300 flex items-center gap-2">
                <ShieldOff className="h-4 w-4 text-slate-400 shrink-0" />
                <span>
                  Kill Switch is currently <strong>DISABLED</strong>. Trading lockouts and tilt alerts will not block your journal entries.
                </span>
              </div>
            )}

            {/* Threshold Rules */}
            <div className={`space-y-4 ${!isKsEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="font-semibold text-slate-300">Max Daily Net Loss ($)</label>
                  <input
                    type="number"
                    value={ksSettings.maxDailyNetLoss}
                    onChange={e => setKsSettings(k => ({ ...k, maxDailyNetLoss: parseFloat(e.target.value) || 0 }))}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300">Max Daily Drawdown (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={ksSettings.maxDailyDrawdownPercent}
                    onChange={e => setKsSettings(k => ({ ...k, maxDailyDrawdownPercent: parseFloat(e.target.value) || 0 }))}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300">Consecutive Losses (Tilt Trigger)</label>
                  <input
                    type="number"
                    value={ksSettings.maxConsecutiveLosses}
                    onChange={e => setKsSettings(k => ({ ...k, maxConsecutiveLosses: parseInt(e.target.value, 10) || 0 }))}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => handleSaveKillSwitch()}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-500 transition"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Kill Switch Settings</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab D: Rollover & Timezones */}
      {activeTab === 'reporting' && (
        <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2">
            Timezone & Rollover Preferences
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-300">Trading Timezone</label>
              <input
                type="text"
                value={settings.timezone}
                onChange={e => setSettings(s => ({ ...s, timezone: e.target.value }))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-300">Daily Rollover Hour (UTC)</label>
              <input
                type="number"
                min="0"
                max="23"
                value={settings.rolloverHourUTC}
                onChange={e => setSettings(s => ({ ...s, rolloverHourUTC: parseInt(e.target.value, 10) || 0 }))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-300">Default P&L Display</label>
              <select
                value={settings.grossVsNetDisplay}
                onChange={e => setSettings(s => ({ ...s, grossVsNetDisplay: e.target.value as any }))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100"
              >
                <option value="net">Net P&L (After all costs)</option>
                <option value="gross">Gross P&L</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleSaveAppSettings}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-500 transition"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save Timezone Preferences</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab E: Safety */}
      {activeTab === 'safety' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-800 bg-[#111C2D] p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2">
              Database & Offline Storage
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                <span className="text-slate-500 uppercase text-[10px]">Total Trades</span>
                <div className="text-base font-bold text-slate-200 mt-1">{tradesCount}</div>
              </div>
              <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                <span className="text-slate-500 uppercase text-[10px]">Screenshots</span>
                <div className="text-base font-bold text-slate-200 mt-1">{attachmentsCount}</div>
              </div>
              <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                <span className="text-slate-500 uppercase text-[10px]">IndexedDB</span>
                <div className="text-base font-bold text-emerald-400 mt-1">Healthy</div>
              </div>
              <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                <span className="text-slate-500 uppercase text-[10px]">Cloud Dependency</span>
                <div className="text-base font-bold text-blue-400 mt-1">None (Offline)</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-red-900/30 bg-red-950/10 p-5 space-y-3">
            <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
              <AlertTriangle className="h-4 w-4" />
              <span>Restore Factory Defaults</span>
            </div>
            <p className="text-xs text-slate-400">
              Restores Gold & Bitcoin instrument profiles and baseline risk rules. Historical trades will NOT be touched.
            </p>
            <button
              onClick={handleResetDefaults}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-950/30 px-3.5 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-900/40 transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Restore Factory Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* Script Modal (Add or Edit Script) */}
      {isScriptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 p-4">
              <h3 className="font-bold text-slate-100 text-sm">
                {scriptToEdit ? `Edit Script (${scriptToEdit.symbol})` : 'Add New Trading Script'}
              </h3>
              <button onClick={() => setIsScriptModalOpen(false)} className="rounded p-1 text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-300">Symbol (e.g. SOLUSD)</label>
                  <input
                    type="text"
                    value={scriptSymbol}
                    disabled={Boolean(scriptToEdit)}
                    onChange={e => setScriptSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g. SOLUSD, ETHUSD"
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 font-mono font-bold uppercase focus:outline-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300">Display Name</label>
                  <input
                    type="text"
                    value={scriptName}
                    onChange={e => setScriptName(e.target.value)}
                    placeholder="e.g. Solana / US Dollar"
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-amber-300">Pre-set Recommended Lot</label>
                  <input
                    type="number"
                    step="0.01"
                    value={scriptRecLot}
                    onChange={e => setScriptRecLot(parseFloat(e.target.value) || 0.01)}
                    className="mt-1 w-full rounded border border-amber-500/50 bg-slate-800 px-3 py-1.5 text-amber-200 font-mono font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300">Contract Multiplier</label>
                  <input
                    type="number"
                    step="any"
                    value={scriptContractSize}
                    onChange={e => setScriptContractSize(parseFloat(e.target.value) || 1)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-300">Quantity Step Size</label>
                  <input
                    type="number"
                    step="0.001"
                    value={scriptLotStep}
                    onChange={e => setScriptLotStep(parseFloat(e.target.value) || 0.01)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300">Tick Size ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={scriptTickSize}
                    onChange={e => setScriptTickSize(parseFloat(e.target.value) || 0.01)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 font-mono focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-800 bg-slate-950 p-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsScriptModalOpen(false)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-1.5 font-medium text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveScript}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 font-bold text-white hover:bg-emerald-500 shadow"
              >
                {scriptToEdit ? 'Update Script' : 'Add Script'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
