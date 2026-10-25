import React, { useState } from 'react';
import {
  FileCode,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  Plus,
  Filter,
  Layers,
  Copy,
  Check,
  Search,
  Sparkles,
  Zap,
  Play,
} from 'lucide-react';
import { Transaction, TransactionStatus } from '../types';
import { api } from '../services/api';

interface TransactionExplorerProps {
  transactions: Transaction[];
  onRefresh: () => void;
  isOpenModal: boolean;
  onCloseModal: () => void;
}

const PRESET_TEMPLATES = [
  {
    id: 'token',
    name: 'Token Transfer',
    icon: '💸',
    payload: 'Transfer 25 TOKENS to Alice',
    origin: 'Wallet-0xAlice',
    desc: 'Standard native token transfer between accounts',
  },
  {
    id: 'gov',
    name: 'Governance Vote',
    icon: '🏛️',
    payload: 'Vote YES on Proposal #42',
    origin: 'DAO-Governor',
    desc: 'On-chain DAO parameter governance ballot',
  },
  {
    id: 'dex',
    name: 'DEX Swap',
    icon: '⚡',
    payload: 'Execute DEX Swap: 500 USDT -> ETH',
    origin: 'Uniswap-Pool',
    desc: 'Decentralized exchange automated liquidity swap',
  },
  {
    id: 'double_spend',
    name: 'Double-Spend Simulation',
    icon: '🦹',
    payload: 'Double-Spend 1,000 ETH to 0xAttacker',
    origin: 'Adversary-Node',
    desc: 'Simulate conflicting double-spend attack on consensus',
  },
];

export const TransactionExplorer: React.FC<TransactionExplorerProps> = ({
  transactions,
  onRefresh,
  isOpenModal,
  onCloseModal,
}) => {
  const [filter, setFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [payloadInput, setPayloadInput] = useState<string>('Transfer 25 TOKENS to Alice');
  const [originInput, setOriginInput] = useState<string>('Client-Portal');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [simBatchCount, setSimBatchCount] = useState<number>(10);
  const [simulatingBatch, setSimulatingBatch] = useState<boolean>(false);
  const [batchFeedback, setBatchFeedback] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  const handleCopy = (txId: string) => {
    navigator.clipboard.writeText(txId);
    setCopiedId(txId);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const handleSimulateBatch = async () => {
    if (simBatchCount < 1 || simBatchCount > 100) {
      setBatchError('Transaction count must be between 1 and 100');
      return;
    }
    setBatchError(null);
    setSimulatingBatch(true);
    setBatchFeedback(`Simulating ${simBatchCount} simultaneous transactions...`);
    try {
      const res = await api.submitBatchTransactions(simBatchCount);
      setBatchFeedback(`✓ Dispatched ${res.submitted} simultaneous transactions!`);
      onRefresh();
      setTimeout(() => setBatchFeedback(null), 5000);
    } catch (err: any) {
      setBatchFeedback(`Batch failed: ${err.message || 'Error executing simultaneous batch'}`);
    } finally {
      setSimulatingBatch(false);
    }
  };

  const handleApplyPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setPayloadInput(preset.payload);
    setOriginInput(preset.origin);
  };

  const handleQuickSubmitPreset = async (preset: typeof PRESET_TEMPLATES[0]) => {
    setSubmitting(true);
    try {
      await api.submitTransaction(preset.payload, preset.origin);
      onRefresh();
    } catch (err) {
      console.error('Failed quick submitting preset:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payloadInput.trim()) return;

    setSubmitting(true);
    try {
      await api.submitTransaction(payloadInput, originInput);
      setPayloadInput('');
      onRefresh();
      onCloseModal();
    } catch (err) {
      console.error('Failed submitting transaction:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (filter !== 'ALL' && tx.status !== filter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const payloadStr = typeof tx.payload === 'object' ? JSON.stringify(tx.payload) : String(tx.payload);
      return (
        tx.tx_id.toLowerCase().includes(q) ||
        payloadStr.toLowerCase().includes(q) ||
        tx.origin.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getStatusBadge = (status: TransactionStatus) => {
    switch (status) {
      case 'COMMITTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            COMMITTED
          </span>
        );
      case 'REPLICATED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-950/70 text-blue-300 border border-blue-500/30">
            <Layers className="w-3 h-3 text-blue-400" />
            REPLICATED
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950/70 text-amber-300 border border-amber-500/30 animate-pulse">
            <Clock className="w-3 h-3 text-amber-400" />
            PENDING
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950/70 text-rose-300 border border-rose-500/30">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            REJECTED
          </span>
        );
      case 'AWAITING_RECOVERY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-950/70 text-purple-300 border border-purple-500/30">
            <Clock className="w-3 h-3 text-purple-400" />
            STALLED (NO QUORUM)
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] bg-dark-700 text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-dark-800/80 border border-dark-700 rounded-xl p-5 shadow-lg backdrop-blur-sm space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <FileCode className="w-4 h-4 text-cyan-400" />
            Transaction Pool & Replication Explorer
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-dark-700 text-slate-300">
              {transactions.length} Total
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Submit transactions and verify that commitment only occurs when majority quorum (≥3 nodes) acknowledges replication.
          </p>
        </div>

        {/* Search & Filter Pills */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search ID, payload..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-dark-900 border border-dark-700 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono w-44"
            />
          </div>

          {/* Filter status buttons */}
          <div className="flex items-center gap-1">
            {['ALL', 'COMMITTED', 'REPLICATED', 'PENDING', 'AWAITING_RECOVERY', 'REJECTED'].map(
              (s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    filter === s
                      ? 'bg-brand-blue text-white shadow'
                      : 'bg-dark-900 text-slate-400 hover:text-white border border-dark-700'
                  }`}
                >
                  {s === 'AWAITING_RECOVERY' ? 'STALLED' : s}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* 1-Click Quick Preset Submission Toolbar */}
      <div className="p-3 rounded-lg bg-dark-900/60 border border-dark-700/80 flex flex-wrap items-center justify-between gap-2.5">
        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          1-Click Consensus Presets:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_TEMPLATES.map((p) => (
            <button
              key={p.id}
              onClick={() => handleQuickSubmitPreset(p)}
              disabled={submitting}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-dark-800 hover:bg-dark-700 border border-dark-600 hover:border-cyan-500/50 text-slate-200 hover:text-cyan-300 transition-all flex items-center gap-1.5 shadow-sm group"
              title={`${p.desc} — Click to submit instantly`}
            >
              <span>{p.icon}</span>
              <span>{p.name}</span>
              <span className="text-[10px] text-slate-500 group-hover:text-cyan-400 font-mono">⚡ Quick</span>
            </button>
          ))}
        </div>
      </div>

      {/* Simultaneous Batch Transaction Simulator (1 - 100 Tx) */}
      <div className="p-3.5 rounded-lg bg-dark-900/80 border border-brand-blue/30 shadow-inner space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-brand-blue/20 border border-brand-blue/40 text-brand-blue">
              <Zap className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                Simultaneous Batch Transaction Simulator
                <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-brand-blue/20 text-brand-blue border border-brand-blue/30">
                  1 - 100 Concurrent Tx
                </span>
              </span>
              <p className="text-[11px] text-slate-400">
                Specify transaction count (1-100). System automatically generates unique transaction IDs and details executed simultaneously.
              </p>
            </div>
          </div>

          {batchFeedback && (
            <span className="text-xs font-medium px-2.5 py-1 rounded bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-mono">
              {batchFeedback}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {/* User Input field (1-100) */}
          <div className="flex items-center gap-1.5 bg-dark-800 border border-dark-600 rounded-lg px-2.5 py-1 focus-within:border-brand-blue">
            <span className="text-[11px] text-slate-400 font-semibold">Count:</span>
            <input
              type="number"
              min="1"
              max="100"
              value={simBatchCount}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setSimBatchCount(isNaN(v) ? 1 : Math.max(1, Math.min(100, v)));
                setBatchError(null);
              }}
              className="w-14 bg-transparent text-xs text-slate-100 font-mono font-bold focus:outline-none text-center"
            />
            <span className="text-[10px] text-slate-500 font-mono">Tx</span>
          </div>

          {/* Quick preset pills */}
          <div className="flex items-center gap-1">
            {[5, 10, 25, 50, 100].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setSimBatchCount(c);
                  setBatchError(null);
                }}
                className={`px-2 py-1 rounded text-[11px] font-mono font-semibold transition-all ${
                  simBatchCount === c
                    ? 'bg-brand-blue text-white shadow'
                    : 'bg-dark-800 border border-dark-700 text-slate-400 hover:text-white'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Execution Button */}
          <button
            onClick={handleSimulateBatch}
            disabled={simulatingBatch}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${simulatingBatch ? 'animate-spin' : ''}`} />
            <span>{simulatingBatch ? `Simulating ${simBatchCount} Tx...` : `Simulate ${simBatchCount} Simultaneous Tx`}</span>
          </button>

          {batchError && (
            <span className="text-[10px] text-rose-400 font-sans">{batchError}</span>
          )}
        </div>
      </div>

      {/* Transaction Table */}
      <div className="overflow-x-auto rounded-lg border border-dark-700 bg-dark-900/60 max-h-96 overflow-y-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-dark-800 text-[11px] uppercase tracking-wider text-slate-400 sticky top-0 border-b border-dark-700 z-10">
            <tr>
              <th className="py-2.5 px-3">Tx ID</th>
              <th className="py-2.5 px-3">Payload</th>
              <th className="py-2.5 px-3">Origin</th>
              <th className="py-2.5 px-3">Quorum Replication</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Commit Latency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700/60 font-mono">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-6 text-slate-500 font-sans text-xs">
                  {transactions.length === 0
                    ? 'No transactions yet. Click any 1-Click Preset above or use "Submit Tx" to broadcast.'
                    : 'No transactions match the current filter or search criteria.'}
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => {
                const isCopied = copiedId === tx.tx_id;
                const quorumPercent = Math.min(100, Math.round((tx.replicated_count / 5) * 100));
                const quorumSatisfied = tx.replicated_count >= 3;

                return (
                  <tr key={tx.tx_id} className="hover:bg-dark-800/50 transition-colors">
                    {/* Tx ID with copy button */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-cyan-300 font-mono">{tx.tx_id}</span>
                        <button
                          onClick={() => handleCopy(tx.tx_id)}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-dark-700 transition-colors"
                          title="Copy Tx ID"
                        >
                          {isCopied ? (
                            <span className="flex items-center gap-0.5 text-emerald-400 text-[10px]">
                              <Check className="w-3 h-3" />
                            </span>
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Payload */}
                    <td
                      className="py-2.5 px-3 font-sans text-slate-200 truncate max-w-xs"
                      title={typeof tx.payload === 'object' ? JSON.stringify(tx.payload) : String(tx.payload)}
                    >
                      {typeof tx.payload === 'object' ? JSON.stringify(tx.payload) : String(tx.payload)}
                    </td>

                    {/* Origin */}
                    <td className="py-2.5 px-3 font-sans text-slate-400 text-[11px]">{tx.origin}</td>

                    {/* Quorum Replication */}
                    <td className="py-2.5 px-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          {tx.replicated_to.length === 0 ? (
                            <span className="text-slate-500 text-[10px]">-</span>
                          ) : (
                            tx.replicated_to.map((vid) => (
                              <span
                                key={vid}
                                className="text-[10px] px-1.5 py-0.2 rounded bg-dark-800 border border-dark-600 text-slate-300 font-mono"
                              >
                                {vid}
                              </span>
                            ))
                          )}
                          <span
                            className={`text-[10px] font-sans font-bold ml-1 ${
                              quorumSatisfied ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            ({tx.replicated_count}/5)
                          </span>
                        </div>
                        {/* Mini progress bar */}
                        <div className="w-24 h-1 rounded-full bg-dark-700 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              quorumSatisfied ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${quorumPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Status badge */}
                    <td className="py-2.5 px-3">{getStatusBadge(tx.status)}</td>

                    {/* Latency */}
                    <td className="py-2.5 px-3 text-right">
                      {tx.confirmation_latency_ms !== null ? (
                        <span className="text-emerald-400 font-semibold font-mono">
                          {tx.confirmation_latency_ms} ms
                        </span>
                      ) : tx.error_message ? (
                        <span className="text-rose-400 text-[10px] font-sans" title={tx.error_message}>
                          {tx.error_message}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px] font-sans">Awaiting commit...</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Submission Modal Dialog */}
      {isOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-dark-700 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-brand-blue" />
                Submit New Consensus Transaction
              </h3>
              <button
                onClick={onCloseModal}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Preset Selectors */}
            <div className="space-y-1.5">
              <label className="text-slate-400 text-[11px] font-semibold block">
                Choose a Template Preset:
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {PRESET_TEMPLATES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className="p-2 rounded-lg bg-dark-900 border border-dark-700 hover:border-cyan-500/60 text-left transition-all"
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-xs mb-0.5">
                      <span>{p.icon}</span>
                      <span>{p.name}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">{p.payload}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Batch Simulation Option inside Modal */}
            <div className="p-3 rounded-lg bg-dark-900 border border-brand-blue/30 space-y-2">
              <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-brand-blue" />
                Or Simulate Simultaneous Batch (1-100 Tx):
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={simBatchCount}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setSimBatchCount(isNaN(v) ? 1 : Math.max(1, Math.min(100, v)));
                  }}
                  className="w-16 bg-dark-800 border border-dark-600 rounded px-2 py-1 text-xs text-white font-mono text-center"
                />
                <button
                  type="button"
                  onClick={async () => {
                    await handleSimulateBatch();
                    onCloseModal();
                  }}
                  disabled={simulatingBatch}
                  className="flex-1 py-1 px-3 rounded text-xs font-bold bg-brand-blue hover:bg-blue-600 text-white transition-all flex items-center justify-center gap-1.5"
                >
                  <Play className={`w-3 h-3 ${simulatingBatch ? 'animate-spin' : ''}`} />
                  <span>{simulatingBatch ? 'Simulating...' : `Simulate ${simBatchCount} Simultaneous Tx`}</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">
                  Transaction Payload:
                </label>
                <input
                  type="text"
                  value={payloadInput}
                  onChange={(e) => setPayloadInput(e.target.value)}
                  placeholder="e.g. Transfer 100 Tokens to Bob"
                  required
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-brand-blue font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">
                  Originating Source / Client:
                </label>
                <input
                  type="text"
                  value={originInput}
                  onChange={(e) => setOriginInput(e.target.value)}
                  placeholder="e.g. Web-Client-Dashboard"
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-brand-blue"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-dark-700">
                <button
                  type="button"
                  onClick={onCloseModal}
                  className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white bg-dark-700 border border-dark-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg font-bold bg-brand-blue hover:bg-blue-600 text-white shadow-md flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Submitting...' : 'Submit to Leader'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
