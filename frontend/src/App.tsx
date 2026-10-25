import React, { useState } from 'react';
import { useSimulation } from './hooks/useSimulation';
import { Header } from './components/Header';
import { NetworkGraph } from './components/NetworkGraph';
import { FailureControls } from './components/FailureControls';
import { AdaptivePanel } from './components/AdaptivePanel';
import { TransactionExplorer } from './components/TransactionExplorer';
import { LedgerExplorer } from './components/LedgerExplorer';
import { MetricsCharts } from './components/MetricsCharts';
import { ExperimentSuite } from './components/ExperimentSuite';
import { EventLog } from './components/EventLog';
import { api } from './services/api';
import {
  LayoutDashboard,
  BarChart3,
  FlaskConical,
  BookOpen,
  FileCode,
  Terminal,
} from 'lucide-react';

export const App: React.FC = () => {
  const {
    cluster,
    validators,
    transactions,
    events,
    consistency,
    charts,
    adaptiveStatus,
    isConnected,
    loading,
    refreshAll,
  } = useSimulation();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'experiments' | 'ledger' | 'telemetry'>('dashboard');
  const [selectedValidatorId, setSelectedValidatorId] = useState<string>('V1');
  const [isTxModalOpen, setIsTxModalOpen] = useState<boolean>(false);

  const handleToggleValidator = async (validatorId: string, currentOnline: boolean) => {
    try {
      if (currentOnline) {
        await api.stopValidator(validatorId);
      } else {
        await api.startValidator(validatorId);
      }
      refreshAll();
    } catch (e) {
      console.error('Failed toggling validator power:', e);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 text-slate-100 flex flex-col font-sans selection:bg-brand-blue selection:text-white">
      {/* Global Application Header */}
      <Header
        cluster={cluster}
        isConnected={isConnected}
        onRefresh={refreshAll}
        onOpenTxModal={() => setIsTxModalOpen(true)}
      />

      {/* Main Navigation Bar */}
      <nav className="bg-dark-800/60 border-b border-dark-700/60 px-6 py-2 sticky top-[57px] z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-brand-blue text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-dark-700/60'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Consensus Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('experiments')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'experiments'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-dark-700/60'
              }`}
            >
              <FlaskConical className="w-4 h-4" />
              <span>Experiment Runner</span>
            </button>

            <button
              onClick={() => setActiveTab('ledger')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'ledger'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-dark-700/60'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Ledgers & Auditor</span>
            </button>

            <button
              onClick={() => setActiveTab('telemetry')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'telemetry'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-dark-700/60'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Metrics & Charts</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400 font-mono">
            <span>Raft 5-Node Quorum: 3</span>
            <span>•</span>
            <span className="text-cyan-400">
              TPS: {cluster?.metrics.throughput_tps ?? 0}
            </span>
          </div>
        </div>
      </nav>

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Tab 1: Consensus Dashboard (Integrated overview) */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* 1. Network Topology Ring */}
            <NetworkGraph
              validators={validators}
              selectedValidatorId={selectedValidatorId}
              onSelectValidator={setSelectedValidatorId}
              activePartition={cluster?.active_partition ?? null}
              onToggleValidator={handleToggleValidator}
            />

            {/* 2. Failure Simulation & Adaptive Network Controller */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FailureControls
                validators={validators}
                currentNetworkConfig={
                  cluster?.network_config ?? { latency_ms: 30, jitter_ms: 10, drop_rate: 0 }
                }
                isPartitioned={Boolean(cluster?.active_partition)}
                onRefresh={refreshAll}
              />
              <AdaptivePanel
                adaptiveStatus={adaptiveStatus}
                onRefresh={refreshAll}
              />
            </div>

            {/* 3. Transaction Explorer & Quick Submission */}
            <TransactionExplorer
              transactions={transactions}
              onRefresh={refreshAll}
              isOpenModal={isTxModalOpen}
              onCloseModal={() => setIsTxModalOpen(false)}
            />

            {/* 4. Ledger Explorer for Selected Validator */}
            <LedgerExplorer
              validators={validators}
              selectedValidatorId={selectedValidatorId}
              onSelectValidator={setSelectedValidatorId}
              consistency={consistency}
              onRefresh={refreshAll}
            />

            {/* 5. Telemetry Analytics & Live Event Stream */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MetricsCharts metrics={cluster?.metrics ?? null} charts={charts} />
              <EventLog events={events} />
            </div>
          </div>
        )}

        {/* Tab 2: Dedicated Experiment Runner Suite */}
        {activeTab === 'experiments' && (
          <div className="space-y-6">
            <ExperimentSuite onRefresh={refreshAll} />
            <EventLog events={events} />
          </div>
        )}

        {/* Tab 3: Detailed Ledger Explorer & Auditor */}
        {activeTab === 'ledger' && (
          <div className="space-y-6">
            <LedgerExplorer
              validators={validators}
              selectedValidatorId={selectedValidatorId}
              onSelectValidator={setSelectedValidatorId}
              consistency={consistency}
              onRefresh={refreshAll}
            />
            <TransactionExplorer
              transactions={transactions}
              onRefresh={refreshAll}
              isOpenModal={isTxModalOpen}
              onCloseModal={() => setIsTxModalOpen(false)}
            />
          </div>
        )}

        {/* Tab 4: Performance Analytics & Telemetry */}
        {activeTab === 'telemetry' && (
          <div className="space-y-6">
            <MetricsCharts metrics={cluster?.metrics ?? null} charts={charts} />
            <EventLog events={events} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-dark-800 bg-dark-900/90 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>
            Blockchain Consensus Failure Simulator • Raft CFT Implementation with Byzantine Fault Experiments
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            Python 3.14 + FastAPI + React + Vite + TypeScript
          </span>
        </div>
      </footer>
    </div>
  );
};
