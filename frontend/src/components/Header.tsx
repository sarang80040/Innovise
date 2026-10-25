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
} from 'lucide-react';
import { ClusterStatus } from '../types';
import { api } from '../services/api';
import { JudgeGuideModal } from './JudgeGuideModal';

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

          {/* Submit Tx Button */}
          <button
            onClick={onOpenTxModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-blue hover:bg-blue-600 text-white transition-all shadow-md shadow-brand-blue/20"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Submit Tx</span>
          </button>

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
