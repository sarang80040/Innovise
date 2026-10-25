import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Split,
  Flame,
  Cpu,
  Layers,
  X,
  ShieldAlert,
  ShieldCheck,
  ChevronRight,
  Terminal,
} from 'lucide-react';

interface JudgeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JudgeGuideModal: React.FC<JudgeGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'recipes' | 'architecture' | 'byzantine' | 'adaptive'>('recipes');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-dark-700 flex items-center justify-between bg-dark-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-blue/20 border border-brand-blue/40 text-brand-blue">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Hackathon Judge Guide & Consensus Architecture Walkthrough
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-brand-blue/20 text-brand-blue border border-brand-blue/30">
                  Interactive Evaluation
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                A quick-start guide to verify Raft CFT consensus, Byzantine fault isolation, 3v2 partitions, and adaptive timeouts.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="px-6 py-2.5 bg-dark-800 border-b border-dark-700 flex items-center gap-2 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('recipes')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'recipes'
                ? 'bg-brand-blue text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-dark-700'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>1-Minute Demo Recipes</span>
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'architecture'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-dark-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Consensus Core & Quorum</span>
          </button>

          <button
            onClick={() => setActiveTab('byzantine')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'byzantine'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-dark-700'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Byzantine Fault Quarantining</span>
          </button>

          <button
            onClick={() => setActiveTab('adaptive')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'adaptive'
                ? 'bg-purple-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-dark-700'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Adaptive Network Controller</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs text-slate-300">
          {/* TAB 1: 1-Minute Live Demo Recipes */}
          {activeTab === 'recipes' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/30 text-blue-200">
                <p className="font-semibold text-xs mb-1">
                  💡 How to test this live in under 2 minutes:
                </p>
                <p className="text-[11px] text-blue-300/90 leading-relaxed">
                  Follow these 5 distinct test scenarios to see the consensus engine dynamically adapt, withstand split networks, isolate malicious nodes, and recover seamlessly.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Recipe 1 */}
                <div className="p-4 rounded-xl bg-dark-900/70 border border-dark-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-cyan-400 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-xs font-mono">1</span>
                      Standard Quorum Commit
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                      Normal Mode
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Click <strong>Submit Tx</strong> or any preset pill (e.g. <em>"Transfer 25 TOKENS to Alice"</em>).
                  </p>
                  <div className="p-2 rounded bg-dark-800 border border-dark-700 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Observe: Replicated to 5/5 nodes, status changes to COMMITTED in ~30ms.</span>
                  </div>
                </div>

                {/* Recipe 2 */}
                <div className="p-4 rounded-xl bg-dark-900/70 border border-dark-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-amber-400 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-amber-950 border border-amber-500/50 flex items-center justify-center text-xs font-mono">2</span>
                      Leader Crash & Failover
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                      Crash Fault
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Find the current Leader card (gold crown) and click <strong>Crash Node</strong>.
                  </p>
                  <div className="p-2 rounded bg-dark-800 border border-dark-700 text-[11px] font-mono text-amber-300 flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                    <span>Observe: Heartbeat drops, remaining 4 nodes elect new Leader with Term increment!</span>
                  </div>
                </div>

                {/* Recipe 3 */}
                <div className="p-4 rounded-xl bg-dark-900/70 border border-dark-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-purple-400 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-purple-950 border border-purple-500/50 flex items-center justify-center text-xs font-mono">3</span>
                      3 vs 2 Network Partition
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                      Split-Brain Guard
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Under Failure Controls &gt; Partition, click <strong>Apply Partition (3 vs 2)</strong> and submit a Tx.
                  </p>
                  <div className="p-2 rounded bg-dark-800 border border-dark-700 text-[11px] font-mono text-purple-300 flex items-center gap-1.5">
                    <Split className="w-3.5 h-3.5 shrink-0" />
                    <span>Observe: Majority (3) commits; Minority (2) stalls with STALLED (NO QUORUM).</span>
                  </div>
                </div>

                {/* Recipe 4 */}
                <div className="p-4 rounded-xl bg-dark-900/70 border border-dark-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-rose-400 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-rose-950 border border-rose-500/50 flex items-center justify-center text-xs font-mono">4</span>
                      Byzantine Fork Isolation
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                      Byzantine Fault
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Inject <strong>Conflicting Uncommitted Entry</strong> on V5, then submit a transaction.
                  </p>
                  <div className="p-2 rounded bg-dark-800 border border-dark-700 text-[11px] font-mono text-rose-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span>Observe: Auditor flags V5 fork. V5 is quarantined; honest majority reaches commit!</span>
                  </div>
                </div>
              </div>

              {/* Recipe 5: Automated Runner */}
              <div className="p-4 rounded-xl bg-dark-900/70 border border-dark-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-emerald-400 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-500/50 flex items-center justify-center text-xs font-mono">5</span>
                    One-Click Automated Benchmark Suite
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    Telemetry & JSON
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Switch to the <strong>Experiment Runner</strong> tab to execute automated Scenarios A through E with full JSON export.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: Consensus Core & Quorum */}
          {activeTab === 'architecture' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-dark-900/70 border border-dark-700 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Raft Crash Fault Tolerance (CFT) Mathematical Invariant
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  In a cluster of $N = 5$ independent validators, the strict majority quorum threshold is:
                </p>
                <div className="p-3 rounded-lg bg-dark-800 border border-dark-700 font-mono text-center text-emerald-400 text-sm">
                  Quorum = ⌊N / 2⌋ + 1 = ⌊5 / 2⌋ + 1 = 3 Validators
                </div>
                <ul className="space-y-2 text-[11px] text-slate-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Leader Election:</strong> A candidate must receive votes from $\ge 3$ nodes to become Leader for a given Term.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Commit Point:</strong> A log entry is committed only when replicated across $\ge 3$ nodes. No minority branch can ever commit a competing transaction at the same log index.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Crash Tolerance ($f$):</strong> The cluster safely tolerates $f = \lfloor(N - 1) / 2\rfloor = 2$ crash failures while remaining fully available and consistent.</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: Byzantine Fault Quarantining */}
          {activeTab === 'byzantine' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-dark-900/70 border border-dark-700 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-400" />
                  Byzantine Fault Isolation in a Raft Engine
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Classical Raft is designed for crash failures, not arbitrary malicious actors. This simulator provides an advanced <strong>Mathematical Consistency Auditor</strong> that inspects log entries across all nodes in real time to isolate Byzantine divergence:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-dark-800 border border-dark-700 space-y-1.5">
                    <div className="font-semibold text-rose-300">🔀 Conflicting Fork Injection</div>
                    <p className="text-[11px] text-slate-400">
                      A malicious follower (e.g. V5) fabricates a divergent uncommitted entry at index $k$. The honest majority (V1-V4) commits the authentic entry. The auditor tags V5 as <code>CONFLICT</code> and isolates the rogue fork.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-dark-800 border border-dark-700 space-y-1.5">
                    <div className="font-semibold text-amber-300">🎭 Fabricated Acknowledgment</div>
                    <p className="text-[11px] text-slate-400">
                      A malicious node returns a success ACK to the leader without writing the entry to its disk log. If it crashes, log reconciliation catches the discrepancy.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-dark-800 border border-dark-700 space-y-1.5">
                    <div className="font-semibold text-purple-300">🚫 Silent Packet Drop</div>
                    <p className="text-[11px] text-slate-400">
                      A Byzantine follower drops AppendEntries replication messages. Since only $3/5$ nodes are needed for quorum, the honest majority progresses without stalling.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-dark-800 border border-dark-700 space-y-1.5">
                    <div className="font-semibold text-cyan-300">💥 Corrupted Payload</div>
                    <p className="text-[11px] text-slate-400">
                      Corrupted payloads are validated by deserialization filters, preventing malformed state machine transitions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Adaptive Network Controller */}
          {activeTab === 'adaptive' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-dark-900/70 border border-dark-700 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-purple-400" />
                  Closed-Loop Dynamic Timeout Adaptation
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Fixed election timeouts in distributed systems cause catastrophic failure modes: if network delay exceeds the election timeout, followers falsely assume the leader is dead, triggering non-stop split-vote election storms.
                </p>

                <div className="p-3.5 rounded-lg bg-purple-950/30 border border-purple-500/40 text-purple-200 text-xs space-y-2">
                  <div className="font-bold">Dynamic Adaptation Formula:</div>
                  <div className="font-mono bg-dark-900/80 p-2 rounded border border-purple-800 text-[11px]">
                    Election Timeout = base_timeout × (1 + Latency_Penalty + Loss_Penalty)
                  </div>
                  <p className="text-[11px] text-purple-300/80">
                    When latency jumps from 30ms to 400ms or drop rate climbs to 25%, the controller smoothly scales the election timeout from [1.5s - 3.0s] to [3.5s - 7.0s], guaranteeing leader stability!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-dark-700 bg-dark-900/60 flex items-center justify-between text-xs">
          <span className="text-slate-400">
            Click outside or press Close to resume live cluster inspection.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg font-semibold bg-dark-700 hover:bg-dark-600 text-slate-200 hover:text-white transition-all border border-dark-600"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
