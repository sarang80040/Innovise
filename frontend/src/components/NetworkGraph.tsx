import React from 'react';
import {
  Crown,
  Server,
  AlertTriangle,
  Skull,
  Radio,
  FileText,
  CheckCircle2,
  Send,
  Inbox,
  Shield,
} from 'lucide-react';
import { ValidatorState } from '../types';

interface NetworkGraphProps {
  validators: ValidatorState[];
  selectedValidatorId: string;
  onSelectValidator: (validatorId: string) => void;
  activePartition: Record<string, string[]> | null;
  onToggleValidator: (validatorId: string, currentOnline: boolean) => void;
}

export const NetworkGraph: React.FC<NetworkGraphProps> = ({
  validators,
  selectedValidatorId,
  onSelectValidator,
  activePartition,
  onToggleValidator,
}) => {
  // If partitioned, split nodes into Group A and Group B for clear visual segregation
  const isPartitioned = Boolean(activePartition);

  const renderNodeCard = (val: ValidatorState) => {
    const isSelected = val.validator_id === selectedValidatorId;
    const isLeader = val.role === 'LEADER' && val.is_online;
    const isCandidate = val.role === 'CANDIDATE' && val.is_online;
    const isStopped = !val.is_online;
    const isMalicious = val.is_malicious;

    let borderStyle = 'border-dark-600 bg-dark-800';
    let haloStyle = '';

    if (isStopped) {
      borderStyle = 'border-rose-900/60 bg-dark-900/80 opacity-60';
    } else if (isMalicious) {
      borderStyle = 'border-rose-500 bg-rose-950/20 shadow-[0_0_15px_rgba(244,63,94,0.3)]';
    } else if (isLeader) {
      borderStyle = 'border-amber-500/80 bg-gradient-to-b from-dark-800 to-amber-950/20 leader-glow';
    } else if (isCandidate) {
      borderStyle = 'border-purple-500/80 bg-purple-950/20 animate-pulse';
    } else {
      borderStyle = 'border-blue-500/40 bg-dark-800 hover:border-blue-400/80';
    }

    if (isSelected) {
      haloStyle = 'ring-2 ring-brand-blue ring-offset-2 ring-offset-dark-900';
    }

    return (
      <div
        key={val.validator_id}
        onClick={() => onSelectValidator(val.validator_id)}
        className={`relative flex flex-col p-4 rounded-xl border transition-all duration-200 cursor-pointer ${borderStyle} ${haloStyle} min-w-[210px] flex-1 shadow-md`}
      >
        {/* Header: ID, Role Badge, Power Toggle */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-lg ${
                isStopped
                  ? 'bg-rose-950 text-rose-500'
                  : isLeader
                  ? 'bg-amber-500/20 text-amber-400'
                  : isCandidate
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-blue-500/20 text-blue-400'
              }`}
            >
              {isStopped ? (
                <Skull className="w-4 h-4" />
              ) : isLeader ? (
                <Crown className="w-4 h-4" />
              ) : (
                <Server className="w-4 h-4" />
              )}
            </div>
            <div>
              <span className="font-bold text-sm text-white font-mono">{val.validator_id}</span>
              {val.partition_id && (
                <span className="ml-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-dark-700 text-slate-300 border border-dark-600">
                  {val.partition_id.toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* Role Pill */}
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              isStopped
                ? 'bg-rose-900/60 text-rose-300 border border-rose-800'
                : isLeader
                ? 'bg-amber-400/20 text-amber-300 border border-amber-500/40'
                : isCandidate
                ? 'bg-purple-400/20 text-purple-300 border border-purple-500/40'
                : 'bg-blue-400/10 text-blue-300 border border-blue-500/20'
            }`}
          >
            {isStopped ? 'STOPPED' : val.role}
          </span>
        </div>

        {/* Malicious Tag Warning */}
        {isMalicious && (
          <div className="mb-2 px-2 py-0.5 rounded bg-rose-950 border border-rose-600/50 flex items-center gap-1.5 text-[11px] text-rose-300 font-semibold">
            <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
            <span className="truncate">Byzantine: {val.malicious_type}</span>
          </div>
        )}

        {/* Node Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-dark-700/60 my-1">
          <div className="flex flex-col">
            <span className="text-slate-400 text-[10px]">Current Term</span>
            <span className="font-mono font-semibold text-slate-200">{val.current_term}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400 text-[10px]">Log Entries</span>
            <span className="font-mono font-semibold text-slate-200 flex items-center gap-1">
              <FileText className="w-3 h-3 text-slate-500" />
              {val.log_length}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400 text-[10px]">Commit Index</span>
            <span className="font-mono font-semibold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              {val.commit_index}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400 text-[10px]">Voted For</span>
            <span className="font-mono text-slate-300 truncate">
              {val.voted_for || (isStopped ? '-' : 'None')}
            </span>
          </div>
        </div>

        {/* Footer: Messages & Control Toggle */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span className="flex items-center gap-0.5 text-blue-400" title="Sent">
              <Send className="w-2.5 h-2.5" /> {val.messages_sent}
            </span>
            <span className="flex items-center gap-0.5 text-emerald-400" title="Received">
              <Inbox className="w-2.5 h-2.5" /> {val.messages_received}
            </span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleValidator(val.validator_id, val.is_online);
            }}
            className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-all ${
              val.is_online
                ? 'bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300'
                : 'bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800 text-emerald-300'
            }`}
          >
            {val.is_online ? 'Crash Node' : 'Restore'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-dark-800/80 border border-dark-700 rounded-xl p-5 shadow-lg backdrop-blur-sm">
      {/* Title & Quorum Guide */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Radio className="w-4 h-4 text-brand-blue animate-pulse" />
            Validator Topology & Consensus State
          </h2>
          <p className="text-xs text-slate-400">
            Click any validator node to inspect its local uncommitted/committed transaction logs.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            <span>Leader</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
            <span>Follower</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
            <span>Candidate</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span>Fault / Offline</span>
          </div>
        </div>
      </div>

      {/* Network Topology Display */}
      {isPartitioned ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl bg-dark-900/60 border border-dashed border-amber-600/40">
          {/* Majority Partition Group */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-2 py-1 rounded bg-emerald-950/40 border border-emerald-600/30 text-emerald-300 text-xs font-semibold">
              <span>Majority Partition (Quorum Achieved - 3 Nodes)</span>
              <span className="font-mono text-[11px] bg-emerald-900/60 px-2 py-0.5 rounded">
                Can Commit
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {validators
                .filter((v) => activePartition?.group_a?.includes(v.validator_id))
                .map(renderNodeCard)}
            </div>
          </div>

          {/* Minority Partition Group */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-2 py-1 rounded bg-rose-950/40 border border-rose-600/30 text-rose-300 text-xs font-semibold">
              <span>Minority Partition (Quorum Stalled - 2 Nodes)</span>
              <span className="font-mono text-[11px] bg-rose-900/60 px-2 py-0.5 rounded">
                Cannot Commit
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {validators
                .filter((v) => activePartition?.group_b?.includes(v.validator_id))
                .map(renderNodeCard)}
            </div>
          </div>
        </div>
      ) : (
        /* Full Unified Ring / Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {validators.map(renderNodeCard)}
        </div>
      )}
    </div>
  );
};
