import React, { useState } from 'react';
import {
  Cpu,
  Clock,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import { api } from '../services/api';

interface AdaptivePanelProps {
  adaptiveStatus: any;
  onRefresh: () => void;
}

export const AdaptivePanel: React.FC<AdaptivePanelProps> = ({
  adaptiveStatus,
  onRefresh,
}) => {
  const [toggling, setToggling] = useState(false);

  const enabled = adaptiveStatus?.enabled ?? true;
  const classification = adaptiveStatus?.current_classification ?? 'HEALTHY';
  const timeouts = adaptiveStatus?.current_timeouts ?? {
    election_min_sec: 1.5,
    election_max_sec: 3.0,
    heartbeat_interval_sec: 0.5,
  };
  const decisions = adaptiveStatus?.recent_decisions ?? [];

  const handleToggle = async () => {
    setToggling(true);
    try {
      await api.toggleAdaptive(!enabled);
      onRefresh();
    } finally {
      setToggling(false);
    }
  };

  const getBadgeColor = (cls: string) => {
    switch (cls) {
      case 'HEALTHY':
        return 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300';
      case 'HIGH_LATENCY':
        return 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300';
      case 'HIGH_LOSS':
        return 'bg-amber-950/60 border-amber-500/40 text-amber-300';
      case 'SEVERELY_DEGRADED':
        return 'bg-rose-950/70 border-rose-500/50 text-rose-300';
      case 'PARTITIONED':
        return 'bg-purple-950/60 border-purple-500/40 text-purple-300';
      case 'QUORUM_LOST':
        return 'bg-rose-950/90 border-rose-600 text-rose-200 animate-pulse';
      default:
        return 'bg-dark-700 border-dark-600 text-slate-300';
    }
  };

  return (
    <div className="bg-dark-800/80 border border-dark-700 rounded-xl p-5 shadow-lg backdrop-blur-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            Adaptive Network Controller
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/70 border border-purple-500/40 text-purple-300">
              Closed-Loop Tuning
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Monitors packet latency, drops, and quorum state to dynamically adapt election timeouts.
          </p>
        </div>

        {/* Toggle Mode */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-dark-900 border border-dark-700 hover:border-dark-600 text-slate-300 hover:text-white transition-all"
        >
          {enabled ? (
            <>
              <ToggleRight className="w-5 h-5 text-emerald-400" />
              <span>Adaptive Mode: <strong className="text-emerald-400">ON</strong></span>
            </>
          ) : (
            <>
              <ToggleLeft className="w-5 h-5 text-slate-500" />
              <span>Adaptive Mode: <strong className="text-slate-400">OFF (Static)</strong></span>
            </>
          )}
        </button>
      </div>

      {/* Main Grid: Status & Active Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        {/* Classification */}
        <div className="p-3 rounded-lg bg-dark-900/60 border border-dark-700 flex flex-col justify-between">
          <span className="text-slate-400 text-[10px] uppercase font-semibold">Network State</span>
          <div className="my-1">
            <span
              className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold border tracking-wide ${getBadgeColor(
                classification
              )}`}
            >
              {classification}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Live evaluation</span>
        </div>

        {/* Heartbeat Interval */}
        <div className="p-3 rounded-lg bg-dark-900/60 border border-dark-700">
          <span className="text-slate-400 text-[10px] uppercase font-semibold">Heartbeat Interval</span>
          <div className="text-lg font-bold font-mono text-cyan-400 my-0.5 flex items-baseline gap-1">
            {timeouts.heartbeat_interval_sec.toFixed(2)}
            <span className="text-xs font-sans text-slate-500 font-normal">sec</span>
          </div>
          <span className="text-[10px] text-slate-500">Leader ping frequency</span>
        </div>

        {/* Min Election Timeout */}
        <div className="p-3 rounded-lg bg-dark-900/60 border border-dark-700">
          <span className="text-slate-400 text-[10px] uppercase font-semibold">Min Election Timeout</span>
          <div className="text-lg font-bold font-mono text-purple-400 my-0.5 flex items-baseline gap-1">
            {timeouts.election_min_sec.toFixed(2)}
            <span className="text-xs font-sans text-slate-500 font-normal">sec</span>
          </div>
          <span className="text-[10px] text-slate-500">Lower election jitter bound</span>
        </div>

        {/* Max Election Timeout */}
        <div className="p-3 rounded-lg bg-dark-900/60 border border-dark-700">
          <span className="text-slate-400 text-[10px] uppercase font-semibold">Max Election Timeout</span>
          <div className="text-lg font-bold font-mono text-amber-400 my-0.5 flex items-baseline gap-1">
            {timeouts.election_max_sec.toFixed(2)}
            <span className="text-xs font-sans text-slate-500 font-normal">sec</span>
          </div>
          <span className="text-[10px] text-slate-500">Upper election jitter bound</span>
        </div>
      </div>

      {/* Decision Explanations Log */}
      <div className="rounded-lg bg-dark-900/80 border border-dark-700 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            Automatic Adaptive Actions & Policy Explanations:
          </span>
          <span className="text-[10px] text-slate-500">Last 5 actions</span>
        </div>

        {decisions.length === 0 ? (
          <div className="text-center py-4 text-xs text-slate-500 font-mono">
            Network is operating within nominal thresholds. No adaptive intervention required.
          </div>
        ) : (
          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {decisions.map((dec: any, idx: number) => (
              <div
                key={idx}
                className="p-2.5 rounded bg-dark-800 border border-dark-700 text-xs flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${getBadgeColor(
                      dec.classification
                    )}`}
                  >
                    {dec.classification}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">{dec.time_str}</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">{dec.reason}</p>
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 pt-1 border-t border-dark-700">
                  <span>
                    Election: {dec.prev_config?.election_min}s-{dec.prev_config?.election_max}s →{' '}
                    <strong className="text-emerald-400">
                      {dec.new_config?.election_min}s-{dec.new_config?.election_max}s
                    </strong>
                  </span>
                  <span>
                    Heartbeat: {dec.prev_config?.heartbeat_interval}s →{' '}
                    <strong className="text-cyan-400">
                      {dec.new_config?.heartbeat_interval}s
                    </strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
