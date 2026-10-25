import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Crown,
  RotateCcw,
  Zap,
  Activity,
  PlusCircle,
  Link2,
  BookOpen,
  Send,
  Check,
  X,
} from 'lucide-react';
import { ClusterStatus } from '../types';
import { api } from '../services/api';
import { JudgeGuideModal } from './JudgeGuideModal';

const PRESET_TEMPLATES = [
  { name: 'Token Transfer', payload: 'Transfer 25 TOKENS to Alice', origin: 'Wallet-0xAlice', icon: '💸' },
  { name: 'Governance Vote', payload: 'Vote YES on Proposal #42', origin: 'DAO-Governor', icon: '🏛️' },
  { name: 'Smart Contract', payload: 'Execute contract 0xDeFi::swap(100 USDT -> ETH)', origin: 'DEX-Router', icon: '⚡' },
  { name: 'Mint NFT', payload: 'Mint NFT #1024 to 0xBob', origin: 'NFT-Portal', icon: '🎨' },
];

interface HeaderProps {
  cluster: ClusterStatus | null;
  isConnected: boolean;
  onRefresh: () => void;
  onOpenTxModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  cluster,
  isConnected,
  onRefresh,
  onOpenTxModal,
}) => {
  const [resetting, setResetting] = useState(false);
  const [healing, setHealing] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [headerBatchCount, setHeaderBatchCount] = useState<number>(10);
  const [simulatingBatch, setSimulatingBatch] = useState(false);
  const [headerFeedback, setHeaderFeedback] = useState<string | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualPayload, setManualPayload] = useState('Transfer 50 TOKENS to Alice');
  const [manualOrigin, setManualOrigin] = useState('Client-Portal');
  const [submittingManual, setSubmittingManual] = useState(false);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPayload.trim()) return;
    setSubmittingManual(true);
    try {
      await api.submitTransaction(manualPayload, manualOrigin);
      onRefresh();
      setIsManualModalOpen(false); // Closes popup immediately upon Submit to Leader
    } catch (err) {
      console.error('Failed submitting manual tx:', err);
    } finally {
      setSubmittingManual(false);
    }
  };

  const handleHeaderSimulateBatch = async () => {
    if (headerBatchCount < 1 || headerBatchCount > 100) return;
    setSimulatingBatch(true);
    setHeaderFeedback(`Dispatching ${headerBatchCount}...`);
    try {
      const res = await api.submitBatchTransactions(headerBatchCount);
      setHeaderFeedback(`✓ ${res.submitted} Tx`);
      onRefresh();
      setTimeout(() => setHeaderFeedback(null), 3500);
    } catch (e: any) {
      setHeaderFeedback('Failed');
      setTimeout(() => setHeaderFeedback(null), 3500);
    } finally {
      setSimulatingBatch(false);
    }
  };

  const handleReset = async () => {
    if (confirm('Reset cluster to initial genesis state (Term 0, 5 honest followers)?')) {
      setResetting(true);
      try {
        await api.resetCluster();
        onRefresh();
      } finally {
        setResetting(false);
      }
    }
  };

  const handleHeal = async () => {
    setHealing(true);
    try {
      await api.healNetwork();
      onRefresh();
    } finally {
      setHealing(false);
    }
  };

  const isPartitioned = Boolean(cluster?.active_partition);
  const hasQuorum = cluster?.quorum_active ?? false;

  return (
    <header className="bg-dark-800 border-b border-dark-700 px-6 py-3.5 sticky top-0 z-40 shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Title */}
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-brand-blue/15 border border-brand-blue/30 text-brand-blue">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              ConsensusPulse
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-brand-blue/20 text-brand-blue border border-brand-blue/30">
                Raft Consensus Simulator
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Distributed Byzantine & Crash Failure Simulator under Dynamic Network Conditions
            </p>
          </div>
        </div>

        {/* Live Cluster Status Indicators */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Quorum Pill */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
              hasQuorum
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                : 'bg-rose-950/80 border-rose-500/60 text-rose-300 animate-pulse'
            }`}
          >
            {hasQuorum ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>QUORUM ACTIVE ({cluster?.online_validators ?? 0}/5)</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>QUORUM LOST ({cluster?.online_validators ?? 0}/5 Online)</span>
              </>
            )}
          </div>

          {/* Leader Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-dark-700 border border-dark-600 text-slate-200">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Leader:{' '}
              <strong className="text-amber-300 font-mono">
                {cluster?.current_leader || 'Electing...'}
              </strong>
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">
              Term <strong className="text-slate-200 font-mono">{cluster?.current_term ?? 0}</strong>
            </span>
          </div>

          {/* Partition Warning Pill if active */}
          {isPartitioned && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-950/80 border border-amber-500/60 text-amber-300 animate-pulse">
              <span>Partitioned (3 vs 2)</span>
            </div>
          )}

          {/* WebSocket Link */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-dark-900 border border-dark-700">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-400 font-mono text-[11px]">
              {isConnected ? 'WS LIVE' : 'WS RECONNECTING'}
            </span>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Judge Guide Walkthrough Button */}
          <button
            onClick={() => setIsGuideOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white transition-all shadow-md shadow-purple-600/20"
            title="Open Demo Recipes and Consensus Explanations for Judges"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Judge Guide</span>
          </button>

          {/* Manual Tx Button with Anchored Popup */}
          <div className="relative">
            <button
              onClick={() => setIsManualModalOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-blue hover:bg-blue-600 text-white transition-all shadow-md shadow-brand-blue/20"
              title="Open manual transaction submission dialog"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Manual Tx</span>
            </button>

            {/* Popup right near the button */}
            {isManualModalOpen && (
              <>
                {/* Click-away backdrop */}
                <div
                  className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
                  onClick={() => setIsManualModalOpen(false)}
                />

                {/* Popover anchored directly below the button, opening towards the right */}
                <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-dark-800 border border-dark-600 rounded-xl p-4 shadow-2xl z-50 space-y-3.5">
                  {/* Subtle top pointer arrow pointing up to the Manual Tx button */}
                  <div className="absolute -top-1.5 left-6 w-3 h-3 bg-dark-800 border-t border-l border-dark-600 rotate-45" />

                  <div className="flex items-center justify-between border-b border-dark-700 pb-2.5 relative z-10">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-brand-blue" />
                      Manual Consensus Transaction
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsManualModalOpen(false)}
                      className="text-slate-400 hover:text-white text-xs p-1 rounded hover:bg-dark-700 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 1-Click Quick Presets */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Quick Presets:</span>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      {PRESET_TEMPLATES.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setManualPayload(p.payload);
                            setManualOrigin(p.origin);
                          }}
                          className="p-1.5 rounded-lg bg-dark-900 border border-dark-700 hover:border-cyan-500/60 text-left transition-all group"
                        >
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-200 group-hover:text-cyan-300">
                            <span>{p.icon}</span>
                            <span>{p.name}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleManualSubmit} className="space-y-2.5 text-xs">
                    <div>
                      <label className="text-[11px] text-slate-300 block mb-1 font-semibold">
                        Transaction Payload:
                      </label>
                      <input
                        type="text"
                        value={manualPayload}
                        onChange={(e) => setManualPayload(e.target.value)}
                        placeholder="e.g. Transfer 50 Tokens to Alice"
                        required
                        className="w-full bg-dark-900 border border-dark-600 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-blue font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-300 block mb-1 font-semibold">
                        Originating Source / Client:
                      </label>
                      <input
                        type="text"
                        value={manualOrigin}
                        onChange={(e) => setManualOrigin(e.target.value)}
                        placeholder="e.g. Web-Client-Portal"
                        className="w-full bg-dark-900 border border-dark-600 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-blue"
                      />
                    </div>

                    <div className="pt-1.5 flex items-center justify-end gap-2 border-t border-dark-700">
                      <button
                        type="button"
                        onClick={() => setIsManualModalOpen(false)}
                        className="px-3 py-1 rounded-lg text-xs text-slate-300 hover:text-white bg-dark-700 border border-dark-600"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingManual}
                        className="px-3.5 py-1 rounded-lg text-xs font-bold bg-brand-blue hover:bg-blue-600 text-white shadow-md flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Send className={`w-3 h-3 ${submittingManual ? 'animate-spin' : ''}`} />
                        <span>{submittingManual ? 'Submitting...' : 'Submit to Leader'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </>
            )}
          </div>

          {/* Quick Simultaneous Batch Simulator (1-100) in Header */}
          <div className="flex items-center gap-1.5 bg-dark-900 border border-brand-blue/40 rounded-lg p-1 shadow-inner">
            <span className="text-[11px] text-slate-300 font-semibold px-1 hidden lg:inline flex items-center gap-1">
              <Zap className="w-3 h-3 text-cyan-400" />
              Simulate:
            </span>
            <input
              type="number"
              min="1"
              max="100"
              value={headerBatchCount}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setHeaderBatchCount(isNaN(v) ? 1 : Math.max(1, Math.min(100, v)));
              }}
              title="Number of transactions to simulate simultaneously (1-100)"
              className="w-11 bg-dark-800 border border-dark-600 rounded px-1 py-0.5 text-xs text-center text-white font-mono font-bold focus:outline-none focus:border-brand-blue"
            />
            <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">Tx</span>
            <button
              onClick={handleHeaderSimulateBatch}
              disabled={simulatingBatch}
              title="Simulate simultaneous transactions with auto-generated IDs and details"
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow transition-all disabled:opacity-50"
            >
              <Zap className={`w-3 h-3 ${simulatingBatch ? 'animate-spin' : 'text-cyan-300'}`} />
              <span>{simulatingBatch ? 'Simulating...' : headerFeedback || `Simulate (1-100)`}</span>
            </button>
          </div>

          {/* Heal Network Button if partitioned */}
          {isPartitioned && (
            <button
              onClick={handleHeal}
              disabled={healing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>{healing ? 'Healing...' : 'Heal Partition'}</span>
            </button>
          )}

          {/* Reset Genesis Button */}
          <button
            onClick={handleReset}
            disabled={resetting}
            title="Reset cluster to genesis"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-700 hover:bg-dark-600 border border-dark-600 text-slate-300 hover:text-white transition-all"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
            <span>Reset Genesis</span>
          </button>
        </div>
      </div>

      {/* Judge Guide Walkthrough Modal */}
      <JudgeGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </header>
  );
};
