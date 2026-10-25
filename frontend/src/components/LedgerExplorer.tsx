import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Diff,
  Check,
  AlertTriangle,
  RotateCw,
  Server,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Search,
  Copy,
} from 'lucide-react';
import { LedgerConsistency, LogEntry, ValidatorState } from '../types';
import { api } from '../services/api';

interface LedgerExplorerProps {
  validators: ValidatorState[];
  selectedValidatorId: string;
  onSelectValidator: (vid: string) => void;
  consistency: LedgerConsistency | null;
  onRefresh: () => void;
}

export const LedgerExplorer: React.FC<LedgerExplorerProps> = ({
  validators,
  selectedValidatorId,
  onSelectValidator,
  consistency,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'single' | 'compare'>('single');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [allLogs, setAllLogs] = useState<Record<string, LogEntry[]>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

  const handleCopyTx = (txId: string) => {
    navigator.clipboard.writeText(txId);
    setCopiedTxId(txId);
    setTimeout(() => {
      setCopiedTxId(null);
    }, 2000);
  };

  // Fetch log for selected validator
  useEffect(() => {
    let isMounted = true;
    const fetchLog = async () => {
      setLoading(true);
      try {
        const entries = await api.getValidatorLedger(selectedValidatorId);
        if (isMounted) setLogs(entries);
      } catch (e) {
        console.error('Failed fetching ledger:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchLog();
    return () => {
      isMounted = false;
    };
  }, [selectedValidatorId]);

  // Fetch logs for all validators for compare tab
  useEffect(() => {
    if (activeTab === 'compare') {
      const fetchAll = async () => {
        const map: Record<string, LogEntry[]> = {};
        await Promise.all(
          validators.map(async (v) => {
            try {
              map[v.validator_id] = await api.getValidatorLedger(v.validator_id);
            } catch (e) {
              map[v.validator_id] = [];
            }
          })
        );
        setAllLogs(map);
      };
      fetchAll();
    }
  }, [activeTab, validators]);

  const selectedVal = validators.find((v) => v.validator_id === selectedValidatorId);

  // Find validator status from consistency summary
  const summary = consistency?.validator_summaries.find(
    (s) => s.validator_id === selectedValidatorId
  );

  return (
    <div className="bg-dark-800/80 border border-dark-700 rounded-xl p-5 shadow-lg backdrop-blur-sm">
      {/* Title & Mode Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            Independent Ledger Explorer & Cross-Validator Auditor
          </h2>
          <p className="text-xs text-slate-400">
            Inspect individual local logs, verify commit pointers, and detect log lagging or divergent forks.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex bg-dark-900 p-1 rounded-lg border border-dark-700 text-xs">
          <button
            onClick={() => setActiveTab('single')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              activeTab === 'single'
                ? 'bg-brand-blue text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Node Ledger View
          </button>
          <button
            onClick={() => setActiveTab('compare')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              activeTab === 'compare'
                ? 'bg-brand-blue text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Side-by-Side Comparison
          </button>
        </div>
      </div>

      {/* Consensus Auditor Summary & Detected Discrepancy Records */}
      {consistency && (
        <div className="mb-4 space-y-3">
          {/* Status Banner */}
          <div
            className={`p-3 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 ${
              consistency.safety_violation
                ? 'bg-rose-950/40 border-rose-500/60 text-rose-200'
                : consistency.conflicts && consistency.conflicts.length > 0
                ? 'bg-purple-950/40 border-purple-500/60 text-purple-200'
                : consistency.lagging_count > 0
                ? 'bg-amber-950/30 border-amber-500/50 text-amber-200'
                : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {consistency.safety_violation ? (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : consistency.conflicts && consistency.conflicts.length > 0 ? (
                <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span className="font-semibold">{consistency.explanation}</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="px-2 py-0.5 rounded bg-dark-900/80 border border-dark-700">
                Highest Commit: #{consistency.highest_commit_index}
              </span>
              <span
                className={`px-2 py-0.5 rounded border font-semibold ${
                  consistency.safety_violation
                    ? 'bg-rose-900/60 border-rose-500 text-rose-200'
                    : consistency.conflicts && consistency.conflicts.length > 0
                    ? 'bg-purple-900/60 border-purple-500 text-purple-200'
                    : 'bg-emerald-900/60 border-emerald-500 text-emerald-200'
                }`}
              >
                {consistency.safety_violation
                  ? 'CRITICAL SAFETY VIOLATION'
                  : consistency.conflicts && consistency.conflicts.length > 0
                  ? `FORK DETECTED (${consistency.conflicts.length})`
                  : '100% SYNCHRONIZED'}
              </span>
            </div>
          </div>

          {/* Detailed Audit Records (when conflicts/forks exist) */}
          {consistency.conflicts && consistency.conflicts.length > 0 && (
            <div className="p-3.5 rounded-lg bg-dark-900/90 border border-purple-500/50 shadow-inner space-y-3">
              <div className="flex items-center justify-between border-b border-dark-700/60 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-purple-400" />
                  Ledger Consistency Audit Records ({consistency.conflicts.length} Discrepancy Found)
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Raft CFT Safety Check Active
                </span>
              </div>

              <div className="space-y-2.5">
                {consistency.conflicts.map((conf, cIdx) => (
                  <div
                    key={cIdx}
                    className="p-3 rounded-lg bg-dark-800/80 border border-dark-700 text-xs space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-bold text-white bg-dark-900 px-2 py-0.5 rounded border border-dark-700">
                          Log Index #{conf.log_index}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            conf.severity === 'CRITICAL_SAFETY_VIOLATION'
                              ? 'bg-rose-950 text-rose-300 border border-rose-500'
                              : 'bg-purple-950 text-purple-300 border border-purple-500'
                          }`}
                        >
                          {conf.severity === 'CRITICAL_SAFETY_VIOLATION'
                            ? 'CRITICAL SAFETY VIOLATION'
                            : 'BYZANTINE UNCOMMITTED FORK (QUARANTINED)'}
                        </span>
                      </div>
                      <span className="text-[11px] font-sans text-slate-400">
                        Quorum status: Isolated by honest majority
                      </span>
                    </div>

                    <p className="text-slate-300 font-sans text-xs leading-relaxed">
                      {conf.description}
                    </p>

                    {/* Discrepancy comparison across nodes */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 font-mono text-[11px]">
                      {Object.entries(conf.discrepancy).map(([vid, disc]: [string, any]) => {
                        const isFork =
                          !disc.committed && conf.severity === 'BYZANTINE_FORK_DISCREPANCY';
                        return (
                          <div
                            key={vid}
                            className={`p-2 rounded border transition-colors ${
                              isFork
                                ? 'bg-rose-950/40 border-rose-500/60 text-rose-300'
                                : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                              <span>{vid}</span>
                              <span className="text-cyan-400">T{disc.term}</span>
                            </div>
                            <div className="truncate font-semibold mt-1 font-mono text-[11px]" title={disc.tx_id}>
                              {disc.tx_id}
                            </div>
                            <div className="text-[9px] mt-0.5 font-sans">
                              {disc.committed ? (
                                <span className="text-emerald-400 font-semibold">✓ Committed</span>
                              ) : (
                                <span className="text-rose-400 font-bold">⚠️ Rogue Fork (Uncommitted)</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode 1: Single Node Explorer */}
      {activeTab === 'single' && (
        <div className="space-y-4">
          {/* Node Selector Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {validators.map((v) => {
              const isSelected = v.validator_id === selectedValidatorId;
              const isLead = v.role === 'LEADER' && v.is_online;
              return (
                <button
                  key={v.validator_id}
                  onClick={() => onSelectValidator(v.validator_id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    isSelected
                      ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300 shadow'
                      : 'bg-dark-900 border-dark-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <Server className="w-3.5 h-3.5" />
                  <span>{v.validator_id}</span>
                  {isLead && (
                    <span className="text-[10px] font-mono px-1 rounded bg-amber-500/20 text-amber-300">
                      LEADER
                    </span>
                  )}
                  {v.is_malicious && (
                    <span className="text-[10px] font-mono px-1 rounded bg-purple-900/60 text-purple-300 border border-purple-500/40">
                      BYZANTINE
                    </span>
                  )}
                  {!v.is_online && (
                    <span className="text-[10px] font-mono px-1 rounded bg-rose-900/60 text-rose-300">
                      OFFLINE
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Node Summary Stats Bar */}
          {selectedVal && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg bg-dark-900/60 border border-dark-700 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] block">Synchronization Status</span>
                <span
                  className={`font-bold font-mono text-xs ${
                    summary?.status === 'SYNCHRONIZED'
                      ? 'text-emerald-400'
                      : summary?.status === 'LAGGING'
                      ? 'text-amber-400'
                      : summary?.status === 'CONFLICT'
                      ? 'text-purple-400 font-bold'
                      : 'text-rose-400'
                  }`}
                >
                  {summary?.status === 'CONFLICT'
                    ? 'CONFLICT (ROGUE FORK)'
                    : summary?.status || (selectedVal.is_online ? 'SYNCED' : 'OFFLINE')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Commit Index</span>
                <span className="font-bold font-mono text-emerald-400 text-sm">
                  {selectedVal.commit_index}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Last Applied Index</span>
                <span className="font-bold font-mono text-cyan-400 text-sm">
                  {selectedVal.last_applied}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Total Log Entries</span>
                <span className="font-bold font-mono text-slate-200 text-sm">
                  {selectedVal.log_length}
                </span>
              </div>
            </div>
          )}

          {/* Search bar & Invariant Notice */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter entries in log..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-dark-900 border border-dark-700 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono w-52"
              />
            </div>
            <span className="text-[11px] text-slate-400 font-sans">
              Entries ≤ Commit Index ({selectedVal?.commit_index ?? 0}) are immutable and quorum-verified.
            </span>
          </div>

          {/* Log Table */}
          <div className="overflow-x-auto rounded-lg border border-dark-700 bg-dark-900/60 max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-dark-800 text-[11px] uppercase tracking-wider text-slate-400 sticky top-0 border-b border-dark-700">
                <tr>
                  <th className="py-2.5 px-3">Log Index</th>
                  <th className="py-2.5 px-3">Term</th>
                  <th className="py-2.5 px-3">Tx ID</th>
                  <th className="py-2.5 px-3">Payload Data</th>
                  <th className="py-2.5 px-3 text-right">Commit State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/60 font-mono">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-500 font-sans text-xs">
                      No transaction entries present in {selectedValidatorId}'s local log yet.
                    </td>
                  </tr>
                ) : (
                  logs
                    .filter((entry) => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.toLowerCase();
                      const payloadStr =
                        typeof entry.payload === 'object'
                          ? JSON.stringify(entry.payload)
                          : String(entry.payload);
                      return (
                        entry.tx_id.toLowerCase().includes(q) ||
                        payloadStr.toLowerCase().includes(q) ||
                        String(entry.index).includes(q) ||
                        String(entry.term).includes(q)
                      );
                    })
                    .map((entry) => {
                      const isCommitted = entry.index <= (selectedVal?.commit_index ?? 0);
                      const isFork =
                        !isCommitted &&
                        (selectedVal?.is_malicious ||
                          (entry.payload &&
                            typeof entry.payload === 'object' &&
                            ((entry.payload as any)?.action === 'DOUBLE_SPEND_ATTACK' ||
                              'DOUBLE_SPEND_ATTACK' in entry.payload ||
                              'conflict_note' in entry.payload ||
                              'MALICIOUS_FORK' in entry.payload)));
                      const isCopied = copiedTxId === entry.tx_id;
                      return (
                        <tr
                          key={entry.index}
                          className={`hover:bg-dark-800/50 transition-colors ${
                            isFork
                              ? 'bg-rose-950/25 border-l-2 border-rose-500'
                              : isCommitted
                              ? ''
                              : 'bg-amber-950/10'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-bold text-slate-100">#{entry.index}</td>
                          <td className="py-2.5 px-3 text-cyan-400">Term {entry.term}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`font-mono ${
                                  isFork ? 'text-rose-400 font-bold' : 'text-slate-300'
                                }`}
                              >
                                {entry.tx_id}
                              </span>
                              <button
                                onClick={() => handleCopyTx(entry.tx_id)}
                                className="p-0.5 rounded text-slate-400 hover:text-white transition-colors"
                                title="Copy Tx ID"
                              >
                                {isCopied ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3 text-slate-500 hover:text-slate-300" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-200 truncate max-w-xs">
                            {typeof entry.payload === 'object'
                              ? JSON.stringify(entry.payload)
                              : String(entry.payload)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-sans">
                            {isFork ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400">
                                <AlertTriangle className="w-3 h-3 text-rose-400" />
                                MALICIOUS FORK (UNCOMMITTED)
                              </span>
                            ) : isCommitted ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                COMMITTED
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                                <Clock className="w-3 h-3 text-amber-400" />
                                UNCOMMITTED SUFFIX
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mode 2: Multi-Node Ledger Comparison Diff */}
      {activeTab === 'compare' && (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-dark-900 border border-dark-700 text-xs">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5 mb-1">
              <Diff className="w-4 h-4 text-brand-blue" />
              Consensus Consistency Auditor Summary:
            </span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              {consistency?.explanation || 'Checking cross-node ledger agreement...'}
            </p>
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto rounded-lg border border-dark-700 bg-dark-900/60 max-h-80 overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-dark-800 text-[11px] uppercase tracking-wider text-slate-400 sticky top-0 border-b border-dark-700">
                <tr>
                  <th className="py-2.5 px-3">Index</th>
                  {validators.map((v) => (
                    <th key={v.validator_id} className="py-2.5 px-3 text-center">
                      {v.validator_id}
                      <span className="block text-[9px] font-sans text-slate-400">
                        Commit: {v.commit_index}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/60">
                {Array.from({
                  length: Math.max(...validators.map((v) => v.log_length), 0),
                }).map((_, idx) => {
                  const logIndex = idx + 1;
                  return (
                    <tr key={logIndex} className="hover:bg-dark-800/40">
                      <td className="py-2 px-3 font-bold text-slate-400">#{logIndex}</td>
                      {validators.map((v) => {
                        const vLog = allLogs[v.validator_id] || [];
                        const entry = vLog[idx];
                        if (!entry) {
                          return (
                            <td
                              key={v.validator_id}
                              className="py-2 px-3 text-center text-[10px] text-slate-600 font-sans"
                            >
                              - Missing -
                            </td>
                          );
                        }
                        const isCommitted = entry.index <= v.commit_index;
                        const isDivergent = Object.entries(allLogs).some(([otherVid, otherLog]) => {
                          const otherVal = validators.find((val) => val.validator_id === otherVid);
                          const otherEntry = otherLog[idx];
                          return (
                            otherEntry &&
                            otherEntry.index <= (otherVal?.commit_index ?? 0) &&
                            otherEntry.tx_id !== entry.tx_id
                          );
                        });
                        const isFork =
                          !isCommitted &&
                          (isDivergent ||
                            v.is_malicious ||
                            (entry.payload &&
                              typeof entry.payload === 'object' &&
                              ((entry.payload as any)?.action === 'DOUBLE_SPEND_ATTACK' ||
                                'DOUBLE_SPEND_ATTACK' in entry.payload ||
                                'conflict_note' in entry.payload ||
                                'MALICIOUS_FORK' in entry.payload)));
                        return (
                          <td
                            key={v.validator_id}
                            className={`py-2 px-3 text-center text-[10px] ${
                              isFork
                                ? 'text-rose-400 bg-rose-950/30 border border-rose-500/40 rounded'
                                : isCommitted
                                ? 'text-emerald-400'
                                : 'text-amber-400 bg-amber-950/10'
                            }`}
                          >
                            <span className="font-semibold block font-mono">{entry.tx_id}</span>
                            <span className="text-[9px] font-sans">
                              (T{entry.term}){' '}
                              {isFork ? (
                                <span className="text-rose-400 font-bold">⚠️ Rogue Fork</span>
                              ) : isCommitted ? (
                                '✓ Commit'
                              ) : (
                                'Pending'
                              )}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
