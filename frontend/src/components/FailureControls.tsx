import React, { useState } from 'react';
import {
  Sliders,
  Wifi,
  PackageX,
  Split,
  Bug,
  Check,
  RotateCcw,
  AlertTriangle,
  Play,
  Flame,
  ShieldAlert,
  Zap,
  Globe,
  Radio,
  X,
  Sparkles,
} from 'lucide-react';
import { NetworkConfig, ValidatorState } from '../types';
import { api } from '../services/api';

interface FailureControlsProps {
  validators: ValidatorState[];
  currentNetworkConfig: NetworkConfig;
  isPartitioned: boolean;
  onRefresh: () => void;
}

const NETWORK_PROFILES = [
  {
    id: 'lan',
    name: 'Optimal LAN',
    latency: 20,
    drops: 0,
    icon: <Zap className="w-3.5 h-3.5 text-emerald-400" />,
    desc: 'Low jitter datacenter connection (20ms, 0% loss)',
    badge: 'Optimal',
    badgeColor: 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300',
  },
  {
    id: 'wan',
    name: 'Global WAN',
    latency: 90,
    drops: 2,
    icon: <Globe className="w-3.5 h-3.5 text-cyan-400" />,
    desc: 'Cross-region multi-cloud network (90ms, 2% loss)',
    badge: 'Moderate',
    badgeColor: 'bg-cyan-950/70 border-cyan-500/40 text-cyan-300',
  },
  {
    id: 'mobile',
    name: 'Mobile 4G/Edge',
    latency: 180,
    drops: 5,
    icon: <Radio className="w-3.5 h-3.5 text-amber-400" />,
    desc: 'High-latency cellular network (180ms, 5% loss)',
    badge: 'Degraded',
    badgeColor: 'bg-amber-950/70 border-amber-500/40 text-amber-300',
  },
  {
    id: 'severe',
    name: 'Severe Loss',
    latency: 450,
    drops: 25,
    icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />,
    desc: 'Congested satellite / packet drops (450ms, 25% loss)',
    badge: 'Critical',
    badgeColor: 'bg-rose-950/70 border-rose-500/40 text-rose-300',
  },
];

const BYZANTINE_FAULT_TYPES = [
  {
    id: 'conflict_entry',
    name: 'Conflicting Uncommitted Fork',
    icon: '🔀',
    summary: 'Follower fabricates a divergent transaction (tx-{hex}) at matching index.',
    impact: 'Tests whether the honest majority quarantines the rogue entry without safety violation.',
    severity: 'High Divergence',
  },
  {
    id: 'fabricate_ack',
    name: 'Fabricated Replication ACK',
    icon: '🎭',
    summary: 'Follower sends affirmative write ACK to Leader without persisting entry to disk.',
    impact: 'Demonstrates crash-reconciliation differences when node restarts.',
    severity: 'Deceptive ACK',
  },
  {
    id: 'disrupt_replication',
    name: 'Disrupt & Drop Entries',
    icon: '🚫',
    summary: 'Byzantine node silently swallows AppendEntries replication packets.',
    impact: 'Verifies honest majority progress (3/5) despite Byzantine dropouts.',
    severity: 'Replication Drop',
  },
  {
    id: 'invalid_payload',
    name: 'Malformed / Corrupted Payload',
    icon: '💥',
    summary: 'Node proposes corrupted payload bytes to test payload parsing guards.',
    impact: 'Ensures state machines reject malformed payloads without crash loops.',
    severity: 'Bad Format',
  },
];

export const FailureControls: React.FC<FailureControlsProps> = ({
  validators,
  currentNetworkConfig,
  isPartitioned,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'network' | 'partition' | 'malicious'>('network');

  // Latency & Loss state
  const [latency, setLatency] = useState<number>(currentNetworkConfig.latency_ms);
  const [dropRate, setDropRate] = useState<number>(currentNetworkConfig.drop_rate * 100);
  const [updatingNet, setUpdatingNet] = useState<boolean>(false);
  const [latencyInput, setLatencyInput] = useState<string>(String(Math.round(currentNetworkConfig.latency_ms)));
  const [dropInput, setDropInput] = useState<string>(String(Math.round(currentNetworkConfig.drop_rate * 100)));
  const [latencyError, setLatencyError] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);

  // Partition groups state
  const [partitionGroupA, setPartitionGroupA] = useState<string[]>(['V1', 'V2', 'V3']);
  const [partitionGroupB, setPartitionGroupB] = useState<string[]>(['V4', 'V5']);
  const [partitioning, setPartitioning] = useState<boolean>(false);

  // Malicious injection state
  const [targetValidator, setTargetValidator] = useState<string>('V5');
  const [faultType, setFaultType] = useState<string>('conflict_entry');
  const [injecting, setInjecting] = useState<boolean>(false);

  // Apply network latency & drops
  const handleApplyNetwork = async (newLatency: number, newDropPct: number) => {
    const clampedLatency = Math.max(0, Math.min(2000, newLatency));
    const clampedDrop = Math.max(0, Math.min(100, newDropPct));
    setUpdatingNet(true);
    try {
      await api.updateNetworkConfig({
        latency_ms: clampedLatency,
        jitter_ms: Math.min(25, Math.round(clampedLatency * 0.25)),
        drop_rate: clampedDrop / 100.0,
      });
      setLatency(clampedLatency);
      setDropRate(clampedDrop);
      setLatencyInput(String(Math.round(clampedLatency)));
      setDropInput(clampedDrop.toFixed(clampedDrop % 1 === 0 ? 0 : 1));
      setLatencyError(null);
      setDropError(null);
      onRefresh();
    } finally {
      setUpdatingNet(false);
    }
  };

  const handleApplyCustomLatency = () => {
    const val = parseFloat(latencyInput);
    if (isNaN(val) || val < 0 || val > 2000) {
      setLatencyError('Latency must be within range 0 - 2000 ms');
      return;
    }
    setLatencyError(null);
    handleApplyNetwork(val, dropRate);
  };

  const handleApplyCustomDropRate = () => {
    const val = parseFloat(dropInput);
    if (isNaN(val) || val < 0 || val > 100) {
      setDropError('Packet drop must be within range 0 - 100 %');
      return;
    }
    setDropError(null);
    handleApplyNetwork(latency, val);
  };

  // Toggle partition membership
  const togglePartitionMember = (vid: string) => {
    if (partitionGroupA.includes(vid)) {
      if (partitionGroupA.length <= 1) return;
      setPartitionGroupA(partitionGroupA.filter((id) => id !== vid));
      setPartitionGroupB([...partitionGroupB, vid]);
    } else {
      if (partitionGroupB.length <= 1) return;
      setPartitionGroupB(partitionGroupB.filter((id) => id !== vid));
      setPartitionGroupA([...partitionGroupA, vid]);
    }
  };

  const handleApplyPresetPartition = async (presetType: 'standard' | 'isolate_leader') => {
    setPartitioning(true);
    try {
      if (presetType === 'standard') {
        const groupA = ['V1', 'V2', 'V3'];
        const groupB = ['V4', 'V5'];
        setPartitionGroupA(groupA);
        setPartitionGroupB(groupB);
        await api.partitionNetwork(groupA, groupB);
      } else {
        const leader = validators.find((v) => v.role === 'LEADER' && v.is_online);
        const leaderId = leader ? leader.validator_id : 'V1';
        const groupB = [leaderId];
        const groupA = validators.map((v) => v.validator_id).filter((id) => id !== leaderId);
        setPartitionGroupA(groupA);
        setPartitionGroupB(groupB);
        await api.partitionNetwork(groupA, groupB);
      }
      onRefresh();
    } finally {
      setPartitioning(false);
    }
  };

  const handleActivatePartition = async () => {
    setPartitioning(true);
    try {
      await api.partitionNetwork(partitionGroupA, partitionGroupB);
      onRefresh();
    } finally {
      setPartitioning(false);
    }
  };

  const handleHealPartition = async () => {
    setPartitioning(true);
    try {
      await api.healNetwork();
      onRefresh();
    } finally {
      setPartitioning(false);
    }
  };

  const handleInjectFault = async () => {
    setInjecting(true);
    try {
      await api.injectMalicious(targetValidator, faultType, {
        timestamp: Date.now(),
        description: `Injected ${faultType} fault`,
      });
      onRefresh();
    } finally {
      setInjecting(false);
    }
  };

  const handleClearFault = async (vid: string) => {
    setInjecting(true);
    try {
      await api.clearMalicious(vid);
      onRefresh();
    } finally {
      setInjecting(false);
    }
  };

  const handleClearAllFaults = async () => {
    setInjecting(true);
    try {
      const maliciousNodes = validators.filter((v) => v.is_malicious);
      await Promise.all(maliciousNodes.map((v) => api.clearMalicious(v.validator_id)));
      onRefresh();
    } finally {
      setInjecting(false);
    }
  };

  const maliciousValidators = validators.filter((v) => v.is_malicious);

  return (
    <div className="bg-dark-800/80 border border-dark-700 rounded-xl p-5 shadow-lg backdrop-blur-sm space-y-4">
      {/* Title & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-brand-blue" />
            Failure Simulation & Fault Injection Control
          </h2>
          <p className="text-xs text-slate-400">
            Dynamically inject latency, packet loss, network partitions, and Byzantine fault behaviors.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-dark-900 p-1 rounded-lg border border-dark-700 text-xs">
          <button
            onClick={() => setActiveTab('network')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              activeTab === 'network'
                ? 'bg-brand-blue text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Latency & Drops
          </button>
          <button
            onClick={() => setActiveTab('partition')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              activeTab === 'partition'
                ? 'bg-brand-blue text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Partition (3v2)
          </button>
          <button
            onClick={() => setActiveTab('malicious')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              activeTab === 'malicious'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Byzantine Faults {maliciousValidators.length > 0 ? `(${maliciousValidators.length})` : ''}
          </button>
        </div>
      </div>

      {/* Tab 1: Latency & Message Loss */}
      {activeTab === 'network' && (
        <div className="space-y-4">
          {/* 1-Click Realistic Network Profiles */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              1-Click Realistic Network Presets:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {NETWORK_PROFILES.map((p) => {
                const isActive = latency === p.latency && dropRate === p.drops;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleApplyNetwork(p.latency, p.drops)}
                    disabled={updatingNet}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      isActive
                        ? 'bg-dark-800 border-cyan-500 shadow-md ring-1 ring-cyan-500/40'
                        : 'bg-dark-900/60 border-dark-700 hover:border-dark-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-200">
                        {p.icon}
                        <span>{p.name}</span>
                      </div>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${p.badgeColor}`}>
                        {p.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight mb-1.5">{p.desc}</p>
                    <div className="flex items-center gap-2 font-mono text-[10px] text-slate-300">
                      <span>{p.latency}ms</span>
                      <span>•</span>
                      <span>{p.drops}% loss</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Latency Controls */}
            <div className="p-3.5 rounded-lg bg-dark-900/60 border border-dark-700 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Wifi className="w-4 h-4 text-cyan-400" />
                  Network Latency: <strong className="font-mono text-cyan-300">{Math.round(latency)} ms</strong>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Range: 0 - 2000 ms</span>
              </div>

              {/* Continuous Slider (0 - 2000 ms) */}
              <input
                type="range"
                min="0"
                max="2000"
                step="any"
                value={latency}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setLatency(val);
                  setLatencyInput(String(Math.round(val)));
                  setLatencyError(null);
                }}
                onMouseUp={() => handleApplyNetwork(latency, dropRate)}
                onTouchEnd={() => handleApplyNetwork(latency, dropRate)}
                className="w-full accent-cyan-400 cursor-pointer"
              />

              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>0 ms</span>
                <span>1000 ms</span>
                <span>2000 ms</span>
              </div>

              {/* Direct User Input + Apply Button */}
              <div className="pt-1">
                <label className="text-[11px] text-slate-400 block mb-1">Custom Latency Input (0 - 2000 ms):</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center bg-dark-800 border border-dark-600 rounded-lg overflow-hidden focus-within:border-cyan-400">
                    <input
                      type="number"
                      min="0"
                      max="2000"
                      step="any"
                      value={latencyInput}
                      onChange={(e) => {
                        setLatencyInput(e.target.value);
                        setLatencyError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleApplyCustomLatency();
                      }}
                      placeholder="e.g. 125"
                      className="w-full bg-transparent px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none font-mono"
                    />
                    <span className="text-[11px] text-slate-400 pr-2.5 font-mono">ms</span>
                  </div>
                  <button
                    onClick={handleApplyCustomLatency}
                    disabled={updatingNet}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow transition-all shrink-0"
                  >
                    Apply
                  </button>
                </div>
                {latencyError && (
                  <span className="text-[10px] text-rose-400 block mt-1">{latencyError}</span>
                )}
              </div>
            </div>

            {/* Packet Loss Controls */}
            <div className="p-3.5 rounded-lg bg-dark-900/60 border border-dark-700 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <PackageX className="w-4 h-4 text-rose-400" />
                  Packet Drop Loss Rate:{' '}
                  <strong className="font-mono text-rose-300">{dropRate.toFixed(1)}%</strong>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Range: 0 - 100 %</span>
              </div>

              {/* Continuous Slider (0 - 100 %) */}
              <input
                type="range"
                min="0"
                max="100"
                step="any"
                value={dropRate}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setDropRate(val);
                  setDropInput(val.toFixed(val % 1 === 0 ? 0 : 1));
                  setDropError(null);
                }}
                onMouseUp={() => handleApplyNetwork(latency, dropRate)}
                onTouchEnd={() => handleApplyNetwork(latency, dropRate)}
                className="w-full accent-rose-400 cursor-pointer"
              />

              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>

              {/* Direct User Input + Apply Button */}
              <div className="pt-1">
                <label className="text-[11px] text-slate-400 block mb-1">Custom Drop Rate Input (0 - 100 %):</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center bg-dark-800 border border-dark-600 rounded-lg overflow-hidden focus-within:border-rose-400">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={dropInput}
                      onChange={(e) => {
                        setDropInput(e.target.value);
                        setDropError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleApplyCustomDropRate();
                      }}
                      placeholder="e.g. 12.5"
                      className="w-full bg-transparent px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none font-mono"
                    />
                    <span className="text-[11px] text-slate-400 pr-2.5 font-mono">%</span>
                  </div>
                  <button
                    onClick={handleApplyCustomDropRate}
                    disabled={updatingNet}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow transition-all shrink-0"
                  >
                    Apply
                  </button>
                </div>
                {dropError && (
                  <span className="text-[10px] text-rose-400 block mt-1">{dropError}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Network Partition (3 vs 2) */}
      {activeTab === 'partition' && (
        <div className="space-y-4">
          {/* 1-Click Partition Presets Toolbar */}
          <div className="p-3 rounded-lg bg-dark-900/60 border border-dark-700 flex flex-wrap items-center justify-between gap-2.5">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Partition Presets:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleApplyPresetPartition('standard')}
                disabled={partitioning}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-dark-800 hover:bg-dark-700 border border-dark-600 text-slate-200 hover:text-white transition-all flex items-center gap-1.5"
              >
                <Split className="w-3 h-3 text-amber-400" />
                <span>Standard 3v2 (V1-V3 vs V4-V5)</span>
              </button>

              <button
                onClick={() => handleApplyPresetPartition('isolate_leader')}
                disabled={partitioning}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-dark-800 hover:bg-dark-700 border border-dark-600 text-slate-200 hover:text-white transition-all flex items-center gap-1.5"
              >
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                <span>Isolate Leader (Leader vs Rest)</span>
              </button>

              {isPartitioned && (
                <button
                  onClick={handleHealPartition}
                  disabled={partitioning}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-1.5 shadow"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Heal & Reconnect All</span>
                </button>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-dark-900/60 border border-dark-700">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                <Split className="w-4 h-4 text-amber-400" />
                Custom Partition Groups (Click validator to swap group):
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Quorum threshold: 3 of 5
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Group A */}
              <div className="p-3 rounded-lg bg-dark-800 border border-emerald-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-emerald-400">
                    Group A ({partitionGroupA.length} nodes):
                  </span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                    partitionGroupA.length >= 3 ? 'bg-emerald-950 text-emerald-300 border border-emerald-600' : 'bg-rose-950 text-rose-300'
                  }`}>
                    {partitionGroupA.length >= 3 ? '✓ Quorum (Can Commit)' : 'Stalled (<3)'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {validators.map((v) => {
                    const inA = partitionGroupA.includes(v.validator_id);
                    if (!inA) return null;
                    return (
                      <button
                        key={v.validator_id}
                        onClick={() => togglePartitionMember(v.validator_id)}
                        className="px-2.5 py-1 rounded bg-emerald-950/70 border border-emerald-600/50 text-emerald-300 font-mono hover:bg-emerald-900 transition-all text-xs"
                      >
                        {v.validator_id} ⇄
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Group B */}
              <div className="p-3 rounded-lg bg-dark-800 border border-rose-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-rose-400">
                    Group B ({partitionGroupB.length} nodes):
                  </span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                    partitionGroupB.length >= 3 ? 'bg-emerald-950 text-emerald-300 border border-emerald-600' : 'bg-rose-950 text-rose-300'
                  }`}>
                    {partitionGroupB.length >= 3 ? '✓ Quorum (Can Commit)' : 'Stalled (<3)'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {validators.map((v) => {
                    const inB = partitionGroupB.includes(v.validator_id);
                    if (!inB) return null;
                    return (
                      <button
                        key={v.validator_id}
                        onClick={() => togglePartitionMember(v.validator_id)}
                        className="px-2.5 py-1 rounded bg-rose-950/70 border border-rose-600/50 text-rose-300 font-mono hover:bg-rose-900 transition-all text-xs"
                      >
                        {v.validator_id} ⇄
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleActivatePartition}
                disabled={partitioning}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md transition-all"
              >
                <Split className="w-3.5 h-3.5" />
                <span>Apply Partition ({partitionGroupA.length} vs {partitionGroupB.length})</span>
              </button>

              {isPartitioned && (
                <button
                  onClick={handleHealPartition}
                  disabled={partitioning}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Heal & Reconnect All</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Byzantine Fault Injection */}
      {activeTab === 'malicious' && (
        <div className="space-y-4">
          {/* Active Malicious Nodes Bar */}
          {maliciousValidators.length > 0 && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-600/60 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-xs text-rose-300 font-semibold">
                <Flame className="w-4 h-4 text-rose-400 animate-pulse" />
                <span>Active Byzantine Infections ({maliciousValidators.length}):</span>
                {maliciousValidators.map((v) => (
                  <span
                    key={v.validator_id}
                    className="font-mono text-[11px] px-2 py-0.5 rounded bg-rose-900 border border-rose-600 text-white"
                  >
                    {v.validator_id}: {v.malicious_type}
                  </span>
                ))}
              </div>
              <button
                onClick={handleClearAllFaults}
                disabled={injecting}
                className="px-3 py-1 rounded-md text-xs font-bold bg-rose-700 hover:bg-rose-600 text-white transition-all shadow"
              >
                Clear All Faults
              </button>
            </div>
          )}

          {/* Fault Catalog Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {BYZANTINE_FAULT_TYPES.map((f) => {
              const isSelected = faultType === f.id;
              return (
                <div
                  key={f.id}
                  onClick={() => setFaultType(f.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-dark-800 border-rose-500 shadow-md ring-1 ring-rose-500/40'
                      : 'bg-dark-900/60 border-dark-700 hover:border-dark-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                      <span>{f.icon}</span>
                      <span>{f.name}</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-950/60 text-rose-300 border border-rose-800">
                      {f.severity}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mb-1">{f.summary}</p>
                  <p className="text-[10px] text-slate-400 italic">{f.impact}</p>
                </div>
              );
            })}
          </div>

          <div className="p-3.5 rounded-lg bg-dark-900/60 border border-rose-900/50 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-slate-400 text-[11px] block mb-1 font-semibold">Target Validator:</label>
                <select
                  value={targetValidator}
                  onChange={(e) => setTargetValidator(e.target.value)}
                  className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-rose-500 font-mono"
                >
                  {validators.map((v) => (
                    <option key={v.validator_id} value={v.validator_id}>
                      {v.validator_id} ({v.role}) {v.is_malicious ? `🔥 [ACTIVE: ${v.malicious_type}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 text-[11px] block mb-1 font-semibold">Fault Scenario:</label>
                <select
                  value={faultType}
                  onChange={(e) => setFaultType(e.target.value)}
                  className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-rose-500 font-mono"
                >
                  <option value="conflict_entry">Inject Conflicting Uncommitted Entry</option>
                  <option value="fabricate_ack">Fabricated Replication Acknowledgment</option>
                  <option value="disrupt_replication">Disrupt & Drop Replication Entries</option>
                  <option value="invalid_payload">Propose Malformed / Corrupted Payload</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleInjectFault}
                disabled={injecting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-all"
              >
                <Bug className="w-3.5 h-3.5" />
                <span>Inject Fault on {targetValidator}</span>
              </button>

              {validators.some((v) => v.is_malicious) && (
                <button
                  onClick={() => handleClearFault(targetValidator)}
                  disabled={injecting}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-dark-700 hover:bg-dark-600 border border-dark-600 text-slate-200 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear Fault on {targetValidator}</span>
                </button>
              )}
            </div>

            {/* Raft BFT note */}
            <div className="p-2.5 rounded bg-dark-900 border border-dark-700 text-[11px] text-slate-400 space-y-1">
              <span className="font-semibold text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" /> Raft Design Boundary Notice:
              </span>
              <p>
                Raft is mathematically proven for <strong>Crash Fault Tolerance (CFT)</strong>. It tolerates up to 2 silent crashing nodes in a 5-node cluster. If a validator deliberately lies (fabricates ACKs or signs conflicting terms), the Consistency Auditor quarantines the rogue entry without breaking quorum consistency.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
