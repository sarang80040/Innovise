import React, { useState } from 'react';
import {
  FlaskConical,
  Play,
  Download,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Clock,
  Zap,
  Split,
  WifiOff,
  Skull,
} from 'lucide-react';
import { ExperimentReport } from '../types';
import { api } from '../services/api';

interface ExperimentSuiteProps {
  onRefresh: () => void;
}

export const ExperimentSuite: React.FC<ExperimentSuiteProps> = ({ onRefresh }) => {
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [activeReport, setActiveReport] = useState<ExperimentReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRun = async (scenario: string) => {
    setRunningScenario(scenario);
    setErrorMsg(null);
    try {
      const report = await api.runExperiment(scenario);
      setActiveReport(report);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Experiment execution failed');
    } finally {
      setRunningScenario(null);
    }
  };

  const handleExportJSON = () => {
    if (!activeReport) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activeReport, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${activeReport.experiment_id}-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const experiments = [
    {
      id: 'experiment_a',
      title: 'Experiment A: Normal Operation',
      icon: <Zap className="w-4 h-4 text-cyan-400" />,
      desc: 'Baseline benchmark. 5 honest nodes, 30ms latency, 0% drops. Submits batch and verifies optimal throughput, confirmation latency, and 100% committed prefix match.',
    },
    {
      id: 'experiment_b',
      title: 'Experiment B: Leader Failure & Crash Recovery',
      icon: <RotateCcw className="w-4 h-4 text-amber-400" />,
      desc: 'Crashes the elected leader unexpectedly. Measures failover election duration, confirms quorum progress on new leader, and verifies catch-up synchronization when old leader recovers.',
    },
    {
      id: 'experiment_c',
      title: 'Experiment C: Network Partition (3 vs 2 Quorum)',
      icon: <Split className="w-4 h-4 text-purple-400" />,
      desc: 'Splits network into Majority (3 nodes) and Minority (2 nodes). Proves Majority continues committing while Minority stalls new commits to prevent split-brain divergences.',
    },
    {
      id: 'experiment_d',
      title: 'Experiment D: High Latency & Severe Loss',
      icon: <WifiOff className="w-4 h-4 text-rose-400" />,
      desc: 'Simulates harsh network conditions: 150ms delay, 20% packet drops. Evaluates performance degradation and validates adaptive controller timeout expansion.',
    },
    {
      id: 'experiment_e',
      title: 'Experiment E: Malicious Byzantine Faults',
      icon: <Skull className="w-4 h-4 text-rose-500" />,
      desc: 'Injects Byzantine faults (fabricated ACKs, conflicting uncommitted entries). Demonstrates crash-fault tolerance bounds and documents why Raft requires BFT for arbitrary faults.',
    },
  ];

  return (
    <div className="bg-dark-800/80 border border-dark-700 rounded-xl p-5 shadow-lg backdrop-blur-sm space-y-5">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-purple-400" />
            Automated Consensus Failure Experiment Runner
          </h2>
          <p className="text-xs text-slate-400">
            Execute standardized distributed consensus failure experiments with end-to-end telemetry and JSON reports.
          </p>
        </div>

        {activeReport && (
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-dark-700 hover:bg-dark-600 border border-dark-600 text-slate-200 transition-all shadow"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export Report (JSON)</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-600/50 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Experiment Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {experiments.map((exp) => {
          const isRunning = runningScenario === exp.id;
          const isSelected = activeReport?.experiment_id.includes(exp.id.replace('experiment_', ''));

          return (
            <div
              key={exp.id}
              className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                isSelected
                  ? 'bg-dark-800 border-purple-500 shadow-md ring-1 ring-purple-500/40'
                  : 'bg-dark-900/60 border-dark-700 hover:border-dark-600'
              }`}
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1 rounded bg-dark-800 border border-dark-700">{exp.icon}</div>
                  <h3 className="font-bold text-xs text-white leading-tight">{exp.title}</h3>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">{exp.desc}</p>
              </div>

              <button
                onClick={() => handleRun(exp.id)}
                disabled={Boolean(runningScenario)}
                className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  isRunning
                    ? 'bg-purple-900 text-purple-200 animate-pulse cursor-not-allowed'
                    : 'bg-brand-blue hover:bg-blue-600 text-white shadow'
                }`}
              >
                <Play className={`w-3 h-3 ${isRunning ? 'animate-spin' : ''}`} />
                <span>{isRunning ? 'Running...' : 'Run Scenario'}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Active Experiment Report Viewer */}
      {activeReport && (
        <div className="p-4 rounded-xl bg-dark-900/90 border border-purple-500/40 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dark-700 pb-3">
            <div>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 uppercase tracking-wider">
                {activeReport.experiment_id}
              </span>
              <h3 className="text-base font-bold text-white mt-1">{activeReport.name}</h3>
              <p className="text-xs text-slate-400">{activeReport.description}</p>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-400 block font-mono">
                Duration: <strong className="text-white">{activeReport.duration_sec}s</strong>
              </span>
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold ${
                  activeReport.is_consistent ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {activeReport.is_consistent ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Ledger Consistency 100% Sound
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    Safety Violation / Discrepancy Found
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Measurements Key Values */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="p-2.5 rounded bg-dark-800 border border-dark-700">
              <span className="text-slate-400 text-[10px] block">Transactions</span>
              <span className="font-bold text-purple-400 font-mono text-sm">
                {activeReport.committed_count} / {activeReport.submitted_count}
              </span>
              <span className="text-[10px] text-slate-500 block">Committed</span>
            </div>

            <div className="p-2.5 rounded bg-dark-800 border border-dark-700">
              <span className="text-slate-400 text-[10px] block">Throughput</span>
              <span className="font-bold text-cyan-400 font-mono text-sm">
                {activeReport.throughput_tps} tps
              </span>
              <span className="text-[10px] text-slate-500 block">Measured</span>
            </div>

            <div className="p-2.5 rounded bg-dark-800 border border-dark-700">
              <span className="text-slate-400 text-[10px] block">Avg Latency</span>
              <span className="font-bold text-emerald-400 font-mono text-sm">
                {activeReport.avg_latency_ms !== null ? `${activeReport.avg_latency_ms} ms` : 'N/A'}
              </span>
              <span className="text-[10px] text-slate-500 block">
                p95: {activeReport.p95_latency_ms ?? 'N/A'}ms
              </span>
            </div>

            <div className="p-2.5 rounded bg-dark-800 border border-dark-700">
              <span className="text-slate-400 text-[10px] block">Failover / Election</span>
              <span className="font-bold text-amber-400 font-mono text-sm">
                {activeReport.election_duration_sec !== null
                  ? `${activeReport.election_duration_sec} s`
                  : 'N/A'}
              </span>
              <span className="text-[10px] text-slate-500 block">Reelection time</span>
            </div>

            <div className="p-2.5 rounded bg-dark-800 border border-dark-700">
              <span className="text-slate-400 text-[10px] block">Recovery Duration</span>
              <span className="font-bold text-blue-400 font-mono text-sm">
                {activeReport.recovery_time_sec !== null
                  ? `${activeReport.recovery_time_sec} s`
                  : 'N/A'}
              </span>
              <span className="text-[10px] text-slate-500 block">Log catch-up</span>
            </div>

            <div className="p-2.5 rounded bg-dark-800 border border-dark-700">
              <span className="text-slate-400 text-[10px] block">Dropped Packets</span>
              <span className="font-bold text-rose-400 font-mono text-sm">
                {activeReport.message_drop_count}
              </span>
              <span className="text-[10px] text-slate-500 block">Total lost</span>
            </div>
          </div>

          {/* Observations List */}
          <div className="space-y-1.5 text-xs">
            <span className="font-bold text-slate-300 block">Protocol Observations & Step Log:</span>
            <ul className="space-y-1 pl-4 list-disc text-slate-300 text-[11px]">
              {activeReport.observations.map((obs, i) => (
                <li key={i}>{obs}</li>
              ))}
            </ul>
          </div>

          {/* Protocol Analysis / Educational Limitations Notes */}
          <div className="p-3 rounded-lg bg-dark-800 border border-dark-700 text-xs space-y-1">
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Distributed Systems Engineering & Protocol Evaluation:
            </span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              {activeReport.protocol_notes}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
